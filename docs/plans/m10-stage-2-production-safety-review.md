# M10 Stage 2 — Production-Safety & Failure-Mode Review

**Review type:** Read-only failure-mode / production-safety analysis (pre-implementation). **No runtime code, tests, or existing documents were modified; no cron, lock, flag, archive format, environment, database, or deployment change was made.** The only file created is this document.
**Date:** 2026-07-30
**Reviewer:** Production Safety Reviewer, Sprint 23B / M10 Stage 2.
**Under review (planned):** Stage 2 orchestration — discovery + archive-state reads + Stage-1 provider invocation + bounded M6/M8 processing + aggregate diagnostics, **inside the durable job lock**.
**Governing:** `docs/architecture/m10-live-candidate-pipeline-specification.md` (Rev A1, INV-A/C/D/L/S), `docs/plans/m10-live-candidate-pipeline-architecture-review.md`, `docs/plans/m10-stage-1-candidate-provider-foundation.md` (+ `…-implementation-review.md`, BF-S1 resolved), `docs/plans/sprint-23b-m9-closure.md`, `docs/plans/sprint-23b-m10-closure.md` (stub).
**Method:** every cited `file:line` was read from the current repository; the Stage-1 provider and the frozen M6/M8/M9 substrate were inspected directly, not trusted from prior reviews.

---

## 1. Executive Verdict

### CONDITIONALLY READY FOR STAGE 2 IMPLEMENTATION

The substrate Stage 2 will build on is **sound, fail-closed, and green** (M9 closure: 1687/1687; Stage 1: 48/48, full 1735/1735). The durable lock binds `EVIDENCE_DATABASE_URL` and fails closed in production (`locks.ts:27-41`); every archive read path throws on real errors and treats only `ENOENT` as empty (`file.ts`, odds/provider `file.ts`); capture is full-stream idempotent (`capture.ts:89-105`); settlement is revision-aware and idempotent (`settlement.ts:288-313`); the Stage-1 provider is pure, deterministic, bounded, and clock-free. **Nothing in the substrate blocks Stage 2.**

But Stage 2 introduces the three things the substrate deliberately does **not** yet do — **discovery + archive-state derivation inside the lock, a real per-run deadline, and real ceilings** — and each is a place a production defect can be introduced. Stage 2 may proceed **only if** it satisfies the blocking conditions in §12. The sharpest:

- **SC-1 (INV-A/L).** Archive-state derivation (`capturedWindowKeys`/`partialWindowKeys`, `capturedFixtureIds`/`settledFixtureIds`) MUST use the **strict, throwing** store reads — never the fail-soft presentation view `getEvidenceHistoryView` (`service.ts:82-95`), which returns `archive_unavailable` as an *empty* view. A soft-empty read would present the provider with "nothing captured" and drive **duplicate mints / re-settlement**. Discovery + these reads + ordering + selection + processing MUST all be **inside** the held lock.
- **SC-2 (INV-D).** The runner has **no internal deadline** today (`runWithLock`, `runner.ts:55-138`); only the route `maxDuration = 60` bounds it. Stage 2 MUST enforce `effectiveJobDeadlineMs = min(configured, ROUTE_BUDGET − HEADROOM) ≤ 45 s` and **start no new candidate** without sufficient remaining budget.
- **SC-3 (INV-C).** `DEFAULT_CAPTURE_MAX_FIXTURES = 500` is over budget and `readPositiveInt` fails safe *to that 500* (`config.ts:40,50-56`); settlement has **no** cap. Stage 2 MUST clamp both to `clamp(configured,1,150)` (default 100) in the producer.
- **SC-4 (fail-closed reads).** A malformed / permission / I/O archive read MUST **defer** the affected fixture (or abort the run) and be reported `failed` — never counted as "0 candidates / empty success."

Every condition is satisfiable additively at the Stage-2 orchestration boundary; none requires a frozen-contract, identity, hash, revision, or archive-format change. Hence **conditionally ready**, not blocked.

---

## 2. Lock-Safety Invariants

**Verified substrate.** `tryAcquireJobLock(name, {requireDurable})` (`locks.ts:18-96`); `runWithLock(jobType, fn)` (`runner.ts:55-138`) sets `requireDurable = jobType === "evidence_capture" || "prediction_settlement"` (`runner.ts:72-74`), acquires, runs `fn`, and releases in `finally` (`runner.ts:135-137`). Lock keys are `job:${jobType}` (`runner.ts:66`) — distinct per pipeline.

| Scenario | Current behaviour (verified) | Stage-2 required invariant |
|---|---|---|
| **Capture vs settlement key separation** | `job:evidence_capture` ≠ `job:prediction_settlement`; distinct PG advisory keys (`advisoryLockKey` sha256→int4, `locks.ts:10-14`). | **LK-1** Keys stay distinct and per-pipeline; discovery/selection for a pipeline runs only under its own key. |
| **Same-job overlap** (two capture fires) | 2nd acquisition polls `pg_try_advisory_lock` for ≤1 s (`locks.ts:64-87`) then returns `null` → runner returns `skipped`/`lock_unavailable` → **409** (`cronHandler.ts:71`). | **LK-2** Overlap yields 409, never 500, never a second discovery/mint. |
| **Cross-job overlap** (capture + settlement together) | Both acquire (distinct keys) and run concurrently; they touch the same NDJSON files but different logical records. | **LK-3** Concurrency across pipelines is safe *only because writes are append-only + idempotent*; Stage 2 must not add a shared mutable cursor that the two could race. |
| **Lock acquisition failure** (no `EVIDENCE_DATABASE_URL`, prod) | `requireDurable && NODE_ENV==="production"` → `null` (`locks.ts:39`) → `skipped`. **No memory fallback.** | **LK-4** Never degrade an evidence lock to the in-process `Set`; a missing durable lock is a skip, not a run. |
| **Connection failure during acquire** | `pool.connect()` throws → `null` (`locks.ts:54-62`), `pool.end()`. | **LK-5** A DB-unreachable acquire is a fail-closed skip; no work proceeds unlocked. |
| **Unlock failure (H-1)** | `release()` awaits `pg_advisory_unlock`; a throw propagates out of `release()` → out of the `finally` → out of `runWithLock` → **`cronHandler` has no try/catch around `await run()`** (`cronHandler.ts:47`) → **500 on an otherwise-successful, idempotent run.** | **LK-6** Land the H-1 swallow/log (spec R6): a successful run whose unlock throws MUST report its real status, not 500. Advisory lock auto-releases on connection drop, so re-fire is safe regardless. |
| **Process crash while lock held** | PG session dies → advisory lock auto-released by Postgres; committed appends persist; uncommitted last write may be torn (no fsync, §4). | **LK-7** Recovery is re-fire; Stage 2 must recompute pending work from the archive (INV-A), never from a held-lock assumption. |
| **Database restart** | In-flight `client.query` rejects → caught → acquire returns `null` (skip) or, mid-run, a store read/write throws → job `failed`. Advisory locks are lost on restart (fine — nothing else holds them). | **LK-8** A lock-DB restart is a skip/deferred run, never a silent unlocked run. |
| **Route timeout while work active** | Platform kills the invocation at 60 s; the lock's PG session is torn down → advisory lock released; partial appends persist idempotently. | **LK-9** Stage 2's own deadline (SC-2) must stop work *before* 60 s so shutdown is clean, not a platform kill mid-write. |
| **Nested lock risk** | None: `runWithLock` is not re-entrant and calls no other lock (`runner.ts`). | **LK-10** Stage 2 must not acquire a second lock inside the job body (no lock-ordering/deadlock surface). One lock per run. |
| **Lock ordering** | Single lock per run ⇒ no ordering hazard. | **LK-11** Preserve single-lock-per-run; if capture-before-settlement ordering matters it is a *scheduling* concern (distinct keys), never nested locks. |
| **Starvation under frequent cron overlap** | Excess fires get 409 and do no work; `oldest_pending_candidate_age`/`backlog_size` are the required signals (spec §7.4). | **LK-12** Deterministic forward-only ordering (INV-S) guarantees a deferred candidate is re-selected once earlier ones drain; overlap wastes a 409, never starves permanently — but the capacity gate (`cadence × ceiling ≥ arrival`) must hold. |

**Mandatory lock invariants (summary):** distinct per-pipeline keys; overlap → 409 never 500; production evidence locks fail closed (no memory fallback); single non-nested lock released in `finally`; all authoritative discovery/read/select/process **inside** the lock; H-1 unlock-throw must not misreport success.

---

## 3. Discovery Boundary Risks (what breaks if any step runs outside the lock)

INV-L requires **six steps inside the held lock**: (1) source fetch/discovery, (2) archive-state read, (3) progress derivation, (4) ordering, (5) bounded selection, (6) processing. Consequences of leaking any step out:

| Step outside lock | Failure introduced | Class |
|---|---|---|
| **Source fetch** | Two workers fetch different daily-list snapshots and derive divergent eligible sets against divergent `now` — inconsistent selection, duplicate provider spend. Idempotency still prevents a *duplicate mint*, but wastes budget and skews counters. | TOCTOU (selection) |
| **Archive read** | Worker A reads head before Worker B's append lands, both compute "not captured," both proceed to mint the same `(fixtureId, capturedAt)`. M6's full-stream pre-check (`capture.ts:98-105`) + immutable append still collapse this to `already_exists`/`immutable_violation`, so **no data corruption** — but it produces a spurious `immutable_violation`/`failed`, wasted derivation, and a misleading run. Under the lock this never happens. | **TOCTOU / double-processing** |
| **Progress derivation** (already-captured / already-settled sets) | Stale progress ⇒ re-emitting already-done work ⇒ same collapse-to-no-op, but backlog/oldest-age accounting diverges between workers (INV-S violated). | Accounting drift |
| **Ordering** | Two workers order against different reads ⇒ overlapping pages ⇒ both process the head of the queue, the tail starves. | Starvation |
| **Bounded selection** | Selection computed outside the lock can pick an overlapping window vs the concurrent worker ⇒ redundant processing + `_by_cap` deferral counted twice. | Double-processing |

**Required discovery invariants:** **DB-1** nothing authoritative (discovery, read, derive, order, select, process) runs before the lock is held; only the **cheap flag check** (`isCaptureEnabled`/`isSettlementEnabled`, `runner.ts:288,325`) and **cron auth/rate-limit** (`cronHandler.ts:18-44`) precede it. **DB-2** the archive read that derives progress and the writes that consume it observe the **same store instance / same directory** within one locked run (read-then-write under one lock = no intervening writer). **DB-3** the read is a **single bounded pass per store per run** (spec §7.2) — no per-fixture re-scan (O(F²) guard). **DB-4** because progress is archive-derived (INV-A), a crashed/again run recomputes identical pending work; no process-local cursor may substitute for the read.

---

## 4. Archive Read Failure Matrix

Stage 2's new archive-state read is the highest-leverage new failure surface. Verified reader behaviour: evidence `readNdjson` (`file.ts:73-126`) and odds/provider `file.ts` all treat **only `ENOENT` as empty** and **throw** on `EACCES/EPERM`, `EIO/EBUSY/ENXIO/ENODEV`, malformed JSON (per line), and any other errno; the file is never rewritten. The **fail-soft** view `getEvidenceHistoryView` (`service.ts:82-95`) catches and returns `archive_unavailable` — **must not** be used for progress derivation.

| Condition | Strict-reader behaviour (verified) | Required Stage-2 fail-closed behaviour |
|---|---|---|
| **Missing archive file** | `ENOENT → []` (`file.ts:76`, odds `:76`, provider `:95`). | Treat as genuinely empty → all fixtures eligible-fresh. **Only** ENOENT may mean empty. |
| **Malformed line** | `throw "malformed NDJSON at line N"` (`file.ts:113-118`). | Read throws → **defer the run / affected fixtures**, report `failed`; never proceed as "0 captured." Alert; quarantine (manual). |
| **Truncated final line** (torn append, no fsync) | Parses as malformed → **throws** (same as above). | Same as malformed: defer + alert. Never silently drop the tail. |
| **Permission error** | `throw "permission denied (EACCES/EPERM)"` (`file.ts:81-86`). | Defer/abort + report `failed`; this is an activation-precondition failure (archive ownership), not empty history. |
| **Disk full (write side)** | `appendFile` throws → `write_failed` (`file.ts:150-158`). | Surface `write_failed` → job `failed`; re-fire is idempotent. **Alert.** |
| **Stale/broken network FS** | `EIO/EBUSY/ENXIO/ENODEV → throw` (`file.ts:88-95`). | Defer/abort + `failed`; never empty. |
| **Partial read** (short read) | Node `readFile` returns whole file or throws; a partial buffer would fail JSON.parse → throws. | Throw → defer; no partial-history acceptance. |
| **Duplicate records** (same id) | Append side dedups (`decideSnapshotAppend`/odds `decideOddsAppend`); read side keeps both lines but downstream identity collapses. `verifyEvidenceChain` flags sequence conflicts. | Progress derivation must be **idempotent over duplicate lines** (dedup by identity), and any *conflicting* duplicate (same id, different hash) must be surfaced, not averaged. |
| **Conflicting records** (same id, different hash) | Append → `immutable_violation`; a pre-existing conflict is detected by the integrity sweep, not by a plain read. | Derivation must not "pick one"; a detected conflict → treat the window as **poisoned**, defer + alert (never re-mint over it). |
| **Snapshot-only pair** (snapshot present, mandatory odds missing) | This is the **partial-pair** state → `partialWindowKeys` → Stage-1 re-emits `healing:true` → M6 `already_exists` + `ensureMandatoryCaptureOdds` appends the missing odds (`capture-run.ts:129-146`). | **AR-partial:** derivation MUST classify snapshot-without-odds as `partialWindowKeys` (heal), not `capturedWindowKeys` (skip). Getting this wrong permanently strands predictions with no odds record (DoD-5 violation). |
| **Odds-only pair** (odds record, no snapshot) | No snapshot ⇒ nothing binds the odds; capture pre-check sees no snapshot → would mint one, then heal odds (idempotent). | Treat as **not captured** (mint the snapshot); the orphan odds record is inert (keyed by a `captureId` the snapshot will reproduce). Do not treat odds-only as "captured." |
| **Invalid JSON** | Throws (`file.ts:113-118`). | Defer + alert; never empty. |
| **Schema-valid JSON, semantically invalid record** (parses, but bad fields) | Passes `JSON.parse`; the record enters the derived set. Frozen builders/append rules reject it downstream (`decideSnapshotAppend`, `buildOddsRecord`). | **AR-schema:** derivation should be defensive — a record whose identity fields are malformed must be treated fail-closed (exclude from progress *and* flag), never used to *suppress* a legitimate capture. Prefer defer+alert over trusting a semantically-broken record. |

**Overarching archive-read invariant (AR-0):** progress derivation uses the **strict** reader; **any** non-ENOENT failure ⇒ the run (or the affected fixture) is **deferred and reported `failed`**, never counted as empty/zero-candidate success (this is the exact trap the M9 G6 fix closed for the write path — Stage 2 must not re-open it on the read/derive path).

---

## 5. Capture Failure Matrix

Verified path: `runEvidenceCaptureJob` (`runner.ts:282-310`) → flag gate → `runWithLock` → `runCaptureBatch(deps, candidates)` (`capture-run.ts:88-165`). Per candidate: `captureEvidenceSnapshot` (`capture.ts`), then C5 `ensureMandatoryCaptureOdds` (`mandatory-odds.ts:130-160`). `hardFailed = counts.writeFailed>0 || counts.immutableViolation>0` → job `failed` + code (`runner.ts:301-306`).

| Failure | Verified substrate behaviour | Required Stage-2 behaviour / invariant |
|---|---|---|
| **Fetch succeeds, derivation fails** | Stage-1 seam returns `{ok:false, reason}` → `CaptureDeriveResult` → counted `invalid`/`no_scorable_markets`; **no snapshot written** (`capture-run.ts`), `not_admitted`/`invalid` counters. | **CF-1** A derivation failure is a *counted defer/reject*, never a partial write; the fixture re-derives next fire. Derivation runs **inside** the lock (INV-L). |
| **Snapshot append succeeds, odds append fails** | Snapshot committed; `ensureMandatoryCaptureOdds` returns `{ok:false, code}` → capture counted `writeFailed`/`immutableViolation`, `failures[]` records `odds_*` (`capture-run.ts:138-146`). Snapshot now a **partial pair**. | **CF-2** The run reports `failed`; on re-fire the snapshot is `already_exists` and odds are healed idempotently (partial-pair repair). Stage 2 must classify it `partialWindowKeys` so it *is* re-emitted (heal), not skipped. Zero-odds capture is a DoD-5 failed capture — never reported success. |
| **Retry after partial pair** | Re-fire: `captureEvidenceSnapshot` → `already_exists` (full-stream pre-check, `capture.ts:104`) with the existing snapshot; `ensureMandatoryCaptureOdds` appends the missing odds (byte-identical re-append collapses to `duplicate`). No duplicate snapshot, no new identity. | **CF-3** Partial-pair heal MUST be deterministic and idempotent; healing must still occur even if the window has "expired" for fresh capture (Stage-1 already re-emits partials regardless of timing — `eligibility.ts` partial branch). |
| **Candidate selected but deadline expires before its write** | Today: no deadline; platform may kill mid-write → torn tail line (no fsync). | **CF-4 (SC-2)** Stage 2 must **not start** a candidate's fetch/derive/write without sufficient remaining budget; a candidate not started is **deferred** (`_by_deadline`), not lost. A started-but-killed write is recovered by idempotent re-fire. |
| **Duplicate invocation** (same batch twice / overlap) | Lock serializes; the loser 409s. Within a batch, Stage-1 dedups repeated `(fixtureId, marketKey)`. Same coordinates → `already_exists`. | **CF-5** No duplicate mint under any duplication (lock + full-stream idempotency). Stage-1 within-batch dedup must remain. |
| **Process crash between snapshot and odds write** | Snapshot committed, odds not → partial pair (= CF-2). | **CF-6** Recovered by CF-3 heal on re-fire; no data loss, no duplicate. |
| **Crash after N of M candidates** | N committed (each snapshot; odds committed for those that finished C5), remainder untouched. | **CF-7 (INV-A/B7)** Re-fire re-derives pending work from the archive and completes M−N with no duplicates and no permanently-skipped candidate. |
| **`immutable_violation`** (same id, different hash — determinism bug) | `capture.ts:150` → orchestrator `immutableViolation` → `failed`+`immutable_violation` (`runner.ts:306`). | **CF-8** Never blind-retried; reported `failed`, alerted, treated as a **P0 determinism bug** in candidate production (a clock/nondeterminism leak). |
| **Store read throws mid-capture** (corrupt/permission) | `capture.ts:92-100,107-114` → `archive_error` → orchestrator `writeFailed` → `failed`. | **CF-9** Surfaced as `failed`, fixture deferred; never a duplicate mint, never "empty success." |

---

## 6. Settlement Failure Matrix

Verified path: `runPredictionSettlementJob` (`runner.ts:319-346`) → flag gate → `runWithLock` → `runSettlementBatch(deps, candidates)` (`settlement-run.ts`). Guards: **C3** `row.matchId === fixtureId` before any read/write (`settlement-run.ts:186-195`); **C4** `hasValidCompletedScores` (`:141-155,198-201`); then `settleLatestSnapshotForFixture` (`settlement.ts:364-377`). BF-S1 (resolved): terminal `postponed|cancelled|abandoned` are eligible non-scored settlements.

| Failure | Verified substrate behaviour | Required Stage-2 behaviour / invariant |
|---|---|---|
| **Candidate selected but fixture changes** (row differs at process time vs selection) | Discovery + selection + settle all inside one lock ⇒ the row is read once and used; C3 re-checks `matchId===fixtureId` at settle (`settlement-run.ts:186`). | **SF-1** Because selection→settle is atomic under the lock (INV-L), there is no TOCTOU window; C3 is the backstop. Never settle a row whose `matchId` ≠ target fixture. |
| **Validation append fails** | `settleSnapshot` returns `appendFailed` in the per-market summary → orchestrator folds to `writeFailed` → `failed` (`settlement-run.ts`). | **SF-2** Reported `failed`+`write_failed`; re-fire is idempotent (revision-aware). Never counted as settled. |
| **Duplicate invocation** | Lock serializes; re-settle of an unchanged outcome → `no_change` (`settlement.ts:288-293`), no append. | **SF-3** Re-fire with unchanged outcome writes nothing (`noChange`); a genuine change writes exactly one new revision. |
| **Correction / revision state** | A state change on an already-settled selection requires an explicit `correctionCause`, else `invalid_input` (`settlement.ts:301-303`); correction note derived (`:305-313`). | **SF-4** Stage 2 must supply `correctionCause` **only** for a genuine outcome change and must derive the settled-to-what state from the archive to know a change occurred (Stage-1 `SettlementArchiveState` currently carries only `settledFixtureIds` — insufficient for corrections; see §13 R-6 / spec §16). A first settle needs no cause. |
| **Crash after outcome calc, before append** | Nothing persisted (outcome is computed in-memory, appended atomically as one line). | **SF-5** Re-fire recomputes the same outcome deterministically and appends once; no partial revision (each market append is one line). |
| **Terminal lifecycle without scores** (postponed/cancelled/abandoned) | BF-S1: eligible terminal non-scored; M8 writes `terminal_non_scored` with the deterministic kickoff `completionInstant` (`outcomes.ts:186-205`). | **SF-6** Terminal candidates MUST carry a valid deterministic `completionInstant` (kickoff default is valid) so M8 does not return `invalid_timestamp`; no score requirement. |
| **Scored lifecycle with corrupt scores** (negative/fractional/NaN) | C4 rejects before settle (`settlement-run.ts:198-201`); a `finished` row lacking `isFinished`/present scores → `fixture_not_complete`/`missing`/`invalid_final_score` (Stage-1 `eligibility.ts`). | **SF-7** Corrupt scores can never produce a definitive won/lost; rejected/deferred and counted. Score validation must not be weakened. |
| **Settlement read throws** (corrupt/permission) | `latestSnapshot`/`listValidations` throw → orchestrator try/catch → `writeFailed` → `failed` (`settlement-run.ts`). | **SF-8** Surfaced `failed`, fixture deferred; never mis-settled, never empty success. |
| **No snapshot for fixture** | `settleLatestSnapshotForFixture` → `not_found` (`settlement.ts:372-373`) → counted `notFound`, safe no-op. | **SF-9** A settlement candidate for an un-captured fixture is a safe no-op; Stage-1 already pre-filters via `capturedFixtureIds` (`missing_prediction_identity`). |

---

## 7. Deadline and Timeout Safety

**Verified gap:** `runWithLock` has **no internal deadline** (`runner.ts:55-138`); the only bound is the route `maxDuration = 60` (both routes). The M0 `DEFAULT_RUN_DEADLINE_MS = 300_000` is 5× the route budget (`config.ts:153`). Lock acquisition itself is bounded (`timeoutMs = 1000`, `locks.ts:64`).

| Point of deadline expiry | Risk without a guard | Required Stage-2 behaviour (INV-D) |
|---|---|---|
| **Before discovery** | — | If remaining < a minimum discovery reserve, do nothing → `succeeded` zero-count (empty-safe), release lock. |
| **During archive scan** | Long O(A) scan on a large file eats the whole budget → platform kill mid-run. | The single bounded read (DB-3) must fit the budget at representative depth (Gate B5 benchmark); if the scan itself risks the budget, that is the file-adapter scaling boundary → Postgres (out of scope) — Stage 2 documents it, never ignores it. |
| **After selection, before processing** | — | Check remaining budget before the first candidate; if insufficient, defer the whole selected set (`_by_deadline`). |
| **Between candidates** | Starting candidate k+1 with no budget → killed mid-write. | **DL-1** Before each candidate, check `remaining ≥ worstCasePerCandidate`; if not, **stop and defer** the rest (counted `candidates_deferred_by_deadline`). |
| **During one candidate** | Fetch/derive/write of a single candidate overruns. | **DL-2** Pass the *effective* (clamped) deadline / AbortSignal into M4 fetch (`runDeadlineMs` must be the clamped value, never 300 s); a started write that is killed is recovered idempotently on re-fire. |
| **Before diagnostics serialization** | Response serialization overruns → platform kill after work committed but before the 200/JSON is returned → **caller sees a timeout/5xx for a run that actually succeeded.** | **DL-3** Reserve `HEADROOM` (~15 s) explicitly for write-drain + diagnostics + serialization; never spend the full 60 s on candidate work. |
| **Route termination by platform** | Hard kill; torn tail line possible (no fsync). | **DL-4** Stage 2's deadline must fire *before* the platform's, so shutdown is a clean deferral, not a mid-write kill; recovery is idempotent re-fire regardless. |

**Mandatory deadline invariant (INV-D):** `effectiveJobDeadlineMs = min(configuredRunDeadlineMs, 60_000 − HEADROOM) ≤ 45_000`; **no new candidate starts without sufficient remaining budget**; deferrals are counted, never dropped; the ceiling-sized run must be benchmarked within budget at representative archive depth (Gate B5) before the deadline+workload combination is accepted.

---

## 8. Replay and Idempotency

Foundations (verified): capture full-stream idempotency (`capture.ts:98-105`; note the pre-check is bounded to the last `EVIDENCE_HISTORY_MAX_LIMIT = 200` snapshots per fixture — practically ample, but a fixture exceeding 200 windows would need the integrity sweep as backstop); settlement revision-aware `no_change`/one-revision (`settlement.ts:288-313`); append-only store (no update/delete); flags read fresh per call (`config.ts:97-108`); progress archive-derived (INV-A). Determinism: Stage-1 provider is clock-free (evalInstant injected); `capturedAt`/`completionInstant`/`nowSec` are pure functions of source+injected instant.

| After… | Expected behaviour (must hold) |
|---|---|
| **Immediate retry** | Lock serializes; loser 409s. Winner re-derives identical pending set → already-done fixtures `already_exists`/`no_change`; no duplicate. |
| **Delayed retry** | Same archive → same ordering/pending set; newly-eligible fixtures added deterministically; expired capture windows counted `expired_window`, never back-dated (spec §6.3). |
| **Process restart** | No process-local state is authoritative (INV-A); pending work recomputed from the archive (jobLog/metrics reset is acceptable — non-authoritative, §9). |
| **Database reconnect** (lock DB) | A failed acquire → skip; a later fire acquires cleanly. No unlocked run in between. |
| **Archive partial write** (torn tail) | Strict reader **throws** on the malformed tail → run deferred + alerted (AR-0); the torn line is never parsed as a false record; after quarantine/repair, re-fire proceeds. **No silent duplicate or loss.** |
| **Source row reordering** | Stage-1 comparators are total and input-order-independent (ordering.ts; A7); identical candidate set → byte-identical output. Verified by Stage-1 shuffle tests. |
| **Source data correction** | A changed result flows through settlement as a **new revision** (with `correctionCause`), never a snapshot rewrite (spec §5.1 forward-only); capture identity is unchanged (past never reinterpreted). |
| **Batch ceiling change** | Ordering is deterministic and forward-only; lowering/raising the ceiling changes only *how many* drain per fire, never *which* identity a candidate gets (identity is coordinate-derived, not batch-position-derived; A6/A7). Deferred overflow is re-selected next fire. |
| **Route timeout** | Committed appends persist; uncommitted deferred; re-fire completes the remainder idempotently (B7). |

**Idempotency invariant (RI-0):** every run is safe to re-fire; no retry, restart, reconnect, reorder, correction, ceiling change, or timeout may produce a duplicate mint, a false result, a lost candidate, or an immutable-data mutation.

---

## 9. Diagnostic Reconciliation

**Verified substrate.** `emitOutcomeMetrics` emits `evidence_job_outcome_total{job,outcome}` for non-zero counts (`runner.ts:264-273`); `getEvidenceJobDiagnostics` (`diagnostics.ts`) projects the **in-process, bounded (`JOB_LOG_MAX = 500`), restart-volatile, per-process** jobLog. Stage-1 emits distinct `discovered/malformed/eligible/selected/deferred(_by_cap)/backlog/oldest-age/emitted`, with `candidatesProcessed = 0` (owned by the runner, spec §10).

| Condition where a counter could **lie** | Required reconciliation / invariant |
|---|---|
| **selected vs processed** | `selected ≥ processed`; a selected candidate not processed (deadline defer) increments `candidates_deferred_by_deadline`, not silently vanishing. **DR-1** `selected = processed + deferred_by_deadline + (in-run failures)`. |
| **processed vs written** | Processing a candidate whose write fails must **not** count as a successful capture/settlement: `write_failed`/`immutable_violation` → job `failed`, and the fixture stays in pending state on re-derivation. **DR-2** "written" is defined by the append result (`created`/`appended`), never by "we called the batch." |
| **deferred vs failed** | A deadline/cap **deferral** (retryable, re-discovered) MUST be a distinct counter from a **failure** (`write_failed`/`immutable_violation`, alertable). Conflating them hides real faults or fakes false alarms. **DR-3** `deferred_*` ≠ `failed`; both are reported, never merged. |
| **partial write counted as success** | A snapshot-without-odds (CF-2) MUST count as `failed`/partial (DoD-5), never `captured`. **DR-4** capture success requires snapshot **and** mandatory odds. |
| **lock contention counted as empty work** | A 409/`lock_unavailable` skip is **not** a zero-candidate success; it is a distinct `skipped`/contention signal (`runner.ts:83`). **DR-5** contention ≠ "no eligible fixtures." |
| **archive corruption counted as zero candidates** | The single most dangerous lie: a strict-read throw must surface as `failed`, **never** as `discovered = 0 / succeeded`. **DR-6 (= AR-0)** a corrupt/permission/IO read is `failed`, not empty success. |
| **deadline deferral counted as rejection** | A budget deferral is retryable (`deferred_by_deadline`), not a permanent reject reason. **DR-7** deadline deferral has its own counter and reason-kind (defer), distinct from permanent rejects. |

**Reconciliation identities (must be assertable, spec §10):** `discovered = eligible + rejected(incl. malformed)`; `eligible = selected + deferred_by_cap`; `selected = processed + deferred_by_deadline + failed_in_run`; **no entity id (fixtureId/matchId/captureId/validationId) may be a metric label.** Diagnostics are **process-local and reset on restart** — durable history/alerting is operational (§10, H-4), so a restart that zeroes the jobLog must not read as "no work ever done."

---

## 10. Activation Preconditions (out of scope to perform; must precede any flag flip)

| # | Precondition | Why (verified anchor) |
|---|---|---|
| **AP-1** | **Strong cron secret** — `CRON_SECRET`/`INTERNAL_CRON_SECRET` ≥16 chars, not `"change-me"`; `ENABLE_CRON=true`. | `cronAccess.ts:44-64` (403 otherwise). |
| **AP-2** | **`EVIDENCE_DATABASE_URL` provisioned + reachable**, shared by all app processes, with `pg_advisory_lock`/`unlock` grant. | `locks.ts:27-41` — else evidence jobs fail closed (skip forever). |
| **AP-3** | **`NODE_ENV=production`** actually set. | `locks.ts:39` — the fail-closed durable requirement keys off `NODE_ENV`; if unset, an evidence lock could degrade to the in-process `Set`. |
| **AP-4** | **`EVIDENCE_ARCHIVE_ADAPTER` NOT set to `memory`** in production. | `service.ts:35`, odds `service.ts:24` — `memory` = volatile store; a silent data-loss config. |
| **AP-5** | **Archive path exists with correct ownership/permissions** (`/opt/rankwagers/shared/evidence-archive` or `EVIDENCE_ARCHIVE_DIR`). | `file.ts:52-59`; strict reads throw `EACCES` (AR-0) — a permissions gap fails every run closed. |
| **AP-6** | **Disk capacity headroom** + `ENOSPC` monitoring. | `appendFile` → `write_failed` on full disk (`file.ts:150-158`). |
| **AP-7** | **Real `SITE_URL`/canonical config** for any URL-bearing provenance and correct env resolution. | deployment config; avoids placeholder leakage. |
| **AP-8** | **Cadence ≥ sustained arrival** for each pipeline (`cadence × ceiling ≥ arrival`, INV-S capacity gate). | spec §7.4 — else backlog + `oldest_pending_age` grow unbounded and capture windows expire. |
| **AP-9** | **External alerting** wired to `evidence_job_outcome_total`, `refresh_job_failure_total{code}`, `lock_unavailable`, and last-success staleness. | diagnostics are process-local/restart-volatile (§9); H-4. |
| **AP-10** | **Scheduled `verifyEvidenceChain`/`verifyValidationChain` sweep.** | the only detector for torn/duplicate/forked lines the append path can't prevent (AR-0 residue). |
| **AP-11** | **Backup / retention / restore verification** of the NDJSON basis (never prune the provider/odds basis — M7 replay). | spec §2.2; migration review. |
| **AP-12** | **Runbook + rollback** (flag-off / cron-unschedule = full rollback, no data cleanup — M10 closure §14). | rollback is configuration, not code revert. |
| **AP-13** | **Dry-run / shadow verification** — staged §12.6: empty pass → bounded capture-only → verify archives+diagnostics → settlement → full. | catches config/permission/lock gaps before real volume. |
| **AP-14** | **H-2 capture ceiling (≈100–150) and H-3 settlement ceiling applied** in the producer before any non-empty candidate set. | `config.ts:40` 500 is over budget; settlement uncapped. |

---

## 11. Required Failure-Injection Tests (Stage 2 must ship)

| # | Scenario | Assertion |
|---|---|---|
| **T-1** | Two concurrent **capture** jobs (same key) | One acquires + discovers + processes; the other → 409 `lock_unavailable`, **no** second discovery/mint; no duplicate snapshot; identical archive vs single-fire. (B6) |
| **T-2** | Two concurrent **settlement** jobs | One settles; other 409; no double revision; `no_change` on the loser's later re-fire. |
| **T-3** | **Capture + settlement simultaneously** | Both run (distinct keys); no cross-contamination; both idempotent; counters reconcile per pipeline. |
| **T-4** | **Lock unavailable** (no `EVIDENCE_DATABASE_URL`, prod) | Job `skipped`/409; **no** discovery, read, fetch, or write; not counted as empty success. (LK-4) |
| **T-5** | **Unlock failure** (H-1) | A successful idempotent run whose `pg_advisory_unlock` throws is **not** reported 500; real status returned; lock auto-released. (LK-6) |
| **T-6** | **Malformed / truncated archive line** during discovery read | Strict read throws → run/fixture deferred + `failed`; **never** `discovered=0/succeeded`; no duplicate mint. (AR-0, DR-6) |
| **T-7** | **Partial-pair repair** (snapshot present, odds missing) | Re-fire heals odds idempotently (`already_exists` + odds append); no duplicate snapshot; classified `partialWindowKeys`, not `capturedWindowKeys`. (CF-2/CF-3) |
| **T-8** | **Deadline exhaustion** mid-batch | No new candidate starts past the budget; remainder `deferred_by_deadline`; committed candidates intact; re-fire completes remainder. (DL-1, B7) |
| **T-9** | **Restart / replay** after N of M | N committed (each with mandatory odds); re-fire re-derives pending from archive; completes M−N; no duplicate, no permanent skip. (INV-A, B7) |
| **T-10** | **Archive write failure** (`ENOSPC` / injected `write_failed`) | Job `failed`+`write_failed`; alertable; re-fire idempotent; not counted as captured/settled. (DR-2/DR-4) |
| **T-11** | **Duplicate source rows** (same fixture ×N, and same row ×N) | Within-batch dedup collapses to one; same coordinates → `already_exists`/`no_change`; no duplicate. (CF-5) |
| **T-12** | **Terminal non-scored settlement** (postponed/cancelled/abandoned, no scores) | Eligible; settles to correct terminal state via `resolveMatchLifecycle` with the deterministic kickoff `completionInstant`; `no_change` on re-fire. (SF-6, BF-S1) |
| **T-13** | **Correction / revision state** | A genuine outcome change with `correctionCause` → exactly one new revision; unchanged → `no_change`; a change lacking `correctionCause` → `invalid_input` (rejected, no bad revision). (SF-4) |
| **T-14** | **Bounded backlog** (eligible > ceiling) | Deterministic ordering; overflow `deferred_by_cap` + `backlog_size`/`oldest_pending_age` set; next fire drains the head; no candidate silently dropped; total across fires covers all. (INV-C/INV-S, DR-1) |
| **T-15** | **Conflicting record** (same id, different hash) present in archive | Discovery flags the window poisoned → defer + alert; **no** re-mint over it; run `failed`, not "0 candidates." (AR §4 conflicting) |
| **T-16** | **Config fail-safe** (ceiling = 0 / negative / NaN / >150) | Clamps to `[1,150]` default 100; never 500, never unbounded. (SC-3, A6) |
| **T-17** | **Fail-soft-view guard** (static/behavioural) | Progress derivation does **not** call `getEvidenceHistoryView`/any catch-to-empty path; a corrupt archive never yields an empty progress set. (SC-1, AR-0) |
| **T-18** | **Determinism** (no clock/random in producer path) | `Date.now`/`Math.random` absent under the producer path; injected evalInstant only; M7 serialization-boundary replay passes over M10 output. (A2/A4) |

---

## 12. Blocking Stage 2 Conditions

Stage 2 MUST satisfy all of the following before it can be considered complete/mergeable (each is additive, no frozen-contract change):

- **SC-1 — Strict, in-lock archive-state derivation (INV-A/L).** Derive `capturedWindowKeys`/`partialWindowKeys`/`capturedFixtureIds`/`settledFixtureIds` from the **strict throwing** store reads inside the held lock; **never** from the fail-soft `getEvidenceHistoryView`. Correctly classify snapshot-only → partial (heal) vs complete pair → skip.
- **SC-2 — Enforced sub-route deadline (INV-D).** `effectiveJobDeadlineMs = min(configured, 60_000 − HEADROOM) ≤ 45_000`; **no new candidate starts without sufficient remaining budget**; pass the clamped deadline/AbortSignal into M4 fetch; reserve headroom for write-drain + diagnostics + serialization. Never the raw 300 s default on the web-cron path.
- **SC-3 — Producer-enforced ceilings (INV-C).** `clamp(configured,1,150)` default 100 for **both** capture and settlement; zero/negative/malformed → conservative bounded default (never 500, never unbounded); overflow deterministically **deferred** and counted, never dropped.
- **SC-4 — Fail-closed reads/writes surfaced (AR-0/DR-6).** Any non-ENOENT read failure or any `write_failed`/`immutable_violation` ⇒ the run/fixture is **deferred and reported `failed`**, never counted as empty/zero-candidate success; corrupt/conflicting records poison the window (defer+alert), never re-minted.
- **SC-5 — Discovery strictly inside the lock (INV-L).** Only the cheap flag + cron-auth/rate-limit checks precede the lock; discovery/read/derive/order/select/process all follow it; single bounded read per store per run (no O(F²) re-scan).
- **SC-6 — Reconciling, non-lying diagnostics (§9).** Distinct `discovered/malformed/eligible/selected/deferred[_by_cap/_by_deadline]/processed/backlog/oldest-age`; the §10 identities hold; contention ≠ empty; partial write ≠ success; deferral ≠ failure ≠ rejection; no entity id as a metric label.
- **SC-7 — Idempotent replay proof (RI-0, B6/B7).** Multi-worker overlap (409, no duplicate) and crash/replay (no loss, no duplicate) demonstrated by failure-injection tests (T-1…T-3, T-8, T-9).
- **SC-8 — H-1 unlock-throw fix.** Swallow/log `pg_advisory_unlock` rejection so a successful idempotent run is not misreported as 500 (LK-6; spec R6/H-1).
- **SC-9 — Full §11 failure-injection matrix (T-1…T-18) green**, plus the mandatory Gate B5 benchmark (ceiling-sized capture and settlement within the effective deadline at representative archive depth).

**These are conditions ON Stage 2, not blockers in the existing substrate** — the substrate itself carries no repository blocker (M9 closure: none; Stage 1: BF-S1 resolved).

---

## 13. Non-blocking Operational Recommendations

- **R-1** Land H-1 (unlock swallow) even if narrowly scoped — it is a real "success reported as 500" today.
- **R-2** Add a defensive assertion that a fixture's grouped rows agree on `kickoffAt`/`leagueCode` so unnormalized source can't make `capturedAt` order-dependent (Stage-1 review R2).
- **R-3** Enrich `SettlementArchiveState` with current-outcome-per-market (not just `settledFixtureIds`) so genuine corrections (SF-4) can be detected and `correctionCause` set — required before correction propagation is claimed (spec §16, Stage-1 review §16).
- **R-4** Short-circuit the derivation dependency for `healing:true` candidates (avoid a wasted fetch just to heal odds; Stage-1 review R4).
- **R-5** Emit an archive-size warning at ~50k lines / ~10 MB and document the file-adapter scaling boundary; Postgres is the escape hatch (out of scope).
- **R-6** fsync-on-append hardening + line-level quarantine tooling for torn tails (AR-0 residue; MC-5/MC-6 lineage).
- **R-7** A capture/settlement emergency kill-switch mirroring `FF_EMERGENCY_DISABLE_*` for fast operational disable independent of scheduling.
- **R-8** An evidence readiness surface (`disabled|dormant|ready|degraded|unhealthy`) that reports `degraded/unhealthy` when the archive dir is unreachable, so a config gap is visible pre-activation.

---

## 14. Final Safety Verdict

### CONDITIONALLY READY FOR STAGE 2 IMPLEMENTATION

The M9/M6/M8 substrate and the Stage-1 provider are **production-safe foundations**: the durable lock fails closed and never falls back to memory for evidence jobs; every archive reader is strict (only `ENOENT` is empty); capture is full-stream idempotent; settlement is revision-aware and idempotent; the provider is pure, deterministic, bounded, and clock-free; and rollback is a pure flag flip with no data migration. **No repository blocker exists in the substrate.**

Stage 2 is nonetheless the milestone that first performs **discovery + archive-state reads + real M6/M8 writes under load inside the lock**, and that is exactly where a production defect would be born. Stage 2 may proceed **only under the nine blocking conditions in §12** — chiefly: derive progress from the **strict** reader inside the lock (never the fail-soft view), enforce the sub-route deadline with no-new-candidate-without-budget, enforce the producer ceilings, surface every read/write failure as `failed` (never empty success), keep diagnostics reconciling and non-lying, prove overlap+replay idempotency, and land the H-1 unlock fix — all evidenced by the §11 failure-injection matrix and the Gate B5 benchmark. With those satisfied, Stage 2 preserves every M1–M9 invariant (identity, append-only, idempotency, mandatory-odds, replay determinism, fail-closed locks) and ships default-off; enabling remains an operational action gated on §10.

**Only this document was created. No runtime code, test, existing document, cron, lock, flag, archive format, environment, database, or deployment configuration was modified.**

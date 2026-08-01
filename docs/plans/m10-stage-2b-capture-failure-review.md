# M10 Stage 2B — Capture Wiring — Failure-Mode Review

**Review type:** Read-only failure-mode analysis of the **capture** wiring (Stage 2B). **No code, tests, or existing documents were modified; no cron, lock, flag, archive format, environment, database, or deployment change was made.** The only file created is this document.
**Kapsam (TR):** Sadece capture wiring için çökme/yarış/duplikasyon analizi — kod yazılmadı, yalnızca bu inceleme dosyası oluşturuldu.
**Date:** 2026-07-30
**Reviewer:** Production Safety Reviewer, Sprint 23B / M10 Stage 2B.
**Under review (planned):** wiring the Stage-1 capture producer (`buildCaptureCandidates`) into `runEvidenceCaptureJob({ candidates })` **inside the durable lock**, with archive-derived capture progress (`capturedWindowKeys` / `partialWindowKeys`), bounded processing through M6 + the mandatory-odds pairing (C5), and aggregate diagnostics.
**Scope note:** capture only. Settlement wiring is out of Stage 2B and out of this review (see the Stage 2 production-safety review for settlement).
**Method:** every `file:line` was read from the current repository; the capture service, runner, locks, file adapters, and Stage-1 provider were inspected directly.

---

## 1. Executive Verdict

### CONDITIONALLY SAFE TO IMPLEMENT — capture wiring introduces no *new* corruption path the substrate cannot already detect, but its correctness depends on four capture-specific conditions being honoured.

The capture substrate is **fail-closed and idempotent**: the durable advisory lock fails closed in production and never falls back to memory for evidence jobs (`locks.ts:27-41`); `captureEvidenceSnapshot` is full-stream idempotent (`capture.ts:89-105`); the immutable append rejects a same-id/different-hash write as `immutable_violation` (`rules.ts:32-38`); the mandatory-odds pairing (C5) treats a snapshot with zero odds records as a **failed** capture (`capture-run.ts:127-146`, `mandatory-odds.ts:71-77`); every archive reader is strict (only `ENOENT` is empty — `file.ts:73-126`, odds `file.ts:74-104`, provider `file.ts:90-123`); and the Stage-1 producer is pure, deterministic, bounded, and clock-free (`capture-provider.ts:11-12`).

The capture-specific hazards Stage 2B must not re-open:

- **PP-1 (partial-pair heal is derivation-gated).** A snapshot lives in `snapshots.ndjson`; its mandatory odds live in a **separate** file via a **separate, non-atomic** append (`odds-archive/file.ts:128-166`). A crash/deadline/write-failure between them leaves a snapshot with no (or incomplete) odds. Healing happens **only if Stage 2B classifies the window as `partialWindowKeys` and injects it** — because `capturedWindowKeys` is rejected *first* (`eligibility.ts:83-89`) and an excluded window is never processed. A "complete" mis-derivation = a **permanently zero-odds capture (DoD-5 violation)**.
- **RC-1 (single-writer rests entirely on the durable lock).** The evidence adapter's read→decide→append has **no in-process mutex** (`file.ts:171-193`; only odds/provider have a *per-process* `serializeAppend`, which gives **zero** cross-process protection). Cross-process concurrent capture is prevented **only** by the durable lock. If the lock degrades (misconfig), concurrent capture yields duplicate lines (benign if deterministic) or **conflicting poisoned lines** (if candidate production is nondeterministic).
- **AC-1 (one torn line halts the whole pipeline).** No fsync on append (`file.ts:145-149`) + a single shared `snapshots.ndjson` + a reader that **throws on the first malformed line anywhere in the file** (`file.ts:113-118`) means one torn tail line makes capture (and settlement) fail-closed for **all** fixtures until the file is quarantined/repaired. Fail-closed, not silent — but high blast radius.
- **DL-1 (no internal deadline).** `runWithLock` has no deadline (`runner.ts:55-138`); only the route `maxDuration = 60` bounds it, and `DEFAULT_CAPTURE_MAX_FIXTURES = 500` is over budget (`config.ts:40`). Stage 2B must clamp the ceiling (≤150, default 100) and enforce a sub-route deadline that **starts no candidate without sufficient remaining budget**.

None of these requires a frozen-contract change; all are additive conditions at the capture-wiring boundary. Hence **conditionally safe**, with the blocking conditions in §12.

---

## 2. The capture wiring under review (verified shape)

```
POST /api/internal/cron/evidence-capture  (maxDuration=60, force-dynamic)      [route.ts]
  → handleCronPost: cron auth + rate-limit (6/60s)  — no archive touch          [cronHandler.ts:18-44]
  → runEvidenceCaptureJob():
       isCaptureEnabled(env)?  no → flagSkippedJob (409, NO lock, NO work)       [runner.ts:288]
       → runWithLock("evidence_capture", requireDurable=true):                    [runner.ts:72-74]
            durable lock via EVIDENCE_DATABASE_URL; prod-absent/unreachable/memory → null → skipped/409  [locks.ts:27-62]
            === Stage 2B ADDS, ALL INSIDE THE LOCK (INV-L): ===
            (a) discover source rows (loadPublishedDailyPredictions)
            (b) derive capturedWindowKeys / partialWindowKeys from STRICT reads of snapshots + odds
            (c) buildCaptureCandidates(input, deps)  — bounded, deterministic     [capture-provider.ts:201-243]
            (d) runCaptureBatch(deps, candidates):                                 [capture-run.ts:88-165]
                  per candidate: captureEvidenceSnapshot → C5 ensureMandatoryCaptureOdds
            === end Stage 2B ===
       → hardFailed = writeFailed>0 || immutableViolation>0 → failed(+code)        [runner.ts:301-306]
       → finally: lock.release()  (unlock throw → 500, H-1)                        [runner.ts:135-137, cronHandler.ts:47]
  → 200 succeeded / 409 skipped / 500 failed ; no-store ; noindex                 [cronHandler.ts:60-78]
```

Idempotency chain for a capture window (defense in depth):
1. **Stage 2B pre-filter** — `capturedWindowKeys` excludes known-complete windows (`eligibility.ts:83-85`). *Optimization, not the guarantee.*
2. **capture.ts full-stream pre-check** — finds any snapshot with `capturedAt === anchor && capturedBy === CAPTURE_ENGINE` → `already_exists` (`capture.ts:103-105`). *Primary same-window idempotency* (bounded to the last `EVIDENCE_HISTORY_MAX_LIMIT = 200` snapshots for the fixture).
3. **store decideSnapshotAppend** — same id+hash → `duplicate`; same id, different hash → `immutable_violation`; sequence not head+1 / previousSnapshotId mismatch → `sequence_conflict` (`rules.ts:25-67`, over the **full unbounded** stream `snapshotsFor`). *Backstop, but matches by full id (incl. sequence), not by (fixtureId, capturedAt).*

---

## 3. Duplicate Capture (DC)

| # | Trigger | Substrate behaviour (verified) | Verdict / required Stage-2B behaviour |
|---|---|---|---|
| **DC-1** | Same window injected twice in one batch | Provider groups per fixture and dedups repeated `marketKey` (`capture-provider.ts:126-129`); one fixture ⇒ one window ⇒ one candidate. Second identical → `already_exists`. | Safe. **Keep within-batch grouping/dedup.** |
| **DC-2** | Re-fire (next cron) of an already-captured window | pre-check → `already_exists`; C5 re-ensures odds idempotently (byte-identical → `duplicate`). No new snapshot, no new identity. | Safe (idempotent re-fire). |
| **DC-3** | Stage 2B `capturedWindowKeys` derivation misses a captured window | capture.ts pre-check still finds the snapshot → `already_exists` (as long as it is within the last 200 for the fixture). | Safe via pre-check backstop; the derivation is a pre-filter, **not** the guarantee. Do not weaken pre-check reliance. |
| **DC-4** | Fixture accumulates > 200 snapshots, older same-window snapshot beyond the pre-check tail | pre-check misses it (bounded to 200); mint proceeds with `sequence = head+1` → **different id** (id binds sequence) → `decideSnapshotAppend` does **not** match by (fixtureId, capturedAt), only by id/sequence-chain → a **second snapshot for the same window** could append (valid chain, semantic duplicate). | **Practically unreachable** (capture = one window/fixture ⇒ ~1 snapshot/fixture; repeated fires hit the pre-check). Flagged as a low-severity caveat; the real guarantee is one capturedAt per fixture. Do not let Stage 2B mint a *second distinct capturedAt* for the same pre-kickoff window (identity/back-dating rule, spec §6.3). |
| **DC-5** | Two capture jobs run concurrently **with** the durable lock held | Loser polls ≤1 s then `null` → `skipped` → 409 (`locks.ts:64-90`). Only one discovers/mints. | Safe. **409 never 500** (except the H-1 unlock case, §7). |
| **DC-6** | Two capture jobs concurrent **without** a durable lock (misconfig) | See **RC-1** (§8): duplicate or conflicting lines. | **Blocking dependency** on LK/RC-1: assert durable lock held before any discovery/mint. |

**Duplicate-capture invariant (DC-0):** one `capturedAt` per fixture per pre-kickoff window; every duplicate path collapses to `already_exists`/`duplicate` **provided** (a) the durable lock is held (RC-1) and (b) candidate production is deterministic (RC-2). Neither the Stage-2B `capturedWindowKeys` pre-filter nor the 200-bounded pre-check may be treated as the sole guarantee.

---

## 4. Partial Pair (PP)

**Root cause (verified):** a capture event = one `EvidenceSnapshot` in `snapshots.ndjson` (evidence store) **plus** one mandatory `evidence_capture` odds record **per supported market** in a separate odds file (`mandatory-odds.ts:110-160`). These are **two different stores, two different files, two non-atomic `appendFile` calls** (`file.ts:145-149`, `odds-archive/file.ts:160-166`). Any interruption between them → snapshot present, odds absent/incomplete = **partial pair**.

| # | Situation | Behaviour | Required Stage-2B behaviour |
|---|---|---|---|
| **PP-1** | Snapshot committed, odds append fails (`write_failed`/`immutable_violation`) | `ensureMandatoryCaptureOdds` → `{ok:false}` → capture counted `writeFailed`/`immutableViolation`, run `failed` (`capture-run.ts:138-146`). Snapshot persists as a partial pair. | Report `failed` (never `captured`); a zero/partial-odds snapshot is **not** a success (DoD-5). |
| **PP-2** | Snapshot with N markets, only M<N odds records written before interruption | Odds are appended per market in a loop (`mandatory-odds.ts:139-159`); a mid-loop stop leaves some markets without their record. | **Partial detection must be per-market:** a window is complete **iff** every supported market has its odds record. Fewer odds records than `snapshot.supportedMarkets` ⇒ `partialWindowKeys`. |
| **PP-3** | Heal on re-fire | pre-check → `already_exists` with the existing snapshot → C5 re-ensures **all** markets' odds (existing → `duplicate`, missing → `appended`) (`capture-run.ts:127-146`). No new snapshot, no new identity. | Deterministic idempotent heal. Healing runs for **any injected candidate** reaching `created`/`already_exists` — normal or `healing:true`. |
| **PP-4** | Window mis-derived as **complete** and thus **excluded** | `eligibility.ts:83-85` rejects `capturedWindowKeys` as `already_captured` *before* the partial branch (`:86-89`) → the window is **never injected** → C5 heal **never runs** → **permanent zero/partial-odds capture**. | **Blocking:** never place a window in `capturedWindowKeys` unless snapshot **and all** mandatory odds exist; when uncertain, classify **partial** (fail toward healing). Ensure the two sets are disjoint and `partialWindowKeys` is honoured. |
| **PP-5** | Odds-only orphan (odds record exists, snapshot absent) | pre-check finds no snapshot → mints one → C5 heals odds (existing → `duplicate`). The orphan odds record is keyed by the `captureId` the snapshot reproduces. | Treat odds-only as **not captured** (mint). Do not treat an orphan odds record as evidence of a captured window. |

**Partial-pair invariant (PP-0):** completeness = snapshot **AND** one odds record per supported market; anything less is `partialWindowKeys` (heal), never `capturedWindowKeys` (skip). The heal only fires when the window is injected, so mis-derivation, not the substrate, is the failure surface.

---

## 5. Crash (CR)

Crash = process/host death or platform hard-kill at any point. No fsync (`file.ts:145-149`), so a crash mid-`appendFile` can leave a torn final line.

| # | Crash point | Result | Recovery |
|---|---|---|---|
| **CR-1** | Before snapshot append | Nothing written. | Re-fire re-derives (INV-A) and mints. No loss, no duplicate. |
| **CR-2** | After snapshot, before any odds | Partial pair (PP). | Re-fire heals (PP-3) **iff** derived `partialWindowKeys` (PP-4). |
| **CR-3** | After snapshot + M of N odds | Per-market partial pair (PP-2). | Re-fire re-ensures all N (missing appended, present duplicated). |
| **CR-4** | Mid-`appendFile` (torn line) — snapshot file | Torn last line in `snapshots.ndjson`. | Next strict read **throws** `malformed NDJSON` (`file.ts:113-118`) → capture pre-check → `archive_error` → job `failed` (`capture.ts:96-100`). **Blast radius = the whole file** (all fixtures), until quarantine (see AC-1). |
| **CR-5** | Mid-`appendFile` — odds file | Torn line in the odds records file. | Next odds read throws → `ensureMandatoryCaptureOdds` `write_failed` → `failed`; and the odds file is unreadable for all captures until repaired. |
| **CR-6** | While durable lock held | PG session dies → advisory lock **auto-released** by Postgres. | Re-fire acquires cleanly; committed appends persist; pending recomputed from archive (INV-A). |

**Crash invariant (CR-0):** every crash leaves a state that a deterministic re-fire either completes (partial pair → heal) or re-mints (nothing written) with **no duplicate and no false success** — **provided** (a) the torn-line case (CR-4/CR-5) is detected and quarantined (AC-1), and (b) partial pairs are derived as partial (PP-4). The substrate never silently loses or fabricates; the only crash risk is availability (one torn line halts the file) and the derivation-gated heal.

---

## 6. Retry (RT)

**No internal retry wrapper exists** in the capture/runner/store paths (verified: no retry/backoff loop in `lib/jobs`, `lib/evidence-capture/jobs`, `lib/evidence-capture/capture`, `lib/archive/evidence`). Retries are **external** — the scheduler re-fires the cron; each fire is one bounded, idempotent pass.

| # | Retry situation | Behaviour | Verdict |
|---|---|---|---|
| **RT-1** | Re-fire after a `write_failed` run | Snapshot `already_exists` (if it committed) + odds heal; or fresh mint (if nothing committed). Idempotent. | Safe. Transient write failures self-heal on re-fire. |
| **RT-2** | Re-fire after `immutable_violation` | The conflicting same-id/different-hash line persists → the same `immutable_violation` recurs → run keeps reporting `failed` (`runner.ts:306`). | **Not a corrupting loop, but a stuck fixture.** Must **not** be blind-retried into a storm; alert + operator (determinism bug or quarantine). No internal retry means no hidden storm — good. |
| **RT-3** | Overlapping retry (re-fire while previous still running) | Durable lock → loser 409 `lock_unavailable` (`runner.ts:75-85`). | Safe. No concurrent retry executes. |
| **RT-4** | Retry after a torn-line crash (CR-4) | Strict read throws every fire until quarantine → every retry `failed`. | Fail-closed, but **retry cannot self-repair a torn line** — needs the sweep + quarantine (AC-1). Retries alone loop on failure. |

**Retry invariant (RT-0):** retries are external, serialized by the lock, and idempotent; `immutable_violation` and torn-line failures are **operator-escalation** states (not self-healing by retry) and must be alerted, never blind-looped. Diagnostics must distinguish a *transient* `write_failed` (retry helps) from a *stuck* `immutable_violation`/corruption (retry does not).

---

## 7. Archive Corruption (AC)

Strict-reader behaviour (verified): only `ENOENT` → empty; `EACCES/EPERM`, `EIO/EBUSY/ENXIO/ENODEV`, malformed JSON (per line), and any other errno → **throw**; the file is never rewritten (`file.ts:73-126`; odds/provider identical).

| # | Corruption | Behaviour | Required fail-closed handling |
|---|---|---|---|
| **AC-1** | **Torn / malformed line anywhere in `snapshots.ndjson`** | `readNdjson` throws on the **first** malformed line encountered across the **whole file** → capture pre-check → `archive_error` → run `failed`. **Every fixture** blocked, not just the corrupt one. | Defer the run + **alert**; quarantine/repair is manual/out-of-band. Never treat as "0 candidates / empty success." High-blast-radius availability event — the scheduled `verifyEvidenceChain` sweep is the required detector. |
| **AC-2** | Permission error (EACCES/EPERM) | Throws (`file.ts:81-86`). | Defer + `failed`; this is an activation-precondition failure (archive ownership), not empty history. |
| **AC-3** | I/O / stale-NFS error | Throws (`file.ts:88-95`). | Defer + `failed`; never empty. |
| **AC-4** | Disk full on append (`ENOSPC`) | `appendFile` throws → `write_failed` (`file.ts:150-158`, odds `:160-165`). | `failed` + alert; re-fire idempotent once space is freed. |
| **AC-5** | Duplicate identical lines (same id, same hash) | Read dedups by id (`byId`, odds `file.ts:114-116`); append → `duplicate`. | Benign; harmless. |
| **AC-6** | Conflicting lines (same id, **different** hash) | Append → `immutable_violation`; a pre-existing conflict is flagged by the integrity sweep, not a plain read. | **Poisoned window:** defer + alert; never re-mint over it. Indicates a determinism leak (RC-2). |
| **AC-7** | Schema-valid JSON, semantically invalid record | Parses; enters the derived set; frozen builders/append rules reject it downstream. | Derivation must be defensive: a record with malformed identity fields must not be trusted to **suppress** a legitimate capture; prefer defer+alert over silent trust. |

**Corruption invariant (AC-0):** any non-`ENOENT` read failure ⇒ run/fixture **deferred and reported `failed`**, never counted as empty/zero-candidate success (the exact trap M9 G6 closed on the write path — Stage 2B must not re-open it on the discovery/derive path). Because reads throw on the whole file, a single torn line is a pipeline-wide fail-closed stop — availability, not integrity, is the exposure; fsync + sweep + quarantine are the mitigations (§13).

---

## 8. Deadline (DL)

**Verified gap:** `runWithLock` has **no internal deadline** (`runner.ts:55-138`); only `maxDuration = 60`. `DEFAULT_CAPTURE_MAX_FIXTURES = 500` is over budget (`config.ts:40`) and `readPositiveInt` fails safe *to that 500* (`config.ts:50-56`). Capture is the steep O(F²) curve: the pre-check reads the full snapshot stream per fixture and each odds append reads the full odds file per market (mandatory-odds amplification).

| # | Deadline expiry point | Risk | Required behaviour (INV-C/INV-D) |
|---|---|---|---|
| **DL-1** | Before discovery | — | If remaining < a discovery reserve → empty-safe `succeeded` zero-count; release lock. |
| **DL-2** | After selection, before first candidate | — | Check remaining before candidate 1; if insufficient, defer the whole set (`_by_deadline`). |
| **DL-3** | Between candidates | Starting candidate k+1 with no budget → platform kill mid-write (torn line, AC-1). | **Start no new candidate without `remaining ≥ worstCasePerCandidate`;** stop and defer the rest, counted. |
| **DL-4** | During one candidate (fetch/derive/write) | M4 fetch/derive overruns. | Pass the **clamped** deadline / AbortSignal into fetch (`runDeadlineMs` must be the clamped ≤45 s value, never the 300 s default); a killed single write is recovered idempotently. |
| **DL-5** | Before diagnostics serialization | Work commits but the 200/JSON never returns → caller sees a timeout/5xx for a run that actually succeeded. | Reserve ~15 s HEADROOM for write-drain + diagnostics + serialization. |
| **DL-6** | Platform hard-kill at 60 s | Torn tail line risk (no fsync). | Stage-2B deadline must fire **before** the platform's, so shutdown is a clean deferral, not a mid-write kill. |

**Deadline invariant (DL-0):** `effectiveJobDeadlineMs = min(configured, 60_000 − HEADROOM) ≤ 45_000`; **no new candidate starts without sufficient remaining budget**; the capture ceiling is `clamp(configured,1,150)` default 100 (never 500, never unbounded); deferrals are counted, never dropped; the ceiling-sized capture run must be benchmarked within budget at representative archive depth before the deadline+workload combination is accepted.

---

## 9. Race Conditions (RC)

| # | Race | Analysis (verified) | Required invariant |
|---|---|---|---|
| **RC-1** | **Cross-process concurrent capture** | The evidence adapter's read→decide→append is **not atomic and has no in-process mutex** (`file.ts:171-193`). The odds/provider adapters' `serializeAppend` (`odds-archive/file.ts:43`, `provider-archive/file.ts:54`) is a **per-process** promise chain — **zero** cross-process protection. So cross-process single-writer rests **entirely** on the durable advisory lock (`runner.ts:72-74`, `locks.ts:27-41`). Without it (no `EVIDENCE_DATABASE_URL`, `NODE_ENV≠production`, `JOB_LOCK_ADAPTER=memory`, or two hosts sharing the dir but not the lock DB): two writers read the same head, both mint `sequence = head+1`, both `appendFile` → **two lines**. Deterministic content ⇒ same id+hash ⇒ benign duplicate (collapsed on read). Nondeterministic content ⇒ same id, different hash ⇒ **conflicting poisoned lines** (AC-6). | **Assert the durable lock is held** (fail closed) before any discovery/mint; never rely on `serializeAppend` for cross-process safety; keep `NODE_ENV=production` + `EVIDENCE_DATABASE_URL` an activation precondition. |
| **RC-2** | **Nondeterminism leak into a candidate** | If `capturedAt`/`modelInput` vary across a retry/worker (clock/random/config), the same (fixtureId, capturedAt, sequence) yields a different `contentHash` → `immutable_violation` on the second write (poisoned window). | Candidate production must be a pure function of retained/source data + injected evalInstant (Stage-1 is; §5 spec determinism note). A2/A4 tests guard it. |
| **RC-3** | **Discovery/derivation outside the lock (INV-L)** | Two workers reading the archive at different heads derive divergent `capturedWindowKeys`/`partialWindowKeys` → both process the head, overlap, backlog/oldest-age accounting diverges; idempotency still prevents a duplicate mint, but wastes provider spend and skews metrics/starvation accounting. | Discovery + strict archive-state reads + ordering + selection + processing all **inside** the held lock; single bounded read per store per run. |
| **RC-4** | **Read-then-write TOCTOU within one locked run** | Under the lock a single writer reads the head then appends; no concurrent writer exists, so the pre-check→append window is safe. | Preserve one-writer-under-one-lock; do not add a second lock (no nesting/ordering). |
| **RC-5** | **Snapshot/odds cross-store non-atomicity** | Snapshot and odds are separate non-atomic appends (§4) → partial pair. | Covered by PP-0 (heal via partial derivation). This is a *sequencing* race, resolved by idempotent heal, not by a lock. |

**Race invariant (RC-0):** capture single-writer is guaranteed **only** by the durable lock; determinism prevents same-id hash conflicts; and all authoritative discovery/derivation runs inside the lock. Remove any one and duplicate/poison/starvation risks reappear (all still *detectable*, none silent).

---

## 10. Cross-cutting capture-wiring invariants (summary)

- **CW-1 (lock).** Durable lock held before any discovery/mint; production fail-closed, no memory fallback; overlap → 409 never 500; single non-nested lock released in `finally`; land H-1 so a successful run whose `pg_advisory_unlock` throws (`locks.ts:76-83` → propagates → `cronHandler.ts:47` → 500) is not misreported.
- **CW-2 (strict reads inside lock).** Derive `capturedWindowKeys`/`partialWindowKeys` from the **strict throwing** store reads inside the lock; never a fail-soft/catch-to-empty path; any non-ENOENT failure ⇒ `failed`, never empty.
- **CW-3 (partial-pair completeness).** Complete = snapshot **AND** one odds record per supported market; anything less is `partialWindowKeys` (heal), disjoint from `capturedWindowKeys`; fail toward healing when uncertain.
- **CW-4 (determinism).** `capturedAt`/`modelInput`/provenance are pure functions of source + injected evalInstant; no clock/random; forward-only (never back-date a past window, spec §6.3).
- **CW-5 (bounded + deadline).** Ceiling `clamp(configured,1,150)` default 100; sub-route deadline ≤45 s; no new candidate without budget; overflow/deadline deferrals counted, never dropped.
- **CW-6 (fail-closed accounting).** `write_failed`/`immutable_violation`/read-throw ⇒ `failed`; a snapshot without complete odds is never `captured`; contention ≠ empty; corruption ≠ zero candidates; deferral ≠ failure ≠ rejection.

---

## 11. Required capture failure-injection tests (Stage 2B must ship)

| # | Scenario | Assertion |
|---|---|---|
| **CT-1** | Two concurrent capture fires (lock held) | One discovers/mints; other → 409 `lock_unavailable`; no second mint; archive identical to a single fire. |
| **CT-2** | Capture with **no** durable lock available (prod) | `skipped`/409; no discovery/fetch/read/write; not counted as empty success. |
| **CT-3** | Cross-process concurrency **without** lock (negative test / documented) | Demonstrate that only the durable lock prevents duplicate/conflicting lines; assert the wiring refuses to run unlocked in production. |
| **CT-4** | Snapshot committed, odds append fails | Run `failed`; snapshot is a partial pair; not counted `captured`. |
| **CT-5** | Partial-pair re-fire (snapshot present, odds missing) | Injected as `partialWindowKeys` → heal: `already_exists` + odds appended; no duplicate snapshot; idempotent. |
| **CT-6** | Per-market partial (N markets, M<N odds) | Derivation classifies the window **partial**; heal writes the remaining N−M; no window marked complete with missing markets. |
| **CT-7** | Complete window mis-derived as partial / partial mis-derived as complete | Complete-as-partial → heal is a safe no-op (all `duplicate`); partial-as-complete is **rejected by test** (must fail toward healing). |
| **CT-8** | Torn/malformed line in `snapshots.ndjson` | Strict read throws → run `failed`; **no duplicate mint**, **no empty success**; alertable; blast radius asserted (all fixtures blocked). |
| **CT-9** | Torn line in the odds file | `ensureMandatoryCaptureOdds` `write_failed` → `failed`; no partial success counted. |
| **CT-10** | Crash after N of M candidates | N committed (each with complete odds); re-fire completes M−N from archive-derived pending; no duplicate, no permanent skip. |
| **CT-11** | `immutable_violation` (same id, different hash) | Reported `failed`+`immutable_violation`; **not** blind-retried into a storm; alertable; distinguished from transient `write_failed`. |
| **CT-12** | Deadline exhaustion mid-batch | No new candidate starts past budget; remainder `deferred_by_deadline`; committed candidates intact; re-fire completes remainder. |
| **CT-13** | Ceiling fail-safe (0 / negative / NaN / >150) | Clamps to `[1,150]` default 100; never 500, never unbounded. |
| **CT-14** | Duplicate source rows (same fixture ×N, same marketKey ×N) | Grouping/dedup → one window; `already_exists`/`duplicate`; no duplicate mint. |
| **CT-15** | Fail-soft-view guard (static/behavioural) | Progress derivation does **not** use any catch-to-empty read path; corrupt archive never yields an empty progress set. |
| **CT-16** | Determinism / replay | No `Date.now`/`Math.random` in the capture producer path; M7 serialization-boundary replay passes over M10-produced captures. |

---

## 12. Blocking Stage 2B conditions

Capture wiring MUST satisfy all of the following (each additive; no frozen-contract change):

- **B-1 (RC-1/CW-1).** Discovery + archive-state reads + mint occur only under the held durable lock; production fail-closed (no memory fallback); assert the lock, never rely on `serializeAppend` for cross-process safety.
- **B-2 (PP-0/CW-3).** Per-market partial-pair derivation: complete = snapshot **and all** mandatory odds; anything less is `partialWindowKeys` (heal), disjoint from `capturedWindowKeys`; fail toward healing. A window is never excluded while its odds are incomplete.
- **B-3 (AC-0/CW-2).** Strict, in-lock reads for progress derivation; any non-ENOENT failure ⇒ `failed`, never empty; corrupt/conflicting lines poison the window (defer + alert), never re-minted.
- **B-4 (DL-0/CW-5).** Ceiling `clamp(configured,1,150)` default 100; sub-route deadline ≤45 s; no new candidate without sufficient remaining budget; deferrals counted.
- **B-5 (RC-2/CW-4).** Deterministic candidate production (pure of source + injected evalInstant; no clock/random; forward-only); guarded by a determinism + M7 replay test.
- **B-6 (CW-6).** Non-lying capture diagnostics: `write_failed`/`immutable_violation`/read-throw ⇒ `failed`; snapshot-without-complete-odds ≠ `captured`; contention ≠ empty; corruption ≠ zero candidates; deferral ≠ failure ≠ rejection; no entity id as a metric label.
- **B-7 (H-1).** Land the `pg_advisory_unlock` swallow/log so a successful idempotent capture is not reported as 500.
- **B-8.** The §11 capture failure-injection matrix (CT-1…CT-16) green, plus the ceiling-sized capture benchmark within the effective deadline at representative archive depth.

---

## 13. Non-blocking operational recommendations

- **N-1 (AC-1 mitigation).** fsync-on-append for `snapshots.ndjson`/odds files (removes the torn-tail window); pair with a scheduled `verifyEvidenceChain` sweep + a line-level quarantine/repair tool, since one torn line halts the whole file fail-closed.
- **N-2.** Emit an archive-size warning at ~50k lines / ~10 MB and document the file-adapter scaling boundary (Postgres is the out-of-scope escape hatch that turns O(A) into O(log A)).
- **N-3 (heal efficiency).** Short-circuit the derivation dependency for `healing:true` candidates (avoid a wasted M4 fetch just to append missing odds; Stage-1 review R4).
- **N-4.** A capture emergency kill-switch (mirroring `FF_EMERGENCY_DISABLE_*`) for fast operational disable independent of scheduling.
- **N-5.** A capture readiness signal (`disabled|dormant|ready|degraded|unhealthy`) that reports `degraded/unhealthy` when the archive dir is unreachable, so a permission/ownership gap is visible pre-activation rather than as a wall of `failed` runs.
- **N-6 (defensive grouping).** Assert a fixture's grouped rows agree on `kickoffAt`/`leagueCode` so unnormalized source can't make `capturedAt` order-dependent (Stage-1 review R2).

---

## 14. Final Verdict

### CONDITIONALLY SAFE TO IMPLEMENT (capture wiring)

The capture substrate is idempotent and fail-closed by construction: the durable lock is the single-writer guarantee, `captureEvidenceSnapshot` is full-stream idempotent, the immutable append detects same-id/different-hash conflicts, the mandatory-odds pairing makes a zero-odds snapshot a failed capture, and every reader throws rather than masking corruption as empty. **No capture failure path produces a silent duplicate, a false success, or immutable-data corruption** — the residual risks are (a) an availability stop when one torn line halts the shared file, and (b) a **derivation-gated** partial-pair heal that persists a zero-odds capture if the window is mis-classified as complete.

Stage 2B capture wiring may proceed **only under the eight blocking conditions in §12** — chiefly: mint only under the asserted durable lock (single-writer rests entirely on it); derive per-market partial-pair completeness and fail toward healing; strict in-lock reads with every non-ENOENT failure surfaced as `failed`; a clamped ceiling + sub-route deadline that starts no candidate without budget; deterministic candidate production; non-lying diagnostics; the H-1 unlock fix; and the §11 failure-injection matrix + benchmark green. With those satisfied, capture wiring preserves every M1–M9 invariant (identity, append-only, idempotency, mandatory-odds, replay determinism, fail-closed lock) and ships default-off; enabling remains an operational action.

**Only this document was created. No runtime code, test, existing document, cron, lock, flag, archive format, environment, database, or deployment configuration was modified.**

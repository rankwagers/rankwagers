# M10 Stage 2C — Settlement Pipeline Wiring — Production-Safety & Failure-Mode Review

**Review type:** Planning / production-safety review of the **not-yet-built** Stage 2C settlement wiring. **No code or tests were modified.** The only file created is this document.
**Date:** 2026-07-30
**Reviewer:** Production-Safety & Failure-Mode Reviewer, Sprint 23B / M10 Stage 2C.
**Inputs read:** `m10-live-candidate-pipeline-specification.md` (Rev A1, INV-A/C/D/L/S); Stage 2A (`m10-stage-2a-archive-normalization.md`, `…-implementation-review.md`); Stage 2B (`…-2b-capture-pipeline-wiring.md`, `…-2b-production-safety-review.md`, `…-2b-capture-failure-review.md`); the broad `m10-stage-2-production-safety-review.md`; all M8 docs (`m8-settlement-{architecture,implementation,implementation-review,production,failure,migration,performance}-review.md`) + `tests/evidenceSettlement.test.ts`; M7 identity docs; M9 lock/runner (`m9-activation-*`).
**Code inspected (file:line):** `lib/evidence-capture/settlement.ts` (full); `lib/evidence-capture/outcomes.ts`; `lib/evidence-capture/jobs/settlement-run.ts` (full); `lib/evidence-capture/candidates/settlement-provider.ts` (full); `lib/evidence-capture/candidates/eligibility.ts` (settlement classifier); `lib/evidence-capture/candidates/archive-state/{normalize,types,builders}.ts`; `lib/evidence-capture/candidates/types.ts` (`ValidationHead`/`currentValidationHeads`); `lib/archive/evidence/rules.ts` (`decideValidationAppend`); `lib/validation/records.ts` (`createValidationRecord`/`reviseValidationRecord`/`currentValidationRevisions`); `lib/archive/evidence/file.ts` (strict reads); `lib/jobs/{runner,locks,cronHandler}.ts`; `app/api/internal/cron/prediction-settlement/route.ts`.
**Substrate baseline re-run this pass:** `evidenceSettlement` + `evidenceArchiveStateBuilders` + `evidenceCandidateProvider` + `m9Concurrency` + `m9Activation` = **136/136 pass**.

---

## 1. Executive Summary

**Stage 2C is UNBUILT** (verified): there is no `settlement-pipeline.ts`, no `readAllValidationsStrict` (Stage 2B added only `readAllSnapshotsStrict`), `runPredictionSettlementJob` has **no** `provideCandidates`/`discover` seam (only a static `candidates` array), and the settlement cron route still runs the M9 empty-safe pass. This review therefore defines the **exact safety conditions the Stage 2C implementation must satisfy**, by analogy to the already-passed Stage 2B capture wiring plus the settlement-specific hazards (terminal lifecycle, first-settlement vs correction, revision chains).

**The substrate Stage 2C will build on is sound and fail-closed:**
- **M8 `settleSnapshot`** is idempotent and revision-aware: no head → first settlement (`createValidationRecord`, revision 1); head with the same state → `no_change` (no append); head with a changed state → **requires an explicit `correctionCause`, else `invalid_input`** (`settlement.ts:288-323`). Immutable violations stay loud (`:336-340`).
- **The frozen store append (`decideValidationAppend`)** enforces the revision chain over the **full** fixture stream: same `revisionId`+hash → duplicate; same `revisionId`+different hash → `immutable_violation`; unknown snapshot → `invalid_record`; wrong revision / wrong `supersedesRevisionId` → `revision_conflict` (`rules.ts:76-131`). This is the cross-worker backstop.
- **Stage 2A `normalizeSettlementArchiveState`** derives `settledFixtureIds` (current head state ≠ `pending`) and `currentValidationHeads`, and **throws `ArchiveStateConflictError`** on same-`revisionId`/different-hash or ambiguous `(validationId, revision)` (`normalize.ts:159-172`). Builders never catch; reads are strict.
- **The Stage-1 settlement provider is first-settle-only:** it excludes `settledFixtureIds` (binary `already_settled`) and **never sets `correctionCause`** (`settlement-provider.ts:100-104,157-166`). It carries the BF-S1 terminal-lifecycle boundary (postponed/cancelled/abandoned are written terminals; non-terminal → deferred).
- **Settlement has no non-atomic pair.** Unlike capture (snapshot + separate odds file), settlement writes **only** `ValidationRecord`s to one file, one atomic line per market — so there is **no partial-pair class**; a partial batch is simply "some settled, some deferred," idempotently completable on re-fire.

**No design blocker exists**, and every mandatory condition is satisfiable additively without touching a frozen contract. The single most important settlement-specific safety rule: **Stage 2C must be first-settlement-only — never set `correctionCause`, always exclude `settledFixtureIds`** — so that no false correction and no spurious revision can be produced (corrections belong to Stage 3 via `currentValidationHeads`). Deadline/diagnostics/live-activation are correctly deferred and are **not** required for Stage 2C unless they would prevent an immediate correctness regression (they do not, because the route stays dormant).

**Verdict: STAGE 2C SAFETY CONDITIONALLY READY** — implementable under the blocking conditions in §9.

---

## 2. Failure Matrix

Classes: **safe no-op** · **deferred** (counted/rejected, re-derived next fire) · **failed** (run reports `failed`→500, no false-success masking) · **retryable** (durable partial progress, idempotently completed on re-fire) · **first settlement** · **correction** · **false success / corruption / starvation** = must be **none**.

| # | Failure mode | Class | Reasoning / anchor |
|---|---|---|---|
| 1 | **Strict snapshot read failure** | **failed** | Discovery: `buildSettlementArchiveState`→`readAllSnapshots` throws → producer rejects → run `failed`. M8 path: `settleLatestSnapshotForFixture`→`latestSnapshot`→`readNdjson` throws → `runSettlementBatch` per-candidate `try/catch` → `writeFailed` → `failed` (`settlement-run.ts:163-167`). No write. |
| 2 | **Strict validation read failure** | **failed** | Discovery: `readAllValidations` throws → producer rejects → `failed`. M8 path: `settleSnapshot`→`store.listValidations`→`readNdjson` throws → caught → `writeFailed` → `failed`. Fail-closed; never "0 settled". |
| 3 | **Archive conflict** (same `revisionId`/diff hash; ambiguous `(id,revision)`; snapshot hash conflict) | **failed** | Read side: `ArchiveStateConflictError` (`normalize.ts:143-172`) → producer rejects → `failed`. Append side: `decideValidationAppend`→`immutable_violation`/`revision_conflict` → `append_failed`/`immutableViolation` → `failed`. Detected, **no corruption**, never a false success. |
| 4 | **Malformed NDJSON** | **failed** | Strict readers throw `malformed NDJSON at line N`. Whole-file read ⇒ one bad line fails the pass for all fixtures (availability blast radius — §8, carry-forward). |
| 5 | **Missing file** | **safe no-op** | **Only** ENOENT ⇒ `[]`. No snapshots ⇒ nothing to settle; no validations ⇒ every terminal fixture is a first settlement. Correct first-run behaviour. |
| 6 | **Source result unavailable** (completed-rows load fails) | **failed → deferred** | Producer source load rejects → producer rejects → `failed`; no writes; next cron re-derives. |
| 7 | **Non-terminal fixture** (live/ht/scheduled/suspended) | **deferred / safe no-op** | Classifier → `fixture_not_complete` defer (BF-S1). If it reached M8, `resolveValidationOutcome`→`PENDING` → **no write** (R4). Never a premature settlement. |
| 8 | **Terminal result fetch failure** (a fixture's terminal row unavailable) | **deferred** | No candidate produced (absent from `completedRows`); re-derived next fire once available. No false settlement, no loss. |
| 9 | **Duplicate settlement candidate** (same fixture ×N / two rows same `matchId`) | **safe no-op** | Provider dedups per `fixtureId` (`settlement-provider.ts:130-139`). If two reach M8: C3 holds; the second sees the head → `no_change`, or the store idempotency collapses it. No duplicate revision. |
| 10 | **Already settled result** (fixture in `settledFixtureIds`) | **safe no-op / deferred** | Classifier → `already_settled` reject → not emitted (first-settle-only). No correction, no false success. |
| 11 | **Same result observed again** (re-fire, unchanged) | **safe no-op** | Head state == outcome state → `no_change`, no append (`settlement.ts:288-298`); or byte-identical rebuild → `duplicate`. Idempotent. |
| 12 | **Changed result requiring correction** | **deferred (Stage 3)** | Fixture is in `settledFixtureIds` → excluded (`already_settled`) → the change is **not** propagated in Stage 2C. The prior settled result stands; correction is deferred to Stage 3 (`currentValidationHeads`). A completeness gap, **not** a correctness regression, **not** a false success. |
| 13 | **False correction detection** | **safe no-op (none possible)** | Stage 2C never sets `correctionCause` and excludes settled fixtures, so the correction branch is never triggered. Even if reached: same state → `no_change`; changed state + no cause → `invalid_input` (no write). **No false correction, no spurious revision.** |
| 14 | **Correction revision race** (two workers append rev2) | **safe (winner) / failed (loser)** | Under the durable lock: serialized, impossible. Cross-process w/o lock: `decideValidationAppend` `expectedRevision`/`supersedesRevisionId` checks → the loser gets `revision_conflict` → `append_failed` → `failed`; deterministic identical content → `duplicate`. **No duplicate revision, no corruption.** (In Stage 2C the only race is on rev1 first-settlement — same guard.) |
| 15 | **Partial settlement batch** (some settle, some fault) | **retryable** | Each candidate is independent; each market append is one atomic line. Committed settlements persist; a hard fault makes the **run** report `failed`, and re-fire completes the rest (settled → `no_change`). **No partial-pair** (validations only). No loss. |
| 16 | **Process crash before append** | **safe no-op / retryable** | Outcome computed in memory; nothing persisted; lock auto-released; re-fire recomputes deterministically → first settlement. No loss. |
| 17 | **Process crash after append** | **retryable / failed** | Committed line → re-fire sees the head → `no_change` (idempotent). Torn mid-write line (no fsync) → strict read throws → `failed` until quarantine (§8 carry-forward). Detected, never silent. |
| 18 | **Retry after first settlement** | **safe no-op** | Head exists, same outcome → `no_change`, no append. Idempotent (= M9 empty pass). |
| 19 | **Retry after correction** | **safe no-op** | N/A in Stage 2C (no corrections). If a Stage-3 correction existed: re-fire with the same corrected state → `no_change`; byte-identical revision → `duplicate`. |
| 20 | **Overlapping workers** | **deferred (409)** | Distinct lock `job:prediction_settlement`; loser → `null` → `skipped`/`lock_unavailable`/**409**, does **no** discovery. Cross-process guarantee rests on `EVIDENCE_DATABASE_URL` (M9, unchanged). Discovery **must** be inside the lock (SC-2). |
| 21 | **Lock failure** | **deferred (409, fail-closed)** | `tryAcquireJobLock`→`null` (no/`memory` `EVIDENCE_DATABASE_URL` in prod, or DB unreachable) → `skipped` **before** discovery → no read/write, **no memory fallback** (`locks.ts:34-62`). |
| 22 | **Unlock failure** | **false-failure (H-1), not corruption** | `pg_advisory_unlock` throw → `cronHandler.ts:47` (no try/catch) → 500 misreporting a **committed** idempotent settlement. Unchanged from M9. Re-fire → `no_change`. Carry-forward. |
| 23 | **Route timeout** | **retryable (latent)** | No INV-D deadline. Route is **dormant** in the merged Stage-2C state (empty pass), so unreachable. When wired live: >60 s → platform kill → lock auto-released, committed validations persist, re-fire idempotent. Deadline is a live-activation gate (§10), not a Stage-2C blocker. |
| 24 | **Large archive** | **safe no-op (dormant) / carry-forward perf** | Discovery = one bounded read per store (PB-1). But the frozen M8 path re-reads whole `validations`+`snapshots` **per candidate** (`listValidations`+`latestSnapshot`) → O(F·A)≈O(F²) within a batch — bounded by the ceiling (≤150) and gated by the deadline for live activation. Unchanged frozen behaviour. |
| 25 | **Large terminal candidate set** | **safe no-op (bounded)** | Provider caps at `normalizeBatchLimit` (≤150, default 100; invalid→100) → bounded output/writes (INV-C). Classification over a huge source is O(source) compute, bounded by the deadline once live. |

**Sweep property (must hold):** across {corrupt read, conflict, source-unavailable, non-terminal, missing-score, mismatch, already-settled, changed-result} the wired settlement path yields only `safe no-op`/`deferred`/`failed`/`retryable` — **never** a false WIN/LOSS/VOID/PUSH, a duplicate/forked revision, a false correction, or a permanently starved candidate.

---

## 3. Terminal-Lifecycle Safety

- **BF-S1 boundary is correct and frozen-faithful.** `classifySettlementRow` resolves lifecycle via `resolveMatchLifecycle(row.status, kickoffUnix, minute, nowSec)` — the exact call M8 makes — and emits a candidate iff M8 would write a record: `finished` → scored (won/lost, requires `isFinished` + valid FT/HT scores); `postponed|cancelled|abandoned` → terminal non-scored (no score requirement); `live|half_time|scheduled|pre_match|suspended` → `fixture_not_complete` (defer); `unavailable`/unknown → `unsupported_outcome_state` (defer, never emits). Verified against `outcomes.ts` and `evidenceSettlement.test.ts`.
- **Pending is never persisted (R4).** A non-terminal fixture that slips through classification is `PENDING` in `resolveValidationOutcome` → `settleSnapshot` writes nothing (`settlement.ts:260-263`). No premature/false settlement is structurally possible.
- **Terminal candidates carry a valid deterministic `completionInstant`.** The provider defaults to `ISO(row.kickoff)` (`settlement-provider.ts:55-63`), a valid ISO instant, so a terminal non-scored settlement never hits M8's `invalid_timestamp` guard. **SC-4** requires Stage 2C to keep this deterministic (no wall clock).
- **C3/C4 backstops intact.** `runSettlementBatch` enforces `row.matchId === fixtureId` (C3) and non-negative-integer scores (C4) **before** any settle (`settlement-run.ts:136-151`). Stage 2C must route through `runSettlementBatch` and never bypass these.

**Terminal-lifecycle safety: sound. Stage 2C must preserve the classifier boundary and route through the C3/C4 guards.**

---

## 4. First-Settlement Safety

- **First settlement is the only write path Stage 2C exercises.** With `settledFixtureIds` excluded, every fixture reaching M8 has **no terminal head** → `settleSnapshot` takes the `!head` branch → `createValidationRecord` (revision 1, `supersedesRevisionId: null`) → append.
- **Idempotent by construction.** A re-fire of a first-settled fixture finds the head with the same state → `no_change` (no append); a byte-identical rebuild is absorbed as `duplicate` by `(revisionId, contentHash)`. `completionInstant`/`nowSec` are deterministic (source-derived), so re-derivation is byte-stable (M7/A4 property preserved — settlement identity `validationId(snapshotId, marketKey, selectionKey)` + `validationRevisionId` derive downstream, never invented by the producer).
- **Fixture correspondence guaranteed.** `settleLatestSnapshotForFixture` settles the **latest** snapshot by frozen `sequence` ordering (never archive read order, R6); C3 requires `row.matchId === fixtureId`. A wiring bug cannot settle one fixture's score against another's snapshot.
- **Known completeness edge (non-blocking, note for Stage 3).** `settledFixtureIds` is derived from **any** terminal head across the fixture's validationIds. If a fixture has an older settled snapshot and a newer captured-but-unsettled snapshot, the binary exclusion skips the newer snapshot's settlement. This is a completeness gap (deferred to Stage 3, which uses `currentValidationHeads` per `(fixture, market)`), **never** a false or incorrect settlement.

**First-settlement safety: sound and idempotent.**

---

## 5. Correction Safety

This is the settlement-specific crux. **Stage 2C must be first-settlement-only.**

- **No `correctionCause` is ever set.** The Stage-1 provider produces `SettlementCandidate`s without `correctionCause` (`settlement-provider.ts:157-166`); `runSettlementBatch` forwards `candidate.correctionCause` (undefined) to M8. **SC-3** binds Stage 2C to keep it so.
- **Settled fixtures are excluded.** `already_settled` (binary `settledFixtureIds`) means M8 never sees an already-terminal fixture, so the correction branch (`head.state !== outcome.state`) is not reached through the pipeline.
- **Defense in depth even if reached.** If a changed outcome ever reached M8 (e.g. a future wiring bug): `head.state === outcome.state` → `no_change` (no false correction); `head.state !== outcome.state` **with no `correctionCause`** → `invalid_input` (no write, counted, run `failed`). So a spurious correction/revision is **structurally impossible** in Stage 2C.
- **`currentValidationHeads` MUST remain unconsumed by Stage 2C.** It is the Stage-2A MC-1 enrichment reserved for Stage-3 correction detection. Consuming it to trigger corrections in Stage 2C would be an out-of-scope regression that introduces the false-correction risk this stage must avoid.
- **Correction revision race is store-guarded.** Should corrections ever be enabled (Stage 3), `decideValidationAppend`'s `expectedRevision`/`supersedesRevisionId` chain over the full stream (`rules.ts:106-131`) guarantees at most one rev(N+1) appends; the loser gets `revision_conflict`. Under the durable single-writer lock this race cannot even occur.

**Correction safety: guaranteed by first-settle-only + the M8 `correctionCause` guard + the exclusion of settled fixtures. No false correction is possible.**

---

## 6. Lock and Worker Safety

- **Distinct, non-shared key.** Settlement uses `job:prediction_settlement`, never capture's key (`runner.ts` M9). Single non-nested lock, released in `finally`.
- **Discovery must be inside the lock (INV-L, SC-2).** Stage 2C must add a `provideCandidates`/`discover` seam to `runPredictionSettlementJob` invoked **after** the lock is held (mirroring the Stage-2B capture seam at `runner.ts:302-306`). The flag check (`isSettlementEnabled`) short-circuits **before** the lock. Nothing may read source/archive before the lock.
- **Overlap → 409, never 500.** The loser of a concurrent fire gets `null` → `skipped`/`lock_unavailable`/409, does no discovery.
- **Fail-closed acquisition.** No/`memory` `EVIDENCE_DATABASE_URL` in production or an unreachable lock DB → `null` → `skipped` (no memory fallback for evidence jobs). Cross-process single-writer rests on `EVIDENCE_DATABASE_URL` (M9, unchanged) — an activation precondition, not a Stage-2C regression.
- **Unlock failure (H-1).** Unchanged: a successful settlement whose `pg_advisory_unlock` throws surfaces as 500 (a false failure, re-fire is `no_change`). Carry-forward.

---

## 7. Retry and Crash Recovery

- **No internal retry wrapper** in the settlement path; retries are external cron re-fires, serialized by the lock, each an idempotent bounded pass.
- **Crash before append:** nothing persisted → re-fire recomputes deterministically → first settlement (no loss).
- **Crash after append:** committed line → re-fire → `no_change`; torn mid-write line (no fsync) → strict read throws → `failed` until quarantine (§8). Detected, never silent.
- **Partial batch:** committed settlements persist; the run reports `failed` on any hard fault; re-fire completes the rest. **No partial-pair** (validations only), so no half-written pair to reconcile.
- **INV-A (archive is the sole checkpoint):** no cursor/offset introduced; pending settlement work is recomputed from the archive each pass, so restart/replay reproduce identical pending work.
- **Determinism:** `completionInstant`/`nowSec` are deterministic (source-derived), so re-derivation is byte-stable and identity is `evalInstant`-independent → re-fire is `no_change`, never a gratuitous revision.

---

## 8. Strict-Read Failure Behaviour

- **Strict readers, no masking.** The settlement archive-state read must reuse the frozen `readNdjson` semantics: **only** `ENOENT` ⇒ `[]`; `EACCES/EPERM`, `EIO/EBUSY/ENXIO/ENODEV`, malformed/torn line, and (for validations) any integrity/conflict condition ⇒ **throw**. The Stage-2A builders never catch; the Stage-2C producer must never catch → a corrupt archive **rejects** the producer → the runner reports **`failed`**, never an empty success or "0 settled" (DR-6).
- **`readAllValidationsStrict` must be ADDED (SC-1).** Stage 2B added `readAllSnapshotsStrict`; Stage 2C needs the symmetric validations reader (and the concrete `SettlementArchiveReadPort` over `readAllSnapshots` + `readAllValidations`), reusing `readNdjson`, single bounded read per store (PB-1), no fail-open path, no per-fixture rescan at discovery.
- **Conflict surfacing.** `ArchiveStateConflictError` (read) and `immutable_violation`/`revision_conflict` (append) both surface as `failed` — never averaged, never "pick-one", never silently collapsed.
- **Blast radius (carry-forward, availability not integrity).** Whole-file reads mean one malformed/torn line fails the whole pass for all fixtures until quarantine. Fail-closed (no corruption/false success); fsync-on-append + the scheduled `verifyValidationChain`/`verifyEvidenceChain` sweep + line-level quarantine are ops/later-stage gates (§10).

---

## 9. Stage 2C Blocking Conditions

The Stage 2C implementation MUST satisfy all of the following (each additive; no frozen-contract change):

- **SC-1 — Concrete strict validation read port.** Add `readAllValidationsStrict` + a concrete `SettlementArchiveReadPort` (snapshots + validations) reusing `readNdjson` (only ENOENT empty; else throw); single bounded read per store per run (PB-1); no fail-open reader; adapter-neutral (no path/offset identity).
- **SC-2 — Discovery inside the durable lock (INV-L).** Add the settlement `provideCandidates`/`discover` seam to `runPredictionSettlementJob`, invoked **after** lock acquisition; flag-skip precedes the lock; a rejecting producer (strict-read throw / conflict) makes the run report **`failed`**, never an empty success.
- **SC-3 — First-settlement-only; no correction.** Never set `correctionCause`; always exclude `settledFixtureIds` (binary `already_settled`); do **not** consume `currentValidationHeads` to trigger corrections (Stage 3). This is the false-correction firewall.
- **SC-4 — Deterministic `completionInstant`/`nowSec`.** Source-derived (kickoff default), no wall clock, so re-fire is byte-stable → `no_change` idempotency and M7/A4 replay hold.
- **SC-5 — Preserve C3/C4 + BF-S1 boundary.** Route through `runSettlementBatch` (fixture correspondence + score sanity) and the BF-S1 classifier; never bypass them; terminal candidates carry a valid `completionInstant`.
- **SC-6 — Fail-closed accounting.** A strict-read throw, `ArchiveStateConflictError`, `immutable_violation`, `revision_conflict`, or `append_failed` ⇒ run **`failed`**; a settled market counts only on `appended`; `no_change`/`pending`/`not_found`/`already_settled` are distinct from failures. No false success; no corruption counted as success.
- **SC-7 — Distinct fail-closed lock.** Use `job:prediction_settlement` (never capture's key); single non-nested lock; production fail-closed (no memory fallback); overlap → 409 not 500.
- **SC-8 — Dormant until activation, honest scope.** Keep the cron route on the M9 empty-safe pass until a later activation stage wires the live producer; do not falsely claim production readiness; explicitly document deadline/diagnostics/corrections as deferred.
- **SC-9 — Idempotent partial-batch completion.** A per-candidate fault must leave committed settlements intact and be completable on re-fire (no partial-pair, no loss, no duplicate revision).

**Required tests (blocking for sign-off):** discovery+reads inside the lock; strict-read-throw → `failed` not empty; conflict (`ArchiveStateConflictError`/`immutable_violation`/`revision_conflict`) → `failed`, no forked revision; first-settlement + idempotent re-fire (`no_change`); terminal non-scored (postponed/cancelled/abandoned) end-to-end written; already-settled → excluded, `correctionCause` never set; changed-result → deferred (no false correction); duplicate candidate → dedup; overlap → 409-not-500, loser no discovery; crash/replay → no loss/duplicate; ceiling fail-safe (0/NaN/>150→100/150); determinism static guard (no clock/random in the producer path).

---

## 10. Later-Stage Activation Gates (not Stage 2C blockers)

Deferred to a later activation stage before flags are enabled and the live producer is wired into the route:

- **G-1 — INV-D deadline.** Effective job deadline `min(configured, 60_000 − HEADROOM) ≤ 45 s`; start no candidate without budget; **plus** the settlement-specific O(F²) benchmark (the frozen M8 path re-reads whole `validations`+`snapshots` per candidate) at the ceiling against representative archive depth.
- **G-2 — Producer diagnostics aggregation.** Merge `CandidateDiagnostics` + batch counts into reconciling low-cardinality `resultCounts`; replace the generic discovery-failure `errorCode` with a specific `archive_read_failed`/`source_load_failed`; no entity id as a label.
- **G-3 — H-1 unlock swallow.** So a committed idempotent settlement is not misreported as 500.
- **G-4 — Single-writer config precondition.** Assert `EVIDENCE_DATABASE_URL` present + reachable and `NODE_ENV=production` before enabling; verify overlap 409-not-500.
- **G-5 — Corruption resilience ops.** fsync-on-append (or document the torn-tail window) + scheduled `verifyValidationChain`/`verifyEvidenceChain` sweep + quarantine tooling (whole-file read blast radius, §8).
- **G-6 — Corrections (Stage 3).** Consume `currentValidationHeads` to detect a genuine per-`(fixture,market)` outcome change and set `correctionCause` (`result_reinterpreted`/`source_lineage_changed`); this is where correction/false-correction/revision-race tests become load-bearing. **Out of Stage 2C.**
- **G-7 — Source loader / completion-instant deriver isolation.** The live source loader and any injected `deriveCompletionInstant` must not throw uncaught mid-batch (map faults to defer), analogous to Stage 2B's derive-adapter gate.
- **G-8 — Route live wiring test.** When the route calls a `runLive*Job()`, assert auth/rate-limit/status-map unchanged, flag-off does no discovery, discovery+reads only after the lock.

---

## 11. Verdict

# STAGE 2C SAFETY CONDITIONALLY READY

Stage 2C is unbuilt, and the substrate it will wire — the frozen, idempotent, revision-aware M8 settlement engine; the strict, conflict-detecting Stage-2A settlement normalizer; the first-settle-only, clock-free Stage-1 provider; and the distinct, fail-closed M9 settlement lock — is **sound and green** (substrate baseline 136/136 this pass). Every one of the 25 evaluated failure modes resolves to `safe no-op`, `deferred`, `failed`, or `retryable`; **none** yields a false settlement, a false correction, a forked/duplicate revision, corruption, or permanent starvation. Settlement has **no non-atomic pair**, so the capture-side partial-pair hazard does not exist here.

The verdict is **CONDITIONALLY READY** (not READY) because the implementation must satisfy the mandatory blocking conditions in §9 — above all **SC-3 (first-settlement-only; never set `correctionCause`; never consume `currentValidationHeads`)**, which is the settlement-specific firewall against false corrections, and **SC-1/SC-2/SC-6 (strict validation read port + discovery-in-lock + fail-closed accounting)**, which prevent a corrupt read from masquerading as "0 settled." It is **not BLOCKED**: nothing in the design or substrate prevents a safe implementation, and deadline/diagnostics/corrections are correctly deferred (they are not required to prevent an immediate regression, since the route stays dormant).

- **Verdict:** STAGE 2C SAFETY CONDITIONALLY READY.
- **Immediate blockers:** none in the substrate; Stage 2C must be *built to* the §9 conditions (they are pre-conditions of a safe implementation, not defects in existing code).
- **Required invariants:** SC-1 strict validation read port (fail-closed, single bounded read); SC-2 discovery inside the durable lock (rejecting producer → `failed`); **SC-3 first-settlement-only, no `correctionCause`, `currentValidationHeads` unconsumed**; SC-4 deterministic `completionInstant`/`nowSec`; SC-5 C3/C4 + BF-S1 preserved; SC-6 fail-closed accounting (no false success); SC-7 distinct fail-closed lock (409-not-500); SC-8 dormant/honest scope; SC-9 idempotent partial-batch completion.
- **Later-stage gates:** INV-D deadline + O(F²) benchmark, diagnostics, H-1 unlock, single-writer config, corruption sweep/fsync, Stage-3 corrections, source/instant-deriver isolation, route live-wiring test.

**Confirmation:** review-document-only change. No runtime code, tests, routes, configuration, archives, feature flags, environment, database, or deployment were modified; no existing document was altered. The only file created is `docs/plans/m10-stage-2c-production-safety-review.md`.

# M10 Stage 2C — Settlement Pipeline Wiring — Implementation Production-Safety Review

**Review type:** Read-only production-safety / failure-mode review of the **implemented** Stage 2C settlement wiring. **No code or tests were modified.** The only file created is this document.
**Date:** 2026-07-30
**Reviewer:** Production-Safety Reviewer, Sprint 23B / M10 Stage 2C.
**Under review:** `lib/evidence-capture/candidates/settlement-pipeline.ts` (new); `lib/archive/evidence/file.ts:165-169` (`readAllValidationsStrict`, new); `lib/jobs/runner.ts:319-368` (`runPredictionSettlementJob` `provideCandidates` seam, additive); `tests/evidenceSettlementPipeline.test.ts` (new, 25 tests). Frozen/unchanged: M8 `settlement.ts`/`outcomes.ts`, `runSettlementBatch`, `decideValidationAppend`, identity/hash/revision formulas, archive formats, `locks.ts`, `cronHandler.ts`, the settlement cron route, flag defaults.
**Method:** every `file:line` read from source; the firewall, strict readers, lock seam, and M8 idempotency verified directly and against the tests; targeted + full suite + typecheck + lint re-run this pass.
**Verification (this pass):** targeted **171/171**; full suite **1795/1795** (0 fail); typecheck **exit 0**; lint **clean**.

---

## 1. Executive Summary

Stage 2C wires the settlement mirror of Stage 2B: a reusable, dormant producer (`produceSettlementRequests` + `createFileSettlementReadPort`), a new strict whole-archive validation reader (`readAllValidationsStrict`), and an additive `provideCandidates` seam on `runPredictionSettlementJob` invoked **inside the held durable lock** (INV-L). The settlement cron route is **unchanged and dormant** (`runPredictionSettlementJob()` with no producer → the M9 empty-safe pass), and no frozen contract, identity, hash, revision, or archive format changed (typecheck exit 0 confirms).

**Every Stage-2C blocking condition from the prior safety plan is satisfied in code and directly tested:**
- **Strict, fail-closed reads (SC-1/SC-6/SC-8 of the plan):** `readAllValidationsStrict` = `readNdjson(evidenceArchivePaths(env).validations)` — ENOENT⇒`[]`, else throw; `buildSettlementArchiveState` never catches; `produceSettlementRequests` never catches → a corrupt read or source-loader rejection **rejects** the producer → the runner reports **`failed`**, never an empty success (tested: strict-read throw, EISDIR, `ArchiveStateConflictError`, source rejection all → reject/`failed`).
- **Discovery inside the lock (INV-L):** `provideCandidates` is `await`ed inside `runWithLock`; a lock-unavailable/disabled fire never calls the producer (tested: `calls===0`).
- **First-settlement-only firewall (SC-3):** the pipeline **never** sets `correctionCause` and **never** consumes `currentValidationHeads` (asserted by a source-scanning scope test), and already-settled fixtures are excluded by the Stage-1 provider (`already_settled`). Defense-in-depth: even a causeless changed outcome that reached M8 → `invalid_input`, **no write** (tested).
- **Path consistency:** the validation reader and the store's `appendValidation` both resolve `evidenceArchivePaths(env).validations` — no read/write directory divergence (settlement has a single archive dir, no odds-dir asymmetry).
- **M8 idempotency preserved:** frozen `settleSnapshot`/`decideValidationAppend` unchanged; a real producer→provider→2A-builder→M8 integration test shows first settle appends exactly one revision (revision 1) and a retry appends nothing (`considered===0`, no duplicate, no correction).

**No blocking finding.** Settlement has **no non-atomic pair** (validations only, one atomic line per market), so the capture-side partial-pair hazard does not exist. The residual items (INV-D deadline, producer diagnostics aggregation, H-1 unlock-500, Stage-3 corrections, the live completed-rows loader, the O(F²) per-candidate M8 read benchmark) are all **later-stage activation gates** — the route is dormant and none is required to prevent an immediate regression.

**Verdict: PRODUCTION REVIEW CONDITIONALLY PASSED** — the dormant, fail-closed, firewalled slice is production-safe and merges cleanly; live activation is gated on §7.

---

## 2. Failure Matrix

Classes: **safe no-op** · **deferred** (counted/rejected, re-derived next fire) · **failed** (run `failed`→500, no false-success masking) · **retryable** (durable partial progress, idempotently completed) · **first settlement** · **correction** · **false success / corruption / duplicate / starvation** = must be **none**.

| # | Failure mode | Class | Reasoning / anchor |
|---|---|---|---|
| 1 | **Strict snapshot read failure** | **failed** | Discovery: `buildSettlementArchiveState`→`readAllSnapshots` throws → `produceSettlementRequests` rejects → runner `failed`. M8 path: `latestSnapshot`→`readNdjson` throws → `runSettlementBatch` `try/catch` → `writeFailed` → `failed`. Tested (EISDIR/malformed → reject). |
| 2 | **Strict validation read failure** | **failed** | Discovery: `readAllValidations` throws → producer rejects → `failed`. M8 path: `listValidations`→`readNdjson` throws → caught → `writeFailed` → `failed`. Tested (`strict validations read throw propagates`). |
| 3 | **Malformed archive** | **failed** | Strict readers throw `malformed NDJSON at line N` → producer rejects → `failed`. Whole-file read ⇒ one bad line fails the pass for all fixtures (availability blast radius — §7 carry-forward). Tested (port malformed snapshot/validation). |
| 4 | **Immutable conflict** (same `revisionId`/diff hash; ambiguous `(id,revision)`; snapshot hash conflict) | **failed** | Read: `ArchiveStateConflictError` (`normalize.ts`) → producer rejects → `failed`. Append: `decideValidationAppend`→`immutable_violation`/`revision_conflict` → `immutableViolation`/`appendFailed` → `failed`. Detected, **no corruption**. Tested (snapshot + validation conflicts → `ArchiveStateConflictError`). |
| 5 | **Source loader failure** | **failed → deferred** | `deps.loadCompletedRows` rejects → `Promise.all` rejects → producer rejects → `failed`; no writes; re-fire next cron. Tested (`source-loader rejection propagates`). |
| 6 | **Provider failure** (`buildSettlementCandidates` throws, e.g. invalid `evaluationInstant`) | **failed** | `TypeError` propagates → producer rejects → runner `failed`. No writes. |
| 7 | **Callback rejection** (`provideCandidates` rejects) | **failed** | `runWithLock` `try/catch` → `status: "failed"`, `errorCode: "unhandled"` (`runner.ts:123-134`). Never an empty success. Tested (`rejecting provideCandidates → failed`). |
| 8 | **Settlement batch failure** (`write_failed`/`immutable_violation` in the batch) | **failed** | `hardFailed = writeFailed>0 \|\| immutableViolation>0` → run `failed`+code (`runner.ts:363-368`). Committed markets persist; re-fire idempotent. |
| 9 | **Retry** (re-fire) | **safe no-op** | Already-settled fixtures excluded → `considered===0`; a first-settled fixture with an unchanged outcome → `no_change`, no append. Tested (integration retry: `after2.length===1`, all `revision===1`). |
| 10 | **Duplicate settlement** (same fixture ×N in the batch) | **safe no-op** | Provider dedups per `fixtureId`; the store idempotency (`revisionId`+`contentHash`→duplicate) is the backstop. **No duplicate revision.** |
| 11 | **Already settled** (fixture in `settledFixtureIds`) | **safe no-op / deferred** | Stage-1 provider → `already_settled` reject, 0 candidates. Tested (`already-settled → 0 candidates`). No correction, no false success. |
| 12 | **Correction suppression** (changed result on a settled fixture) | **deferred (Stage 3)** | First-settle-only: settled fixture excluded → the change is **not** propagated; the prior settled result stands. A completeness gap, **not** a correctness regression, **not** a false success. Corrections are Stage 3 (`currentValidationHeads`). |
| 13 | **Partial batch** (some settle, some fault) | **retryable** | Each candidate independent; each market append one atomic line. Committed settlements persist; a hard fault → run `failed`; re-fire completes the rest (`no_change`). **No partial-pair** (validations only), no loss. |
| 14 | **Process crash** | **safe no-op / retryable / failed** | Before append: nothing persisted → re-fire recomputes → first settlement. After append: committed → re-fire `no_change`. Torn mid-write line (no fsync) → strict read throws → `failed` until quarantine (§7). |
| 15 | **Lock failure** | **deferred (409, fail-closed)** | `tryAcquireJobLock`→`null` (no/`memory` `EVIDENCE_DATABASE_URL` in prod, or DB unreachable) → `skipped`/`lock_unavailable` **before** discovery → no read/write, **no memory fallback**. Tested (`lock unavailable → skipped, producer never called`, `calls===0`). |
| 16 | **Unlock failure** | **false-failure (H-1), not corruption** | `pg_advisory_unlock` throw → `cronHandler.ts:47` (no try/catch) → 500 misreporting a committed idempotent settlement. Unchanged from M9. Re-fire → `no_change`. Carry-forward. |
| 17 | **Overlapping workers** | **deferred (409)** | Distinct lock `job:prediction_settlement`; loser → `null` → `skipped`/409, does **no** discovery. Cross-process guarantee rests on `EVIDENCE_DATABASE_URL` (M9). Discovery is inside the lock. |
| 18 | **Empty candidate list** | **safe no-op** | Provider `[]` or bare route → `runSettlementBatch([])` → `succeeded` zero-count = M9 baseline. |
| 19 | **Large archive** | **safe no-op (dormant) / carry-forward perf** | Discovery = one bounded read per store (PB-1, tested `snap===1`,`val===1`). The frozen M8 path re-reads whole `validations`+`snapshots` **per candidate** → O(F·A)≈O(F²), bounded by the ceiling (≤150) and gated by the deadline for live activation (§7). Unchanged frozen behaviour; route dormant. |
| 20 | **Large settlement batch** | **safe no-op (bounded)** | Provider caps at `normalizeBatchLimit` (≤150, default 100; invalid→100) → bounded writes (INV-C). Classification over a huge source is O(source) compute, deadline-gated once live. |

**Sweep property (holds):** across {corrupt read, conflict, source-unavailable, non-terminal, already-settled, changed-result, duplicate} the wired settlement path yields only `safe no-op`/`deferred`/`failed`/`retryable` — **never** a false WIN/LOSS/VOID/PUSH, a duplicate/forked revision, a false correction, or a permanently starved candidate.

---

## 3. Lock Safety

- **Discovery inside the lock (INV-L) — VERIFIED.** `runPredictionSettlementJob` acquires `job:prediction_settlement` via `runWithLock`, then `await options.provideCandidates()` inside the callback (`runner.ts:353-357`). The flag check (`isSettlementEnabled`) short-circuits **before** the lock. Tests confirm the producer is never called when disabled (`calls===0`) or when the lock is unavailable (`calls===0`).
- **Distinct, non-shared, non-nested key.** Never capture's key; single lock per run, released in `finally`. No nesting/ordering surface.
- **Overlap → 409, never 500.** The loser gets `null` → `skipped`/`lock_unavailable`/409 (tested, `errorCode==="lock_unavailable"`), does no discovery.
- **Fail-closed acquisition, no memory fallback.** No/`memory` `EVIDENCE_DATABASE_URL` in production or an unreachable lock DB → `null` → `skipped`. Cross-process single-writer rests on `EVIDENCE_DATABASE_URL` (M9, unchanged) — an activation precondition (§7), not a Stage-2C regression.
- **Precedence pinned.** When both `provideCandidates` and static `candidates` are supplied, the producer wins and the static array is ignored (tested) — the in-lock discovery path is authoritative. Safe (production route supplies neither → empty pass).

---

## 4. Retry Behaviour

- **No internal retry wrapper** in the settlement path; retries are external cron re-fires, serialized by the lock, each an idempotent bounded pass.
- **Idempotent re-fire (tested end-to-end).** A first-settled fixture is excluded by `already_settled` on the next fire (`considered===0`), so no duplicate revision is even attempted; the store's `(revisionId, contentHash)` idempotency and the `no_change` branch are the backstops. `completionInstant`/`nowSec` are deterministic (source-derived kickoff), so re-derivation is byte-stable → `no_change`, never a gratuitous revision.
- **Crash-then-retry.** Before append → recompute → first settlement; after append → `no_change`; torn line → `failed` until quarantine. No loss, no duplicate.
- **`immutable_violation`/`revision_conflict`** are non-idempotent-by-design signals of a determinism/wiring bug → run `failed`, escalate, never blind-loop.
- **INV-A.** No cursor/offset introduced; pending settlement work is recomputed from the archive each pass, so restart/replay reproduce identical pending work.

---

## 5. First Settlement Safety

- **First settlement is the only write path.** `settledFixtureIds` excluded ⇒ every fixture reaching M8 has no terminal head ⇒ `settleSnapshot` takes the `!head` branch ⇒ `createValidationRecord` (revision 1, `supersedesRevisionId: null`) ⇒ append. Integration test confirms exactly one revision-1 record on first settle.
- **Fixture correspondence + terminal boundary preserved.** `runSettlementBatch` enforces C3 (`row.matchId === fixtureId`) and C4 (non-negative-integer scores) before any settle; `settleLatestSnapshotForFixture` settles the **latest** snapshot by frozen `sequence` (R6). BF-S1 terminals (postponed/cancelled/abandoned, null scores) are eligible with a valid deterministic `completionInstant` (kickoff) — tested. Non-terminal (live) → deferred (tested).
- **Deterministic identity.** `completionInstant`/`nowSec` are source-derived (no clock); the produced candidate carries no invented identity — `validationId`/`validationRevisionId` derive downstream, so M7/A4 replay is preserved. Determinism proven by the shuffled-input deep-equal test.
- **Known completeness edge (non-blocking, Stage 3).** Binary `settledFixtureIds` skips a newer captured-but-unsettled snapshot when an older snapshot for the same fixture is already settled — a completeness gap deferred to Stage 3, never a false/incorrect settlement.

---

## 6. Correction Firewall

**The settlement-specific crux — verified airtight in code and by test:**
- **No `correctionCause` is produced.** `produceSettlementRequests` passes only `{completedRows, evaluationInstant, archiveState, config, deps?}`; the Stage-1 provider never sets `correctionCause`. A source-scanning scope test (`settlement-pipeline.ts CODE contains no correctionCause and no currentValidationHeads`, comments stripped) asserts neither identifier appears in real code.
- **`currentValidationHeads` is never consumed.** Reserved for Stage-3 correction detection; the pipeline reads only `capturedFixtureIds`/`settledFixtureIds`.
- **Settled fixtures are excluded** (`already_settled`), so the M8 correction branch (`head.state !== outcome.state`) is unreachable through the pipeline.
- **Defense in depth at M8.** If a changed outcome ever reached M8 without a cause → `invalid_input`, **no write** (frozen `settlement.ts:301-303`). Directly tested: `false-correction impossibility — causeless changed outcome → M8 invalid_input, no append` (`after.length===1`).
- **Correction revision race is store-guarded** (should Stage 3 enable corrections): `decideValidationAppend`'s `expectedRevision`/`supersedesRevisionId` chain over the full stream makes at most one rev(N+1) append; under the single-writer lock the race cannot occur. **No false correction and no forked/duplicate revision is possible in Stage 2C.**

---

## 7. Blocking Findings

**None.**

- No frozen-contract/identity/hash/revision/archive-format change (only an additive strict reader + an additive optional runner parameter + a new dormant module; typecheck exit 0).
- The settlement cron route is **unchanged and dormant** (scope test asserts it calls `runPredictionSettlementJob()` with no producer and wires no `provideCandidates`).
- Strict-read-or-`failed`, discovery-in-lock, first-settle-only firewall, and M8 idempotency are all present and directly tested.
- No false success, no false correction, no duplicate settlement, no corruption path found; every corrupt/conflict/throw resolves to `failed`, never empty.
- Full suite **1795/1795** (M9/2A/2B baselines preserved), typecheck exit 0, lint clean.

---

## 8. Carry-forward Risks (later-stage activation gates — not Stage 2C blockers)

- **CF-1 — No INV-D deadline.** Latent while the route is dormant; before live wiring, clamp the effective job deadline ≤45 s and **benchmark the frozen M8 O(F²) per-candidate reads** (`listValidations`+`latestSnapshot` per fixture) at the ceiling against representative archive depth.
- **CF-2 — Producer diagnostics not aggregated; coarse failure code.** A producer rejection reports the generic `errorCode: "unhandled"` rather than `archive_read_failed`/`source_load_failed`; the provider `CandidateDiagnostics` are not merged into `resultCounts`. Also **`invalidInput`/`fixtureMismatch`/`invalidScore` do not flip the run to `failed`** (only `writeFailed`/`immutableViolation` do — the inherited M9/2B `hardFailed` rule); these are counted (no false settlement is written) but do not alert via the 500 path. Surface them when diagnostics land.
- **CF-3 — Live completed-rows loader.** `loadCompletedRows` is a dormant injected seam with no live default; the concrete finished-fixture loader (and any `deriveCompletionInstant`) must be validated and must not throw uncaught mid-run (map faults to defer) before activation.
- **CF-4 — Cross-process single-writer config.** Requires `EVIDENCE_DATABASE_URL` present + reachable and `NODE_ENV=production` (M9, unchanged) as an activation precondition.
- **CF-5 — H-1 unlock-500.** A committed idempotent settlement can misreport as 500 on unlock throw; land the swallow/log.
- **CF-6 — Whole-file read blast radius + no fsync.** One torn/malformed line fails the whole pass until quarantine; fsync + scheduled `verifyValidationChain`/`verifyEvidenceChain` sweep + quarantine tooling are ops gates.
- **CF-7 — Corrections (Stage 3).** Consuming `currentValidationHeads` to detect a genuine per-`(fixture,market)` change and set `correctionCause` is deferred; that is where correction/false-correction/revision-race tests become load-bearing.

---

## 9. Verdict

# PRODUCTION REVIEW CONDITIONALLY PASSED

The implemented Stage 2C settlement wiring is a **correct, dormant, fail-closed, firewalled slice**. Discovery runs inside the durable lock (INV-L); the new strict validation reader and the concrete port fail closed (only ENOENT is empty; a corrupt read → `failed`, never a false success); the first-settlement-only firewall is enforced and source-scanned (no `correctionCause`, no `currentValidationHeads`), with M8's causeless-change guard as a tested backstop; the frozen M8 idempotency is preserved (first settle = one revision, retry = no append, no duplicate, no correction); the cron route is unchanged and dormant; and no frozen contract changed. Settlement has **no non-atomic pair**, so the capture-side partial-pair hazard is absent. All twenty evaluated failure modes resolve to `safe no-op`, `deferred`, `failed`, or `retryable` — none to false success, false correction, duplicate settlement, corruption, or starvation. Targeted **171/171**, full suite **1795/1795**, typecheck exit 0, lint clean.

The verdict is **CONDITIONALLY PASSED** (not PASSED) solely because live activation is gated on the §8 carry-forward items (INV-D deadline + O(F²) benchmark, producer diagnostics/error-code granularity, the live completed-rows loader, single-writer config, H-1, corruption sweep, and Stage-3 corrections) — all correctly deferred, none a Stage-2C regression, and none reachable while the route is dormant. It is **not BLOCKED**: there is no immediate correctness regression and no blocking finding.

- **Verdict:** PRODUCTION REVIEW CONDITIONALLY PASSED.
- **Immediate blockers:** none.
- **Required invariants (all verified present):** fail-closed strict reads → `failed` (never empty); discovery inside the durable lock; first-settlement-only firewall (no `correctionCause`, no `currentValidationHeads`, exclude `settledFixtureIds`); deterministic `completionInstant`/`nowSec`; C3/C4 + BF-S1 preserved; distinct fail-closed lock (409-not-500); route dormant; M8 idempotency preserved (no duplicate/no false correction).
- **Carry-forward (activation gates):** CF-1 deadline+benchmark, CF-2 diagnostics/error-code, CF-3 live loader, CF-4 single-writer config, CF-5 H-1, CF-6 sweep/fsync, CF-7 Stage-3 corrections.

**Confirmation:** review-document-only change. No runtime code, tests, routes, configuration, archives, feature flags, environment, database, or deployment were modified; the only file created is `docs/plans/m10-stage-2c-implementation-production-review.md`.

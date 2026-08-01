# M10 Stage 2C — Settlement Pipeline Wiring — Independent Test Coverage Review

**Review type:** Test & verification review only. **No test or runtime code was modified.** The only file created is this document.
**Date:** 2026-07-30
**Reviewer:** Independent Test Reviewer, Sprint 23B / M10 Stage 2C.
**Under review:** `lib/evidence-capture/candidates/settlement-pipeline.ts` (`createFileSettlementReadPort`, `produceSettlementRequests`), the additive `readAllValidationsStrict` (`lib/archive/evidence/file.ts`), the `provideCandidates` settlement runner seam (`lib/jobs/runner.ts:339-`), and `tests/evidenceSettlementPipeline.test.ts` (26 tests).
**Read:** `m10-stage-2c-settlement-pipeline-wiring.md` (implementation record), `m10-stage-2c-test-plan.md`, `m10-stage-2c-settlement-integration-plan.md`, `m10-stage-2b-test-coverage-review.md` (the prior stage's mock-fidelity findings), the M10 spec (Rev A1), Stage 2A docs.
**Method:** every Stage 2C source + test file read line by line; each of the 26 tests mapped to the requirement it proves; all named suites, full suite, typecheck, lint **re-run this pass** (not trusted from the wiring record); M8 source independently scanned for 2C leakage.

---

## 0. Executive Verdict

### TEST COVERAGE APPROVED

Stage 2C shipped as the **first-settlement-only** settlement mirror of Stage 2B (corrections explicitly deferred, replaced by a two-part firewall). The 26 tests are green and honest; the full suite is **1795/1795** (0 fail, 0 skip), typecheck exit 0, lint clean. **All 18 mandated coverage items are met** — 17 with dedicated direct tests, and "M8 untouched" via regression (34/34) + an independently-verified source scan + the frozen-M8-riding false-correction test.

Critically, Stage 2C **closes all three mock-fidelity gaps the 2B coverage review flagged** and adds the INV-L proof 2B lacked:

- **Concrete port exercised** (2B MF-1 closed): 6 tests drive the real `createFileSettlementReadPort` over a temp NDJSON dir — malformed snapshot/validation → throw, immutable conflicts → throw, EISDIR → throw, ENOENT → `[]`.
- **Real end-to-end append** (2B MF-2 closed): `integration: real producer→provider→2A builder→M8` actually writes a `ValidationRecord` (settlement has no live-derivation blocker), then proves retry idempotency.
- **Real producer composed as the callback** (2B MF-3 closed): the integration test wires `provideCandidates: makeProducer()` calling the real `produceSettlementRequests`.
- **Lock-gating proven** (2B condition A-2 closed): `runner: lock unavailable → skipped, producer never called` pre-acquires `job:prediction_settlement` and asserts the producer is never invoked — a test that *detects pre-lock invocation*, not merely "called by a locked function."

No blocking gap exists. The residual items (§3) are non-blocking robustness nits, not unproven requirements.

---

## 1. Traceability Matrix (18 required coverage items → tests)

| # | Requirement | Proving test(s) in `evidenceSettlementPipeline.test.ts` | Status |
|---|---|---|---|
| 1 | **strict validation reader** | `port: malformed validation archive → throw` (`:160`); `port: missing files → [] each` (`:139`); `producer: strict validations read throw propagates` (`:298`) — exercises `readAllValidationsStrict` through the concrete port | **PASS** |
| 2 | **settlement archive state** | `producer: read bounds — snapshots 1 / validations 1 / source 1` (`:229`); `already-settled` (`:247`); conflict propagation (`:323`) — drives `buildSettlementArchiveState` | **PASS** |
| 3 | **terminal lifecycle** | `BF-S1 terminals (postponed/cancelled/abandoned, null scores) → eligible` (`:286`); `non-terminal (live) → 0` (`:267`) | **PASS** |
| 4 | **already settled** | `already-settled fixture → 0 candidates` + `already_settled` reason (`:247`) | **PASS** |
| 5 | **uncaptured fixture** | `uncaptured fixture → 0 candidates (missing_prediction_identity)` (`:277`) | **PASS** |
| 6 | **currentValidationHeads not consumed** | `scope: settlement-pipeline.ts CODE contains no correctionCause and no currentValidationHeads` (`:542`, comment-stripped source scan) | **PASS** |
| 7 | **correction firewall** | `already-settled → 0` (provider exclusion) + `false-correction impossibility — causeless changed outcome → M8 invalid_input, no append` (`:510`) + `correctionCause absent` (`:215,:286`) | **PASS (doubly guarded)** |
| 8 | **deterministic output** | `deterministic — shuffled completed rows → deep-equal candidate output` (`:338`, also asserts `capturedAt`/order `[100,200,300]`) | **PASS** |
| 9 | **source loader failure** | `source-loader rejection propagates (fail-closed, never empty)` (`:308`) | **PASS** |
| 10 | **archive failure** | `malformed snapshot → throw` (`:150`); `malformed validation → throw` (`:160`); snapshot/validation immutable conflict → throw (`:170,:185`); EISDIR → `read failed` (`:201`); `ArchiveStateConflictError` propagation (`:323`) | **PASS** |
| 11 | **callback rejection** | `rejecting provideCandidates → failed (never an empty success)` — `status:"failed"`, `errorCode:"unhandled"` (`:391`) | **PASS** |
| 12 | **callback inside lock** | `provideCandidates invoked once inside the lock, threaded to the batch` (`:361`) **+** the lock-gating proof in #14 (detects pre-lock invocation) | **PASS** |
| 13 | **callback skipped when disabled** | `disabled settlement flag → skipped, producer never called` — `calls===0`, `settlement_disabled` (`:405`) | **PASS** |
| 14 | **callback skipped when lock unavailable** | `lock unavailable → skipped, producer never called` — pre-acquire `job:prediction_settlement`, `calls===0`, `lock_unavailable` (`:421`) | **PASS** |
| 15 | **real producer integration** | `real producer→provider→2A builder→M8 — first settle appends 1 record` (`:465`); **real `ValidationRecord` written** | **PASS (end-to-end)** |
| 16 | **retry idempotency** | same test: retry → `considered:0`, `after2.length===1` "no duplicate revision", `every revision===1` "no correction" (`:497-507`) | **PASS** |
| 17 | **route dormant** | `prediction-settlement cron route remains the dormant one-line M9 delegate` — asserts `runPredictionSettlementJob()` present, `provideCandidates` absent (`:554`) | **PASS** |
| 18 | **M8 untouched** | No dedicated in-suite assertion; proven by regression (`evidenceSettlement` **34/34** green), the frozen-M8-riding `false-correction impossibility` test, and an independent source scan (§2.3) | **PASS (transitive)** |

**Also verified beyond the 18 (bonus coverage):** both-input precedence pinned (`provideCandidates` wins, static ignored — `:444`); static-candidates back-compat (`:379`); `completionInstant` = deterministic kickoff instant, not the eval instant (`:223`) — the guard that keeps validation `contentHash` byte-stable across fires.

**Score: 18/18 covered (17 direct, 1 transitive).**

---

## 2. Existing Coverage

### 2.1 The Stage 2C suite (26 tests, all green)
- **Concrete port (6):** ENOENT→[] for both files; malformed snapshot→throw; malformed validation→throw; snapshot immutable-conflict→throw; validation immutable-conflict→throw; EISDIR→throw. **The real `createFileSettlementReadPort` + `readAllValidationsStrict` are exercised**, not just faked.
- **Producer (10):** captured terminal→1 (correctionCause absent); read-bounds (snap 1/val 1/source 1 — PB-1); already-settled→0; live→0; uncaptured→0; BF-S1 terminals→eligible; strict-validations-throw→reject; source-reject→reject; `ArchiveStateConflictError`→propagate; determinism (shuffled→deep-equal).
- **Runner seam (6):** invoked-once-inside-lock+threaded; static back-compat; rejecting→failed; disabled→skipped/no-call; lock-unavailable→skipped/no-call; both-input precedence.
- **Real integration (2):** first-settle appends 1 record + retry no-dup/no-correction; causeless-changed→M8 `invalid_input`/no-append.
- **Scope guards (2):** no `correctionCause`/`currentValidationHeads` in code; route dormant.

### 2.2 Regression anchors (re-run this pass, all green)
| Suite | Result | Guards |
|---|---|---|
| `evidenceSettlement` (M8) | **34/34** | first-settle/idempotency/correction/immutable_violation/serialization-replay — the frozen writer Stage 2C rides |
| `evidenceArchiveStateBuilders` (2A) | **25/25** | `buildSettlementArchiveState`, conflict throws, single-read, `currentValidationHeads` |
| `evidenceCandidateProvider` (Stage 1) | **48/48** | `buildSettlementCandidates` classifier (terminal/pending/already-settled/dedup/ordering) |
| `evidenceCapturePipeline` (2B) | **9/9** | capture path unchanged by the shared runner edit |
| `m9Activation` / `m9Concurrency` | **18/18 / 11/11** | lock keys, flag-skip, C3/C4, durable-lock fail-closed |

### 2.3 "M8 untouched" independently verified
Source scan of `settlement.ts`, `settlement-run.ts`, `outcomes.ts` for 2C markers (`provideCandidates`, `currentValidationHeads`, `readAllValidationsStrict`, `settlement-pipeline`, "Stage 2C") → **none**. The 34 M8 behavioural tests remaining green corroborates no semantic drift. The runtime delta is confined to two additive functions + one new module (matches the wiring record §3).

### 2.4 Mock fidelity — materially better than 2B
The three 2B coverage-review gaps are closed (concrete port exercised; real end-to-end append; real producer as the callback), and the 2B condition A-2 (in-lock ordering / pre-lock-invocation detection) is satisfied by the lock-unavailable gating test. The remaining fakes (`fakePort` in producer/runner unit tests) are appropriate unit isolation, backstopped by the 6 concrete-port tests and the 2 real-integration tests.

---

## 3. Missing Tests (non-blocking)

- **N-1 — EACCES through the concrete port.** The port tests exercise ENOENT/malformed/EISDIR ("read failed") and EIO via a fake; a real EACCES/EPERM path is covered only in `evidenceArchiveFileAdapter` (`readNdjson`), not through `createFileSettlementReadPort`. Low value (same `readNdjson` errno branch), easy to add.
- **N-2 — Explicit eval-instant-invariance of validation identity.** The captured-terminal test asserts `completionInstant`=kickoff (proving eval instant does not leak into it), but no test runs the producer at **two different `evaluationInstant`s** and asserts identical `completionInstant`/resulting record. The single-instant assertion is a strong partial guard; a two-instant test would nail the replay-determinism property (my test-plan R-2).
- **N-3 — Process-restart / no-cursor explicit assertion.** The retry-idempotency test constructs a fresh producer+port per pass (implicitly re-deriving from the store), but there is no explicit "no cursor/checkpoint artifact after a run" assertion. INV-A holds by construction (port built fresh per call; progress = `settledFixtureIds`); an explicit guard is a robustness nice-to-have.
- **N-4 — Dedicated M8-untouched gate.** "M8 untouched" is proven transitively (34/34 + source scan); a symmetric scope-guard (as exists for the route) is not really content-scannable for M8 and is unnecessary given the regression evidence — noted only for completeness.

None of N-1…N-4 leaves a Stage 2C behaviour both plausibly-wrong and unguarded.

---

## 4. Deferred Tests (correctly out of Stage 2C — not counted against it)

Per the wiring record §12/§13 and the first-settlement-only charter:

- **Corrections (future stage):** consume `currentValidationHeads`, detect `head.state ≠ new outcome`, derive a typed `correctionCause`. Stage 2C deliberately excludes this and *proves the exclusion is safe* (firewall #7) rather than implementing it — the correct posture; the correction tests from the 2C test-plan (U-9/U-10/U-11, I-8, R-4) move with the feature.
- **2D — deadline / diagnostics:** INV-D effective-deadline ≤45 s + remaining-time guard for settlement; producer-stage diagnostics/metric aggregation + reconciliation identities; backlog/oldest-pending observability; the live completed-rows source loader (BQ-1).
- **2E — concurrency / benchmark / activation:** full multi-worker overlap (409-not-500, loser does no discovery); crash/replay matrix; representative-depth benchmark; the unlock-throw false-500 carry-forward (H-1/L-2).

The minimal INV-L proofs 2E would generalize (lock-unavailable no-invoke, distinct keys) are **already present** in the 2C suite.

---

## 5. Blocking Gaps

**None.** All 18 mandated coverage items are met; the firewall against a false correction is doubly proven (provider `already_settled` exclusion + frozen-M8 `invalid_input` on a causeless change); the concrete strict port, real end-to-end append, real-producer-as-callback, and lock-gating are all directly tested; M8 is verified untouched; and no failure-mode (malformed/IO/conflict/source-fail/rejection/mismatch) can be masked as an empty success. Nothing meets the blocking bar.

---

## 6. Validation Results (re-run this pass)

| Check | Command | Result |
|---|---|---|
| **Stage 2C pipeline** | `node --test tests/evidenceSettlementPipeline.test.ts` | **26 pass / 0 fail / 0 skip** |
| **M8 settlement** | `… tests/evidenceSettlement.test.ts` | **34 / 0 / 0** |
| **Stage 2A archive-state** | `… tests/evidenceArchiveStateBuilders.test.ts` | **25 / 0 / 0** |
| **Stage 2B capture pipeline** | `… tests/evidenceCapturePipeline.test.ts` | **9 / 0 / 0** |
| **M9 activation** | `… tests/m9Activation.test.ts` | **18 / 0 / 0** |
| **M9 concurrency / lock** | `… tests/m9Concurrency.test.ts` | **11 / 0 / 0** |
| **Full suite** | `npm test` (`tests/*.test.ts`) | **1795 pass / 0 fail / 0 skip** (1..1795) |
| **Typecheck** | `npm run typecheck` | **clean — exit 0** |
| **Lint** | `npm run lint` | **clean — no ESLint warnings or errors** |
| **M8-untouched scan** | grep 2C markers in `settlement.ts`/`settlement-run.ts`/`outcomes.ts` | **none — M8 core clean** |

Consistent with the wiring record's claimed **1795/1795** (was 1769 at 2B; +26). No suite was flaky across runs.

---

## 7. Verdict

### TEST COVERAGE APPROVED

Stage 2C's settlement-pipeline wiring is green (26/26), the full suite is **1795/1795**, typecheck exit 0, lint clean, and M8 is verified untouched at source. **All 18 mandated coverage items are proven** — strict validation reader, settlement archive-state, terminal lifecycle, already-settled/uncaptured classification, the `currentValidationHeads`-not-consumed and correction firewall, deterministic output, source-loader and archive failure fail-closed, callback rejection/inside-lock/flag-skip/lock-skip, a **real end-to-end first-settlement append with retry idempotency**, and route dormancy. The suite closes every mock-fidelity gap the prior (2B) review raised and adds the INV-L lock-gating proof, making it the strongest of the M10 wiring suites to date. The first-settlement-only firewall is doubly guaranteed (provider exclusion + frozen-M8 causeless-change `invalid_input`), so a false correction is structurally non-representable. Corrections, deadline/diagnostics, and concurrency/benchmark/activation are correctly deferred (Stages 2D/2E and beyond) and are not held against this stage. The only residuals (EACCES-through-port, an explicit two-eval-instant determinism assertion, a no-cursor guard) are non-blocking robustness additions.

---

## Final Response Summary

- **Verdict:** **TEST COVERAGE APPROVED.**
- **Blocking gaps:** **none.**
- **Non-blocking recommendations:** EACCES/EPERM through the concrete port (N-1); explicit two-`evaluationInstant` determinism assertion (N-2); explicit no-cursor/process-restart guard (N-3).
- **Deferred (not counted against 2C):** corrections (`currentValidationHeads`/`correctionCause`); 2D deadline+diagnostics; 2E concurrency/benchmark/activation + unlock-500 carry-forward.
- **Exact validation results:** Stage 2C **26/26**; M8 **34/34**; Stage 2A **25/25**; Stage 2B **9/9**; M9 activation **18/18**; M9 concurrency **11/11**; **full suite 1795/1795** (0 fail, 0 skip); typecheck **exit 0**; lint **clean**; M8 core scan **no 2C markers**.
- **Files modified:** exactly one created — `docs/plans/m10-stage-2c-test-coverage-review.md`. **No test or runtime code was modified; review-only confirmed.**

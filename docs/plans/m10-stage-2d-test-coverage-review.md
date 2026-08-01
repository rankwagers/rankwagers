# M10 Stage 2D — Operational Controls — Independent Test Coverage Review

**Review type:** Test & verification review only. **No runtime or test code was modified.** The only file created is this document.
**Date:** 2026-07-30
**Reviewer:** Independent Test Reviewer, Sprint 23B / M10 Stage 2D.
**Under review:** `lib/evidence-capture/candidates/operational.ts` + `completed-rows.ts` (new); the additive changes to `types.ts`, `diagnostics.ts`, `capture-provider.ts`, `settlement-provider.ts`, `jobs/capture-run.ts`, `jobs/settlement-run.ts`, `jobs/runner.ts`, `config.ts`; and `tests/evidenceOperationalControls.test.ts` (29 tests).
**Read:** `m10-stage-2d-operational-controls-implementation.md` (impl record, incl. RC-1/RC-2 resolutions), `m10-stage-2d-test-plan.md` (the plan this audits against), the M10 spec (INV-C/INV-D/§10), the 2B/2C coverage reviews.
**Method:** every Stage 2D test read line by line and mapped to an audit dimension; the runner/operational implementation independently inspected to verify each test's claim (esp. the lock/deadline/merge/metrics wiring); all named suites + full suite + typecheck + lint **re-run this pass** (not trusted from the record).

---

## 0. Executive Verdict

### TEST COVERAGE CONDITIONALLY APPROVED

All 13 audit dimensions are covered by green tests; the suite is well-targeted, deterministic (injected fake clock, no sleeps/network/archive mutation), and rides the real `metrics` module. The full suite is **1824/1824** (0 fail, 0 skip = 1795 + 29), typecheck exit 0, lint clean. RC-1 (four-grain capture reconciliation) and RC-2 (between-candidate deferral with prefix-commit, no mid-append interruption) are each **directly and convincingly proven**; INV-D deadline math, INV-C ceilings (incl. `500→150`), the fail-closed completed-rows loader, bounded metrics, and dormancy are all strongly covered.

It is **not** clean-APPROVED because of one nameable asymmetry and one observability gap, both **non-blocking**:

- **C-1 (capture-path integration asymmetry).** Stage 2D applies its controls to **both** runners (`capture-run.ts` *and* `settlement-run.ts` both gained the deadline param; both `runEvidenceCaptureJob` and `runPredictionSettlementJob` gained the `provideCandidateBatch` seam), yet **all four integration tests exercise only `runPredictionSettlementJob`**, and the batch deadline-guard test uses `runSettlementBatch`, never `runCaptureBatch`. The capture rich-seam + capture deadline guard are covered only by shared-code symmetry (`mergeProducerResultCounts`/`producerDeadlineBudget` are common) + regression, not by a direct capture-side test.
- **C-2 (reconcile not wired at runtime).** `reconcileCaptureDiagnostics`/`reconcileSettlementDiagnostics` are unit-validated to close over real provider output, but the runner **does not invoke them** (verified: `runner.ts` calls `flattenDiagnostics`+`emitProducerMetrics`, never `reconcile*`). The impl record §11's "a mismatch is detectable and logged/observable" is therefore an unit-level property, not a runtime one.

Neither is a defect: reconciliation is an internal metrics-consistency check that by design does not gate correctness, and the capture path shares the exact runner machinery the settlement integration proves. No blocking gap exists (§6).

---

## 1. Requirements-to-Tests Matrix (13 audit dimensions)

| # | Audit dimension | Proving test(s) in `evidenceOperationalControls.test.ts` | Status |
|---|---|---|---|
| 1 | **unit coverage** | deadline A(5) + guard B(2 pure) + ceiling D(1) + RC-1 reconcile(3) + accounting-mismatch(1) + flatten(1) + typed-codes(1) + metrics(2) + loader-filter(3) | **PASS (broad)** |
| 2 | **integration coverage** | 4 tests via `runPredictionSettlementJob`: real `produceSettlementRequests`→merged `resultCounts`+first settle (`:433`); injected-clock deadline trip + retry (`:467`); producer rejection→typed `errorCode` failed (`:512`); bare runner empty-safe (`:526`) | **PASS (settlement only — C-1)** |
| 3 | **deadline tests** | A: 300s→`EFFECTIVE_DEADLINE_HARD_MAX_MS`(≤45s), honours smaller, invalid/0/neg/NaN/non-number→45s, excessive→45s, custom headroom (`:139-162`); guard: `createDeadline`/decreasing/non-finite→0, `shouldStartNext` (`:166-181`) | **PASS (thorough)** |
| 4 | **ceiling tests** | D: exhaustive boundaries — undefined/NaN/0→100, 1/99/100/101/150→id, 151→150, **500→150** (`:219-230`) | **PASS (exhaustive)** |
| 5 | **diagnostics tests** | flatten: fixed low-cardinality keys, finite, null-oldest→0, no entity id, closed `rejected_*` (`:307`) + integration merged `resultCounts` (discovered/eligible/selected/processed/settled/run_degraded/effective_ceiling, `:453-460`) | **PASS** |
| 6 | **accounting tests** | RC-1 reconciliations close (`:234,:262,:282`) + deliberate mismatch → `ok=false`, not a job failure (`:297`) | **PASS (see C-2 for runtime)** |
| 7 | **RC-1** | N distinct-market rows→1 fixture (admitted=3, grouped=1, row-grain closes, `:234`); 4-grain reconciliation with malformed+row/fixture/derivation rejects (`:262`); settlement single-grain (`:282`) | **PASS (direct, strong)** |
| 8 | **RC-2** | `guard: batch defers between candidates, commits the prefix (no mid-append interruption)` — cand0 committed, cand1/2 `deferredByDeadline`, cand1 "never begun" (`:183-201`) | **PASS (direct)** |
| 9 | **loader tests** | filter terminal-only+dedup+order (`:368`); per-row isolation malformed/invalid-id/kickoff/score (`:381`); deterministic repeat (`:397`); whole-source throw/null→`ProducerError(source_load_failed)`, never `[]` (`:405`); valid source via `onFilter` (`:417`) | **PASS (thorough)** |
| 10 | **metrics** | bounded producer metrics + backlog/oldest-age gauge + no entity label (`:336`); null oldest-age→no gauge + best-effort no-throw (`:357`) | **PASS** |
| 11 | **dormant behaviour** | cron routes bare M9 delegates, no `provideCandidate*`/`produce*Requests`/`createCompletedRowLoader` (`:539`); modules use no `Date.now`/`Math.random`/`correctionCause`/`currentValidationHeads` (`:553`) | **PASS** |
| 12 | **compatibility** | no-deadline→full batch back-compat (`:203`); bare settlement runner empty-safe (`:526`); capture back-compat via regression (`evidenceCapturePipeline` 9/9) | **PASS (capture via regression)** |
| 13 | **regression** | full **1824/1824**; anchors green — provider 48, capture-pipeline 9, settlement-pipeline 26, archive-state 25, M8 34, M9 29 | **PASS** |

**Score: 13/13 dimensions covered** (11 with direct dedicated tests; #2/#12 capture-side via shared-code symmetry + regression).

---

## 2. Per-Dimension Audit Notes

**Deadline (INV-D) — thorough.** The clamp is verified against a named constant `EFFECTIVE_DEADLINE_HARD_MAX_MS` and the ≤45 s bound; the 300 s legacy config is proven never-honoured; every degenerate config (0/neg/NaN/Infinity/string/undefined/null) fails safe to 45 000; a non-finite injected clock yields `remainingMs=0` (defer everything). The clock-never-enters-identity claim is asserted by the dormancy guard (no `Date.now` in the module).

**Ceiling (INV-C) — exhaustive.** All boundaries incl. the keystone `500→150` (the legacy `DEFAULT_CAPTURE_MAX_FIXTURES` can never be effective). Deferred-by-cap overflow accounting is proven via the RC-1 identities, not dropped.

**RC-1 — the strongest part.** The four-grain closure (row→fixture→derivation→batch) is proven with a real `planCaptureCandidates` run (3 distinct-market rows → 1 fixture, `admitted=3`, `grouped=1`) so the N−1 "unaccounted rows" hole is demonstrably closed, plus a hand-built case exercising malformed + every reject grain. Settlement's single-grain identity is separately proven. A deliberate mismatch is shown detectable (`ok=false`) yet correctly non-fatal.

**RC-2 — correctly scoped and proven.** The between-candidate deferral is proven to commit the in-flight prefix and never begin the deferred remainder (`listValidations(FIX+1).length === 0`). The hung-loader residual is explicitly deferred to Stage 2E (NB-1) — correctly out of scope, not a coverage gap.

**Loader — whole-source-fail-closed + per-row isolation** are both directly proven, including the critical "throw/null → `ProducerError`, never `[]`" fail-closed guarantee and matchId-asc determinism. The concrete production reader is (correctly) an injected activation dependency, not fabricated.

**Metrics — bounded and best-effort.** Real `metrics` module used (`reset`/`snapshot` confirmed to exist); labels are `{job,outcome|reason}` only; null oldest-age emits no gauge; a broken sink never throws out of the job.

**Dormancy & Compatibility.** Both cron routes proven to be bare M9 delegates; the no-deadline path proven byte-compatible (full batch); the bare runner empty-safe. Capture back-compat is carried by the 9/9 `evidenceCapturePipeline` regression rather than a 2D-suite test (see C-1).

---

## 3. Existing Coverage Summary

29 Stage 2D tests, all green, deterministic: **deadline (5) · guard (4) · ceiling (1) · RC-1/accounting (4) · flatten (1) · typed codes (1) · metrics (2) · loader (5) · integration (4) · dormancy (2)**. Regression anchors re-run green: `evidenceCandidateProvider` 48 (RC-1 counters surfaced), `evidenceCapturePipeline` 9, `evidenceSettlementPipeline` 26, `evidenceArchiveStateBuilders` 25, `evidenceSettlement` 34, `m9Activation` 18, `m9Concurrency` 11. Independent inspection confirms: the runner engages the deadline only on a producer path (`usingProducer`), fills `candidatesProcessed` from the batch, sets `run_degraded` as a visibility flag that does not flip HTTP status, and keeps the frozen `write_failed`/`immutable_violation` hard-fail path — matching the tests.

---

## 4. Missing / Weak Tests (non-blocking)

- **C-1 — Capture-side integration + capture deadline guard.** No test drives `runEvidenceCaptureJob({provideCandidateBatch})` or `runCaptureBatch(…, {deadline})`. The capture producer path, its merged `resultCounts` (incl. `healing`, `run_degraded`), and its between-candidate defer are exercised only by symmetry with settlement + the pre-2D `evidenceCapturePipeline` (which still uses the old array seam). **Recommended:** one capture integration test (real `produceCaptureRequests` via `provideCandidateBatch` → merged counts) and one `runCaptureBatch` deadline-defer test.
- **C-2 — Runtime reconciliation.** `reconcile*` is unit-only; the runner never computes it, so a real-run count mismatch is not surfaced/logged as §11 asserts. **Recommended:** either invoke `reconcile*` inside `mergeProducerResultCounts` and log `recon.ok` (turning the "observable" claim true), or downgrade the §11 wording. Non-blocking (metrics-consistency, not correctness).
- **C-3 — Typed-code breadth.** `producerErrorCode` unit-asserts 2 of 5 bounded codes (`source_load_failed`, `archive_conflict`); the integration test adds `archive_read_failed`. `invalid_source_row` and `discovery_failed` are defined but never asserted. Minor.
- **C-4 — Entity-id heuristic.** The flatten "no entity id" check is `!/\d/.test(key)` — a reasonable proxy that assumes no legitimate metric key carries a digit (true today). Acceptable; note only.

None leaves a Stage 2D behaviour both plausibly-wrong and unguarded: the shared runner machinery is proven on the settlement path, and capture accounting/ceiling are unit-proven via `planCaptureCandidates`/`resolveEffectiveCeiling`.

---

## 5. Deferred (correctly out of Stage 2D — not counted against it)

Per the impl record §14/§16/§17: the RC-2 hung-loader timeout (NB-1); representative-depth/event-loop/RSS **benchmarks** validating the provisional `reservePerCandidateMs`/headroom constants; multi-worker overlap + crash/replay matrices; route activation; H-1 unlock-500; live completed-rows production reader + M4→M5 capture derivation; corrections. The deadline **math** is unit-proven here; its empirical fit is a Stage-2E benchmark.

---

## 6. Blocking Gaps

**None.** Every audit dimension is covered and green; RC-1/RC-2 are directly proven; the loader is fail-closed; metrics are bounded and best-effort; dormancy and back-compat hold; frozen M6/M8 are untouched (confirmed — the deadline guard sits in the M9 orchestrators, `run_degraded` never flips a write outcome, and no `types/evidence/*`/archive-format change). The two conditions (C-1 capture-side symmetry, C-2 runtime reconcile) are coverage/observability completeness, not defects.

---

## 7. Validation Results (re-run this pass)

| Check | Command | Result |
|---|---|---|
| **Stage 2D operational controls** | `node --test tests/evidenceOperationalControls.test.ts` | **29 pass / 0 fail / 0 skip** |
| **Stage 1 provider (RC-1 grain)** | `… tests/evidenceCandidateProvider.test.ts` | **48 / 0 / 0** |
| **Stage 2B capture pipeline** | `… tests/evidenceCapturePipeline.test.ts` | **9 / 0 / 0** |
| **Stage 2C settlement pipeline** | `… tests/evidenceSettlementPipeline.test.ts` | **26 / 0 / 0** |
| **Stage 2A archive-state** | `… tests/evidenceArchiveStateBuilders.test.ts` | **25 / 0 / 0** |
| **M8 settlement** | `… tests/evidenceSettlement.test.ts` | **34 / 0 / 0** |
| **M9 activation / concurrency** | `… tests/m9Activation.test.ts` · `m9Concurrency.test.ts` | **18 / 0 / 0** · **11 / 0 / 0** |
| **Full suite** | `npm test` (`tests/*.test.ts`) | **1824 pass / 0 fail / 0 skip** (1..1824) |
| **Typecheck** | `npm run typecheck` | **clean — exit 0** |
| **Lint** | `npm run lint` | **clean — no ESLint warnings or errors** |

Consistent with the impl record's **1795 + 29 = 1824**. No suite was flaky across runs.

---

## 8. Verdict

### TEST COVERAGE CONDITIONALLY APPROVED

Stage 2D's operational-controls tests are green (29/29), the full suite is **1824/1824**, typecheck exit 0, lint clean, and all 13 audit dimensions are covered — deadline (INV-D clamp/guard), ceilings (INV-C, incl. `500→150`), diagnostics flatten + merged `resultCounts`, RC-1 four-grain reconciliation proven to close, RC-2 between-candidate deferral with prefix-commit, the fail-closed completed-rows loader with per-row isolation, bounded best-effort metrics, dormancy, back-compat, and full regression. Frozen M6/M8 and all `types/evidence/*` are untouched; the controls are additive and default-inert.

Approval is **conditional** on two non-blocking items: **C-1** — the capture path shares the new runner/batch controls but is integration-tested only via settlement (add a capture `provideCandidateBatch` + `runCaptureBatch` deadline-defer test to close the asymmetry); and **C-2** — `reconcile*` is unit-only and not invoked at runtime, so §11's "logged/observable" mismatch posture should be wired or reworded. Deferred Stage-2E benchmarks (which validate the provisional reserve/headroom constants), the hung-loader timeout, overlap/crash matrices, and live activation are correctly out of scope and are not held against this stage.

---

## Final Response Summary

- **Verdict:** **TEST COVERAGE CONDITIONALLY APPROVED.**
- **Blocking gaps:** **none.**
- **Non-blocking conditions:** C-1 add capture-side integration + `runCaptureBatch` deadline-defer test (capture currently covered only by shared-code symmetry + regression); C-2 wire `reconcile*` into the runtime merge (or reword the §11 "observable" claim). Minor: C-3 assert the remaining 2 of 5 producer error codes; C-4 the `/\d/` entity-id heuristic.
- **Deferred (not counted against 2D):** reserve/headroom benchmark validation, hung-loader timeout (NB-1), overlap/crash matrices, route activation, H-1 unlock-500, live completed-rows reader + M4→M5 derivation, corrections.
- **Exact validation results:** Stage 2D **29/29**; provider **48/48**; capture-pipeline **9/9**; settlement-pipeline **26/26**; archive-state **25/25**; M8 **34/34**; M9 **18/18 + 11/11**; **full suite 1824/1824** (0 fail, 0 skip); typecheck **exit 0**; lint **clean**.
- **Files modified:** exactly one created — `docs/plans/m10-stage-2d-test-coverage-review.md`. **No runtime or test code was modified; review-only confirmed.**

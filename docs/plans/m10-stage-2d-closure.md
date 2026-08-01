# M10 Stage 2D — Operational Controls — Closure Record

**Document type:** Formal milestone closure & reconciliation (documentation-only). **No runtime code, test, route, flag, configuration, archive, database, scheduler, or deployment was modified.** The only file created is this document.
**Milestone:** Sprint 23B — M10 (Live Candidate Pipeline), **Stage 2D — Operational Controls**.
**Date:** 2026-07-30
**Governing spec:** `docs/architecture/m10-live-candidate-pipeline-specification.md` (Rev A1) — §7.2 (INV-C), §7.3 (INV-D), §7.4 (INV-S), §7.5 (INV-A), §10 (observability).

**Inputs reconciled:** the Stage-2D plan + implementation record; the five independent implementation reviews (implementation APPROVED; production CONDITIONALLY PASSED; performance CONDITIONALLY PASSED; test-coverage CONDITIONALLY APPROVED; migration COMPATIBLE); and the Stage-2B/2C closures. Source was inspected only to reconcile conflicting claims (OB-1/C-2 confirmed from `lib/jobs/runner.ts`).

---

## 1. Executive Status

Stage 2D added the **operational-safety envelope** around the already-closed Stage-2B capture and Stage-2C settlement candidate pipelines — the INV-D effective deadline (injected clock, clamped ≤45 s), the between-candidate remaining-time guard (defer-not-overrun), the INV-C ceilings (default 100 / hard 150, never 500), bounded diagnostics aggregation, typed operational producer error codes, backlog/oldest-pending metrics, and a **dormant** completed-fixture-row loader with whole-source + per-row isolation — **without changing any evidence business logic, any frozen contract, any schema, or the dormant-at-the-route posture.**

Every change is additive (an optional parameter or a new module) in the M10 producer / M9 orchestration layer; the frozen M6/M8 cores, `types/evidence/*`, identity/hash/revision/`settledAt` formulas, archive NDJSON format, both cron routes, and flag defaults are untouched. The implementation reports COMPLETE with **20/20 acceptance criteria**, **29** new tests, full suite **1824/1824**, typecheck exit 0, lint clean. All five reviewers report **zero blockers**. RC-1 (capture accounting grain) and RC-2 (cancellation policy) are resolved.

## 2. Final Closure Verdict

# STAGE 2D COMPLETE — DORMANT OPERATIONAL CONTROLS

No true blocker was discovered while reconciling the five reviews. All "CONDITIONALLY" qualifiers concern **activation readiness** (representative-depth benchmark, live source reader, route composition, coverage completeness) — none indicates a correctness or safety defect in the dormant slice.

## 3. Review Verdict Table

| # | Review | Verdict | Immediate blockers | Nature of conditions |
|---|---|---|---|---|
| 1 | Implementation | **APPROVED** | none | 2 non-blocking observations (OB-1 reconcile helpers not runtime-wired; OB-2 stale docstring) |
| 2 | Production Safety | **CONDITIONALLY PASSED** | none | Carry-forward = activation gates (B5 benchmark, live reader, loader cancel, H-1, fsync/sweep, durable alerting, single-writer) |
| 3 | Performance | **CONDITIONALLY PASSED** | none | Provisional `reservePerCandidateMs`/headroom to validate at Stage-2E Gate B5; inherited deep-archive scaling = 2E |
| 4 | Test Coverage | **CONDITIONALLY APPROVED** | none | C-1 capture integration asymmetry; C-2 reconcile helpers unwired; C-3 remaining error-code asserts; C-4 entity-id heuristic |
| 5 | Migration / Frozen Contract | **COMPATIBLE** | none | none — schema NO, migration NO, additive, dormant, rollback-safe |

**Reconciliation:** the lone APPROVED verdict and four CONDITIONAL verdicts do **not** conflict. All five independently confirm zero blockers and a correct, dormant, additive slice; the four conditions are disjoint activation/coverage items (§16, §17), not defects. Consensus: **close**.

## 4. Implementation Scope Completed

- **Effective deadline (INV-D)** — `resolveEffectiveJobDeadlineMs` + `createDeadline` (injected `now`) + `shouldStartNext`.
- **Remaining-time guard** — additive optional `deadline?` on `runCaptureBatch`/`runSettlementBatch`; between-candidate defer; `deferredByDeadline` count.
- **Ceilings (INV-C)** — `resolveEffectiveCeiling` (reuse `normalizeBatchLimit`, `[1,150]`, default 100); `effectiveCeiling` surfaced.
- **Diagnostics aggregation** — `provideCandidateBatch?` rich seam + `flattenDiagnostics` + `mergeProducerResultCounts` (best-effort; fills `candidatesProcessed`; `run_degraded` flag).
- **Typed producer errors** — `ProducerError`/`producerErrorCode` (`source_load_failed`/`archive_read_failed`/`archive_conflict`/`invalid_source_row`/`discovery_failed`).
- **Backlog & oldest-pending metrics** — `emitProducerMetrics` (bounded `{job,outcome|reason}`; gauges).
- **Completed-rows loader** — `filterCompletedRows` (pure) + `createCompletedRowLoader` (whole-source + per-row isolation) — **dormant, injected**.
- **RC-1 counters** — `sourceRowsAdmitted` + `groupedFixtures` + reconcilers.
- **Config** — additive `resolveEvidenceOperationalConfig` (no existing default changed).

Files created (4) and modified additively (8) exactly as reported in the implementation record §1; no other files touched.

## 5. Acceptance Criteria Result

**20 / 20 PASSED** (AC-1…AC-20): deadline ≤45 s (AC-1); injected clock never in evidence data (AC-2); guard between candidates (AC-3); no append interrupted (AC-4); deferrals counted + cursor-free rediscovery (AC-5); default 100 / hard 150 / 500-never-effective (AC-6/7/8); bounded diagnostics (AC-9); typed additive codes (AC-10); metrics no authoritative state/no extra scan (AC-11); loader dormant/injected (AC-12); whole-source fail-closed + per-row isolated (AC-13); RC-1 resolved with row+candidate grain (AC-14); RC-2 resolved without unsafe cancel/scope expansion (AC-15); M6/M8/schemas unchanged (AC-16); corrections excluded (AC-17); routes dormant (AC-18); no migration (AC-19); targeted+full+typecheck+lint green (AC-20).

## 6. Validation Evidence

| Check | Result | Source |
|---|---|---|
| Stage-2D operational controls | **29 / 0 / 0** | re-run this pass (consistency check) |
| Full suite (`npm test`) | **1824 / 0 / 0** | implementation record + reviews (mutually consistent) |
| Typecheck (`npm run typecheck`) | **clean — exit 0** | implementation record + reviews |
| Lint (`npm run lint`) | **clean** | implementation record + reviews |
| Anchors (2A 25 · 2B 9 · 2C 26 · S1 48 · M8 34 · M9 act 18 · M9 conc 11) | **171 / 0 / 0** | reviews |

Baseline continuity: Stage 2C closed at 1795/1795; Stage 2D adds +29 → **1824/1824**. The five review documents and the implementation record report identical fresh green results; the numbers are mutually consistent. (This closure re-ran only the 29-test Stage-2D suite to verify the headline count; no source or test was changed.)

## 7. RC-1 Resolution (capture accounting grain)

Capture mixed row-grain (`sourceRowsDiscovered`) and fixture-grain (`candidatesEligible`); N distinct-market rows merging into one fixture left N−1 rows unaccounted. **Resolved** by two additive bounded counters — `sourceRowsAdmitted` (rows admitted into a group) and `groupedFixtures` (distinct groups) — and a four-grain `reconcileCaptureDiagnostics` (row → fixture → selected → emitted) that closes with **zero unaccounted rows**. Unit-proven: 3 distinct-market rows → 1 fixture (`admitted=3`, `grouped=1`, identity closes). Settlement is single-grain (`reconcileSettlementDiagnostics`) and needs no counter. **RC-1: RESOLVED.**

## 8. RC-2 Resolution (cancellation policy)

Stage 2D introduces **no unsafe mid-append cancellation and no cancellation framework**. The mechanism is **between-candidate deferral**: the guard runs at the loop top before starting each candidate and never interrupts an in-flight atomic append (proven — the committed prefix persists, the deferred tail never begins). Cooperative `AbortSignal` cancellation of loader/M4 (production SD-3) is **deferred**: live M4 network derivation is unbuilt (out of scope), and the D-9 loader is **read-only** and bounded at the orchestration boundary, so a slow loader consumes budget but can never tear an evidence/validation write. Documented residual (Stage 2E): a *hung* read is bounded only by the 60 s platform kill — safe because read-only, not graceful; a deadline-bounded loader timeout is the recommended 2E hardening. **RC-2: RESOLVED.**

## 9. Deadline and Ceiling Guarantees

- **Deadline:** `min(configured, min(routeBudget−headroom, 45000))` with fail-safe on invalid/0/neg/NaN; the 300 s `DEFAULT_RUN_DEADLINE_MS` clamps to 45 000 and is never honoured; injected clock; a non-finite `now()` ⇒ `remainingMs=0` (defer everything). The clock is a *decision* input only — never in `capturedAt`/`completionInstant`/`nowSec`/identity/hash/ordering (static guard verified).
- **Ceiling:** `[1,150]`, default 100, `>150→150`, invalid→100; **500 clamps to 150** (never the effective ceiling); overflow deferred+counted, cursor-free rediscovery (INV-A); engaged only on a producer path (bare/static path byte-identical).

## 10. Diagnostics and Accounting Guarantees

Producer `CandidateDiagnostics` (previously dropped at the array-only seam) are flattened into `resultCounts` under **fixed aggregate keys + `rejected_<reason>` over the seeded, closed reason set** (cardinality cannot grow; `bumpReason` ignores unknown keys). All values finite; **no fixtureId/matchId/captureId/validationId ever a key**. Merge is **best-effort** — a throw falls back to batch counts and never flips a `succeeded` job. `run_degraded` is a **visibility flag** derived from counted-but-safe rejects that does **not** change `hardFailed`/HTTP status (frozen no-false-write preserved). Reconciliation identities are **unit-proven**; no candidate is silently dropped (deadline/cap deferrals counted and rediscoverable).

## 11. Loader Isolation Guarantees

- **Whole-source failure** (reader throws / returns `null`) → `ProducerError("source_load_failed")` → run `failed`; **never** a silent empty-success `[]`.
- **Per-row fault** → dropped + counted by bounded reason (`malformed_row`/`invalid_fixture_id`/`invalid_kickoff`/`invalid_final_score`/`unresolved_lifecycle`/`duplicate_row`); valid rows continue; non-terminal rows excluded (not a fault).
- **Read-only, deterministic** (matchId-asc order; terminal set via the authoritative `resolveMatchLifecycle`; `nowSec` injected, no clock). The **concrete production reader is an injected activation dependency, deliberately not fabricated and not route-wired.**

## 12. Dormancy Proof

Both cron routes remain the bare M9 delegates (`runEvidenceCaptureJob()` / `runPredictionSettlementJob()`); a scope-guard test asserts they wire no `provideCandidate*`, no `produce*Requests`, and no `createCompletedRowLoader`. No flag default changed; the producer is not route-composed; the loader is built-but-not-wired. The deadline engages only when a producer seam is supplied → the bare fire and the M9 static-candidates path are byte-for-byte unchanged (171/171 anchors green). A static-guard test asserts the two new modules use no `Date.now`/`Math.random`/`correctionCause`/`currentValidationHeads`.

## 13. Frozen-Contract Proof

Migration review confirms (and source inspection corroborates) **no change** to M6 (`capture.ts`/`mandatory-odds.ts`), M8 (`settlement.ts`/`outcomes.ts`/`validation/*`), `ValidationRecord`, `EvidenceSnapshot`, `SettlementCandidate` frozen fields, `validationId`/`revisionId`/revision/`settledAt`/`contentHash` formulas, `modelVersion`/`evidenceInputVersion`, archive NDJSON format, append-only/correction semantics, or cron-route state. No frozen core result enum or persisted record type was widened; operational diagnostics live only in the ephemeral `CandidateDiagnostics`/`resultCounts` open maps. Typecheck exit 0 corroborates no contract drift.

## 14. Schema and Migration Decision

**Schema change: NONE. Migration: NOT REQUIRED.** No new column/field on any persisted record, no DDL, no backfill, no `isCurrent`/`supersededBy` flag. The four additive `CandidateDiagnostics` fields and the batch-count `deferredByDeadline` are ephemeral, in-memory job-run accounting — not archive records. Migration reviewer verdict COMPATIBLE with zero blockers.

## 15. Rollback Assessment

**Rollback-safe (HIGH).** Every control is an optional parameter or a new module; the dormant route and all default call sites are byte-for-byte unchanged. Rollback = drop the optional params / delete the two new modules + the additive fields — no schema, no migration, no persisted state to unwind. The append-only archive + frozen contracts guarantee even an accidental producer-driven fire under these controls is bounded, fail-closed, and first-settle-only.

## 16. Reconciled Non-blocking Observations

| ID | Observation | Reconciliation | Class |
|---|---|---|---|
| OB-1 / C-2 | `reconcileCapture/SettlementDiagnostics` are unit-proven but not invoked in runtime `mergeProducerResultCounts` (confirmed from `runner.ts` this pass). | **Does not invalidate RC-1** (Decision 1): the row/fixture grains are represented by explicit bounded counters, the identities are unit-proven, and the raw counters are surfaced in `resultCounts` — no accounting data is lost, and the slice is dormant. Optional runtime reconcile-and-log is **Stage-2E observability hardening**, not Stage-2D remediation. | 2D cleanup (doc wording) / 2E observability |
| OB-2 | Stale settlement-job docstring omits `provideCandidateBatch`. | Cosmetic; the code path is correct and tested. | 2D cleanup |
| C-1 | Capture-side integration coverage weaker than settlement (no capture `provideCandidateBatch` / `runCaptureBatch` deadline-defer integration test). | **Does not invalidate Stage 2D** (Decision 2): the capture seam and guard are implemented, the shared operational primitives are unit-tested, capture regressions are green, and the code is dormant (no live route reaches it). **Dedicated capture integration coverage required before activation.** | 2E preparation |
| C-3 | Assert the remaining bounded producer error codes. | Additional test assertions only. | 2D cleanup |
| C-4 | Improve the entity-ID diagnostic-key test heuristic. | Test-heuristic refinement only. | 2D cleanup |

**Decision 3 (conditional verdicts):** the conditional production, performance, and test verdicts refer to **activation readiness, representative-depth validation, and coverage completeness** — they do **not** indicate an immediate correctness or safety defect in the dormant Stage 2D implementation.

## 17. Explicit Carry-Forward Register

**A. Stage 2D cleanup — optional, non-blocking (4):** OB-2 stale settlement-job docstring; C-3 assert remaining producer error codes; C-4 entity-ID diagnostic-key heuristic; optional wording correction around reconciliation observability (OB-1/C-2).

**B. Stage 2E preparation / activation gates — required before activation (13):** Gate-B5 representative-depth benchmark; tune `reservePerCandidateMs` + 15 s headroom at measured depth; measure total discovery+batch runtime vs the 60 s budget; concrete completed-row source reader; route composition; feature-flag + activation wiring; capture `provideCandidateBatch` integration test (C-1); capture `runCaptureBatch` deadline-defer integration test (C-1); validate no extra archive reads after live composition; loader timeout/cancellation decision (RC-2 residual); overlap/crash/restart/retry matrices; durable metrics/alerting design; single-writer configuration validation.

**C. Stage 2E or adapter hardening (5):** H-1 unlock-500; fsync/sweep; deep-archive scaling validation; Postgres adapter depth validation; inherited M6/M8 amplification measurement.

**D. Correction stage (6):** `currentValidationHeads`; `correctionCause`; correction classification; correction revision construction; correction activation; correction archive & replay tests. *(No correction item is pulled into Stage 2E; corrections remain a separate stage the architecture gates independently.)*

## 18. Stage 2E Authorization Decision

**Decision 4:** authorize **STAGE 2E PREPARATION AND PLANNING** only. Stage 2E production activation is **not** authorized directly — Stage 2E must first produce its plan and undergo independent pre-implementation reviews (architecture, safety, performance, test, migration), exactly as each prior stage was prepared. The §17-B activation gates and §17-C hardening are prerequisites to any live enablement.

## 19. Explicit Exclusions

Not performed in Stage 2D and not authorized by this closure: route activation; production-flag enablement; a live/production completed-row source reader; corrections / `currentValidationHeads` / `correctionCause`; any `ValidationRecord`/evidence-schema/archive-format change; any database migration; Stage-2E benchmarks/matrices/H-1/fsync/sweep/single-writer/Postgres work; live M4→M5 capture derivation. This closure makes **no** claim of M10 completion or production readiness.

## 20. Final Confirmation Checklist

- NO runtime code modified (closure is documentation-only) ✅
- NO test modified ✅
- NO route activated ✅
- NO flag enabled ✅
- NO production source reader wired ✅
- NO schema changed ✅
- NO migration created ✅
- NO correction behavior implemented ✅
- NO Stage 2E implementation performed ✅
- Frozen M6/M8 cores + `types/evidence/*` unchanged ✅
- Five reviews reconciled; zero blockers; RC-1 + RC-2 resolved; 20/20 acceptance criteria ✅

---

STAGE 2D COMPLETE — DORMANT OPERATIONAL CONTROLS

Blockers:
NONE

RC-1:
RESOLVED

RC-2:
RESOLVED

Acceptance criteria:
20 / 20 PASSED

Validation:
1824 PASS / 0 FAIL / 0 SKIP
TYPECHECK CLEAN
LINT CLEAN

Route activation:
NOT PERFORMED

Production source reader:
NOT WIRED

Schema change:
NONE

Migration:
NOT REQUIRED

Correction behavior:
NOT IMPLEMENTED

Stage 2E:
PREPARATION AND PLANNING AUTHORIZED

Stage 2E production activation:
NOT YET AUTHORIZED

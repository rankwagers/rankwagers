# M10 Stage 2D — Implementation Review (Operational Controls) — v4 (Post-Implementation Correctness)

**Reviewer:** Independent implementation-correctness reviewer (Stage 2D).
**Date:** 2026-07-30
**Milestone:** Sprint 23B — M10 (Live Candidate Pipeline), **Stage 2D — Operational Controls**.
**Type:** Read-only implementation review. **No runtime code, test, route, contract, M8/M9, archive, configuration, database, environment, scheduler, or deployment was modified.** The only file created/updated is this document.
**Supersedes:** the v3 plan re-review (CONDITIONALLY APPROVED — plan authorized, RC-1/RC-2 to be pinned at build). Stage 2D is now **implemented**; this review verifies the code against the approved plan and runs the full validation suite.

**Inputs read completely:** `docs/architecture/m10-live-candidate-pipeline-specification.md`; `docs/plans/m10-stage-2d-operational-controls-plan.md`; `docs/plans/m10-stage-2d-operational-controls-implementation.md` (the implementation record); the five preparation reviews.
**Implementation files inspected (file:line):**
- `lib/evidence-capture/candidates/operational.ts` (whole) — `resolveEffectiveJobDeadlineMs`, `createDeadline`, `shouldStartNext`, `resolveEffectiveCeiling`, `ProducerError`/`producerErrorCode`, `reconcile{Capture,Settlement}Diagnostics`, `flattenDiagnostics`, `emitProducerMetrics`.
- `lib/evidence-capture/candidates/completed-rows.ts` (whole) — `filterCompletedRows`, `createCompletedRowLoader`.
- `lib/jobs/runner.ts:279-536` — `producerDeadlineBudget`, `mergeProducerResultCounts`, both job functions (`provideCandidateBatch?` seam + injected `now?` + typed `errorCode` + `run_degraded`).
- `lib/evidence-capture/jobs/capture-run.ts:104-177`, `settlement-run.ts:141-194` — additive `deadline?` guard.
- `lib/evidence-capture/candidates/capture-provider.ts:92-191` — RC-1 counters (`sourceRowsAdmitted`, `groupedFixtures`, `effectiveCeiling`); `settlement-provider.ts:89-145`.
- `lib/evidence-capture/candidates/{types,diagnostics}.ts` — 4 additive fields, seeded to 0.
- `lib/evidence-capture/config.ts:120-153` — `resolveEvidenceOperationalConfig` + provisional constants.
- both cron routes; frozen `capture/capture.ts`, `capture/mandatory-odds.ts`, `settlement.ts`, `outcomes.ts`.

---

## 1. Review Summary

The Stage 2D implementation **faithfully realizes the approved plan** and resolves both required clarifications. It lands entirely in the M9 orchestration layer (`runner.ts`, `{capture,settlement}-run.ts`) and the M10 producer layer (`operational.ts`, `completed-rows.ts`, provider counters), leaving every frozen M6/M8 core, every `types/evidence/*` contract, both cron routes, and all flag defaults byte-for-byte unchanged. Every seam is additive-optional; the bare-fire and static-candidate paths are unchanged (proven by 1824/1824 green, including the untouched M9 anchor suites).

- **Deadline (INV-D)** is a pure resolver clamped to `min(routeBudget − headroom, 45_000)`, driven by an **injected** clock, fail-safe on any bad input, and never enters an artifact.
- **Remaining-time guard** defers the tail **before** starting each candidate (both batches, at loop top, before any store touch), never mid-append.
- **Ceilings** flow through `normalizeBatchLimit` → `[1,150]`, default 100, `500→150`; overflow deferred + counted.
- **RC-1 resolved**: `sourceRowsAdmitted` + `groupedFixtures` counters make the capture row-grain identity close with zero unaccounted rows (verified: every source row falls into exactly one of malformed / row-reject / admitted).
- **RC-2 resolved**: cancellation is between-candidate deferral only; `AbortSignal`/M4 abort is explicitly deferred with a read-only-loader safety justification and a documented hung-loader residual (Stage 2E).
- **Diagnostics/metrics** are bounded, low-cardinality, entity-id-free, and best-effort (a merge/emit throw cannot fail a job).
- **Typed codes** are additive and operational-only; `run_degraded` is a visibility flag that does not flip `hardFailed`.
- **Loader** is dormant, injected, deterministic, terminal-only, fail-closed on whole-source failure, per-row-isolated — and **not route-wired**.

**Validation:** full suite **1824/1824** (1795 baseline + 29 new), 0 fail / 0 skip; typecheck exit 0; lint clean. Stage 2D 29/29; anchors (provider 48, archive-state 25, capture-pipeline 9, settlement-pipeline 26, settlement 34, m9Activation 18, m9Concurrency 11) = 171/171.

Two **non-blocking observations** (OB-1, OB-2 in §5) — one a dormant-path wiring gap where all raw counters are nonetheless externally reconcilable, one a stale docstring. Neither is an implementation defect.

**Verdict: APPROVED.**

---

## 2. Correctness Verification (by dimension)

| Dimension | Verified behaviour | Anchor | Status |
|---|---|---|---|
| **Deadline resolver** | `clamp(min(configured, min(budget−headroom, 45_000)), 1, …)`; 300 s → 45_000; invalid/0/neg/NaN → bounded upper (never 300 s, never unbounded) | `operational.ts:49-63` | ✅ |
| **Injected clock** | `createDeadline({now})`; non-finite `now()` ⇒ `remainingMs=0` (defer-all); no `Date.now`/`Math.random` in module (static-guard test 29) | `operational.ts:74-86` | ✅ |
| **Remaining-time guard** | `shouldStartNext` = finite `remainingMs ≥ reserve`; both batches check at loop top **before any store touch**, defer tail `= length − i`, `break` | `operational.ts:92-102`; `capture-run.ts:113-119`; `settlement-run.ts:150-155` | ✅ |
| **Ceilings** | `resolveEffectiveCeiling = normalizeBatchLimit` → `[1,150]`, default 100, 500→150; both providers surface `effectiveCeiling`; overflow → `candidatesDeferredByCap` | `operational.ts:119-121`; `capture-provider.ts:187-190`; `settlement-provider.ts:144-145` | ✅ |
| **Diagnostics aggregation** | `flattenDiagnostics` fixed aggregate keys + `rejected_<reason>` over seeded closed set; all `finite()`; merged best-effort into `resultCounts` | `operational.ts:297-318`; `runner.ts:317-337` | ✅ |
| **Typed failure codes** | `ProducerError{code}` bounded 5-member set; runner catch → `producerErrorCode(err) ?? "unhandled"`; `failed→500` unchanged; never converts failure↔success | `operational.ts:127-153`; `runner.ts:389-397,486-494` | ✅ |
| **Accounting (RC-1)** | 4-grain capture reconciliation; row identity `discovered = malformed + rowRejects + admitted` closes (each row exactly one bucket) | `operational.ts:219-249`; `capture-provider.ts:98-143` | ✅ (OB-1) |
| **Backlog metric** | `backlogSize = deferredByCap + deferredByDeadline` (set in merge); gauge `evidence_producer_backlog{job}` | `runner.ts:330`; `operational.ts:354` | ✅ |
| **Oldest-pending metric** | computed vs **injected** `evalMs` (`oldestAge`), not a wall clock; gauge dropped when null/non-finite | `capture-provider.ts:246-255`; `operational.ts:355-357` | ✅ |
| **Loader** | `filterCompletedRows` pure, terminal-only via `resolveMatchLifecycle`, deterministic matchId-asc, dedup; injected `nowSec` | `completed-rows.ts:62-123` | ✅ |
| **Loader isolation** | whole-source throw/`null` → `ProducerError("source_load_failed")` (never `[]`); per-row faults dropped+counted; read-only | `completed-rows.ts:145-169` | ✅ |
| **Dormant behaviour** | both routes bare delegates (`runEvidenceCaptureJob()` / `runPredictionSettlementJob()`); deadline engaged only on a producer path; loader not route-composed | routes; `runner.ts:399-406,496-503` | ✅ |
| **M8 compatibility** | guard sits around `settleLatestSnapshotForFixture`; deferred candidate not passed to M8; `settlement.ts`/`outcomes.ts` carry no 2D marker; first-settle firewall intact (no `correctionCause`/heads consumed) | grep clean | ✅ |
| **M9 compatibility** | optional `deadline?`/`provideCandidateBatch?`/`now?`; absent ⇒ current behaviour; lock/flag/route envelope untouched; M9 suites green | `runner.ts`; 29/29 m9 | ✅ |
| **Determinism** | operational clock is decision-only; never in `capturedAt`/`completionInstant`/`nowSec`/identity/hash/ordering; static-guard test asserts no `Date.now`/`Math.random`/`correctionCause`/`currentValidationHeads` | test 29 | ✅ |
| **Rollback safety** | additive optional params + 2 new modules + 4 additive fields; no schema/migration/persisted state | `implementation.md §19` | ✅ |

---

## 3. RC-1 / RC-2 Resolution Verification

**RC-1 (capture accounting grain) — RESOLVED and verified at source.** `sourceRowsDiscovered = input.sourceRows.length` (row grain). The group loop routes each row into exactly one bucket: null/non-object or invalid fixtureId → `sourceRowsMalformed++`; `unsupported_market` → row reject; `duplicate_candidate` → row reject; otherwise `sourceRowsAdmitted++` (`capture-provider.ts:98-139`). `groupedFixtures = groups.size` (`:143`). `reconcileCaptureDiagnostics` (`operational.ts:219-249`) asserts `discovered = malformed + (unsupported_market + duplicate_candidate) + admitted`, `groupedFixtures = eligible + fixtureRejects`, `eligible = selected + deferredByCap`, `selected = emitted + derivationRejects`, `emitted = processed + deferredByDeadline`. The row identity **closes with zero unaccounted rows** — the N−1 hole the plan flagged is eliminated. Test proves 3 distinct-market rows → 1 fixture (admitted=3, grouped=1) reconciles. Settlement stays single-grain (`reconcileSettlementDiagnostics`), correct.

**RC-2 (cancellation model) — RESOLVED as a documented scope statement.** The implementation introduces **no** `AbortSignal` framework and **no** mid-append cancellation. Cancellation is between-candidate deferral (the guard runs before starting each candidate; an in-flight atomic append always completes). The completed-rows loader is **read-only** and runs at the orchestration boundary before the batch, bounded by the pre-batch remaining-time posture — a slow loader consumes budget but can never tear an evidence/validation write. The residual (a *hung* reader bounded only by the 60 s platform kill; safe because read-only) is documented in `completed-rows.ts:13-17` and `implementation.md §8/§16`, with the deadline-bounded loader timeout named as the Stage-2E hardening (NB-1). This matches production SD-3's intent within the 2D envelope and states the deferral explicitly.

---

## 4. Validation Results

| Check | Command | Result |
|---|---|---|
| Stage-2D operational controls | `--test tests/evidenceOperationalControls.test.ts` | **29 pass / 0 fail / 0 skip** |
| Anchors (provider 48 · archive-state 25 · capture-pipeline 9 · settlement-pipeline 26 · settlement 34 · m9Activation 18 · m9Concurrency 11) | combined run | **171 / 0 / 0** |
| Full suite | `npm test` (`tests/*.test.ts`) | **1824 / 0 / 0** (1795 baseline + 29 new) |
| Typecheck | `npm run typecheck` | **exit 0** |
| Lint | `npm run lint` | **clean — no warnings/errors** |
| Dormancy | route grep | both routes call the **bare** job; no `provideCandidate*`/`produce*`/`createCompletedRowLoader`/`deadline` |
| Frozen cores | marker grep | **no** 2D marker in `capture.ts`/`mandatory-odds.ts`/`settlement.ts`/`outcomes.ts` |
| Correction firewall | marker grep | **no** `correctionCause`/`currentValidationHeads` in `operational.ts`/`completed-rows.ts` |

All independently re-run this review pass. Every count matches the implementation record.

---

## 5. Non-blocking Observations

- **OB-1 — Reconcile helpers are unit-proven but not invoked in the runtime merge path.** `reconcileCaptureDiagnostics`/`reconcileSettlementDiagnostics` are referenced only in `tests/evidenceOperationalControls.test.ts`; `mergeProducerResultCounts` (`runner.ts:317-337`) flattens + emits but never calls reconcile-to-log. The implementation record §11 wording ("a mismatch is detectable and logged/observable") is therefore satisfied at the helper/test level, not by a runtime `reconciliation_mismatch` signal. **Why this is non-blocking:** (a) the slice is dormant (no producer is route-composed, so no live run reconciles anything); (b) `flattenDiagnostics` surfaces **every** raw grain counter into `resultCounts` (`discovered/malformed/admitted/grouped_fixtures/eligible/selected/deferred_by_cap/deferred_by_deadline/processed/emitted/backlog/effective_ceiling` + `rejected_<reason>`), so the four identities are **externally checkable** from the emitted counts with no silent drop; (c) the plan's Feature 11 permits "the runner **or** a pure helper" to assert — the tested pure helper meets the letter. **Recommendation (Stage 2E):** wire a runtime `reconcile*Diagnostics(diag)` inside `mergeProducerResultCounts` (best-effort, log-on-mismatch, never fail the job) when the producer is activated, so an in-flight accounting drift raises a signal rather than requiring off-line arithmetic.

- **OB-2 — Stale settlement job docstring.** `runner.ts:443-451` still says "Candidates enter one of two ways" and the precedence note reads "`provideCandidates` wins," but the code now adds `provideCandidateBatch` as the highest-precedence seam (checked first, `:477-485`) — matching the capture job's updated three-way docstring. Documentation-only; the code precedence is correct and tested. Recommend aligning the comment.

Neither observation blocks acceptance: both live in the dormant path, neither drops or corrupts a candidate, and neither touches a frozen contract.

---

## 6. Acceptance-Criteria Ledger (§17 of the plan review)

| AC | Requirement | Verified |
|---|---|---|
| AC-1 | deadline clamp ≤45 s; smaller honoured; invalid → bounded | ✅ `operational.ts:49-63` + D-1..D-3 |
| AC-2 | injected clock; no `Date.now` under the module; no wall clock in tests | ✅ static-guard test 29 |
| AC-3 | defer-not-overrun before candidate k; frozen core not called for deferred; absent ⇒ back-compat | ✅ both batches + IT tests |
| AC-4 | ceiling ∈ [1,150]; default 100; 500→150; overflow deferred+counted | ✅ `operational.ts:119` + C tests |
| AC-5 | four identities hold with zero unaccounted rows (RC-1); deliberate mismatch logs (no fail) | ✅ identities hold; mismatch detected by helper (see **OB-1** on runtime logging) |
| AC-6 | producer diagnostics reach `resultCounts`; `processed` filled; throwing merge/emit does not fail a succeeded job | ✅ `runner.ts:317-337` best-effort try/catch |
| AC-7 | no entity id as label/key; closed seeded reason set only | ✅ `flattenDiagnostics`/`emitProducerMetrics` `{job,outcome|reason}` |
| AC-8 | four typed codes distinct; non-`ProducerError` → `unhandled`; `failed→500` unchanged | ✅ `operational.ts:127-153` |
| AC-9 | `run_degraded` derived; does not change `hardFailed`/HTTP status | ✅ `runner.ts:418,514-519` |
| AC-10 | loader deterministic/terminal-only; malformed dropped+counted; whole-source → reject; route unchanged; firewall intact | ✅ `completed-rows.ts` + dormancy grep |
| AC-11 | deferred re-discovered next fire; no cursor / no persisted state | ✅ tail counted; nothing persisted |
| AC-12 | routes bare delegates; no flag default change; producer not route-composed | ✅ route grep |
| AC-13 | no change to M6/M8 cores/`types/evidence/*`/`ValidationRecord`/store/format/`DEFAULT_*` | ✅ marker grep clean |
| AC-14 | full suite green at 1795 + new; anchors green; typecheck 0; lint clean | ✅ 1824/1824 |
| AC-15 | cancellation model documented (between-candidate defer + read-only loader + deferred AbortSignal) | ✅ `implementation.md §8` + `completed-rows.ts:13-17` |

**15/15 met** (AC-5 met on the identities-and-external-reconcilability requirement; the runtime-log sub-clause is carried as OB-1 for Stage-2E activation, non-blocking in a dormant slice).

---

## 7. Final Verdict

# STAGE 2D — APPROVED

The Stage 2D operational-controls implementation matches the approved plan and resolves both required clarifications. It keeps the frozen M6/M8 business logic untouched (marker-grep clean), widens no `ValidationRecord`/evidence schema (only additive ephemeral diagnostics fields), holds all deadline decisions outside deterministic evidence data on an injected clock clamped to ≤45 s, defers before starting unsafe work (both batches, at loop top, never mid-append), wires ceilings at exactly 100/150 (never 500), keeps diagnostics/metrics bounded and entity-id-free and best-effort, resolves the RC-1 capture accounting grain so the row identity closes with zero unaccounted rows, ships the completed-rows loader dormant/injected/fail-closed with per-row isolation, preserves dormancy (both routes are bare M9 delegates; the producer is not route-composed), and is rollback-safe with no schema or migration. Full suite 1824/1824 (0 fail / 0 skip), typecheck exit 0, lint clean.

There is **no implementation defect**. The two observations (OB-1 reconcile-helper not runtime-wired — externally reconcilable from the surfaced counters and recommended for Stage-2E activation; OB-2 stale settlement docstring) are non-blocking, live in the dormant path, and drop/corrupt nothing. The verdict is **APPROVED** — not conditional — because the slice is complete, correct, and safe as a *dormant operational-controls* deliverable; the OB-1 runtime-reconcile wiring belongs to Stage-2E activation alongside the other activation gates, not to this dormant merge.

---

## 8. Confirmation

- **Final verdict:** APPROVED.
- **Implementation matches the approved plan:** YES (RC-1 and RC-2 both resolved and verified).
- **True implementation defects:** NONE.
- **Non-blocking observations:** 2 (OB-1 runtime reconcile wiring → Stage 2E; OB-2 stale docstring).
- **Validation:** full suite 1824/1824 · typecheck exit 0 · lint clean · Stage-2D 29/29 · anchors 171/171.
- **Exact file modified by this task:** `docs/plans/m10-stage-2d-implementation-review.md` (this document) only.

**Confirmed:** NO runtime code modified · NO tests modified · NO routes modified · NO contracts modified · NO configuration modified · NO database modified · NO deployment modified. This was a read-only implementation review; the only write was to this review document.

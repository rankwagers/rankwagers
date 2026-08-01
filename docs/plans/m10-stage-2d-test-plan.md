# M10 Stage 2D — Operational Controls (Deadline · Diagnostics · Metrics · Loader) — Test Plan

**Document type:** Test-planning deliverable (planning only). **No test or runtime code was written or modified.** The only file created is this document.
**Date:** 2026-07-30
**Author role:** Test Architect, Sprint 23B / M10 Stage 2D.
**Governing:** `docs/architecture/m10-live-candidate-pipeline-specification.md` (Rev A1 — INV-C ceilings §7.2, INV-D deadline §7.3, §10 observability); the Stage 2B/2C carry-forward sections (`m10-stage-2b-capture-pipeline-wiring.md` §"Deliberately NOT done", `m10-stage-2c-settlement-pipeline-wiring.md` §12); the Stage-2 master verification plan (`m10-stage-2-test-verification-plan.md` §8/§10, incl. the R3 accounting-grain finding); the 2B/2C coverage reviews (mock-fidelity lessons).
**Code read to ground the plan:** `lib/observability/metrics.ts` (`increment`/`gauge`/`timing`/`timeAsync`), `lib/jobs/runner.ts` (`emitOutcomeMetrics`, `runWithLock`, the two producer seams, `RefreshJobRecord.resultCounts`), `lib/jobs/diagnostics.ts` (`getEvidenceJobDiagnostics`), `lib/evidence-capture/candidates/types.ts` (`CandidateDiagnostics`), `lib/evidence-capture/candidates/limits.ts` (`normalizeBatchLimit` 1/100/150), `lib/evidence-capture/config.ts` (`DEFAULT_RUN_DEADLINE_MS=300000`, `DEFAULT_CAPTURE_MAX_FIXTURES=500`), the two cron routes (`maxDuration=60`), `lib/evidence-capture/jobs/{capture-run,settlement-run}.ts` (the batch loops), `capture-pipeline.ts` / `settlement-pipeline.ts` (producers returning `{candidates, diagnostics}`).

---

## 1. Scope

### 1.1 What Stage 2D builds (the test targets — all verified absent today)
Stages 2B/2C wired capture and settlement discovery **inside the lock** but deliberately deferred every *operational control*: the producers already compute a full `CandidateDiagnostics`, but the runner seams **thread only `candidates` and drop `diagnostics`**; there is **no deadline enforcement** (the 300 s `DEFAULT_RUN_DEADLINE_MS` is 5× the 60 s route budget); there is **no producer-stage metric** beyond the M9 `evidence_job_outcome_total{job,outcome}`; and the settlement completed-rows loader is a **dormant injected seam** with no concrete implementation.

| Deliverable (proposed) | Status | Test axis |
|---|---|---|
| `lib/evidence-capture/candidates/deadline.ts` — `effectiveJobDeadlineMs(config, routeBudgetMs, reservedHeadroomMs)`, `remainingMs(startMs, nowMs, deadlineMs)`, `shouldStartNext(remainingMs, perCandidateMs)` | **MISSING** | deadline · timeout · unit |
| Batch **deadline guard** — optional `budget?: { remainingMs(): number; perCandidateMs: number }` on `runCaptureBatch` / `runSettlementBatch` (M9 orchestrators; frozen M6/M8 untouched) → break loop, count `deferredByDeadline` | **MISSING** | deadline · timeout · retry · integration |
| **Diagnostics merge** — extend the runner seams to consume the producer's `{candidates, diagnostics}`, fill `candidatesProcessed` from the batch result, add `candidatesDeferredByDeadline`, and flatten into `resultCounts` | **MISSING** (diagnostics currently dropped) | diagnostics · accounting · integration |
| **Producer-stage metrics** — emit discovered/eligible/selected/deferred_by_cap/deferred_by_deadline/processed/backlog counters + an `oldest_pending_age_ms` gauge, bounded cardinality (labels `{job,outcome}` only, no entity id) | **MISSING** | metrics · unit · integration |
| **Ceiling-at-call-site** — producers pass `normalizeBatchLimit(configured)` (default 100, hard 150); the raw `DEFAULT_CAPTURE_MAX_FIXTURES=500` can never be the effective ceiling | provider `normalizeBatchLimit` exists; **call-site binding untested** | accounting · unit |
| **Concrete completed-rows loader** — `loadCompletedRows(date)` deterministic terminal-row filter over the daily archive; capture default already `loadPublishedDailyPredictions` | **MISSING** (settlement seam dormant) | loader · failure · unit |

### 1.2 Explicitly OUT of Stage 2D (deferred — §8)
- **2E:** multi-worker/overlap concurrency matrix; representative-depth **benchmark** proving the deadline holds; crash/replay matrix; unlock-throw false-500 (H-1) carry-forward; large-archive capacity gate.
- **Live activation:** composing the loader/producer into the cron routes (flags/schedule) stays operational.
- **Corrections:** `currentValidationHeads`/`correctionCause` — a later stage.
- **Live M4→M5 capture derivation** behind `deriveCaptureInput` — a later stage (its provider retry/timeout belong there, not here; see §1.3).

### 1.3 What "timeout" and "retry" mean in Stage 2D (bounded, deliberately)
The live provider fetch (M4 `orchestrateFetches` with `retryLimit`/`requestBudget`/`runDeadlineMs`) is **not** wired yet, so **2D's timeout/retry are the job-level controls, not provider I/O retries**:
- **Timeout** = the INV-D effective job deadline (clamp the 300 s config below the 60 s route) + the mid-batch remaining-time guard that **stops starting new candidates** rather than overrun the route.
- **Retry** = the *deferred-then-redo* guarantee: a candidate deferred by deadline or cap, or one whose batch write transiently failed, carries **no state**, is re-discovered from the archive next fire, and is processed **idempotently** (capture `already_exists`, settlement `already_settled`/`no_change`) — no duplicate, no loss.

---

## 2. Requirements → Tests Matrix (by the requested categories)

| Category | Requirement | Test IDs |
|---|---|---|
| **unit** | pure deadline math; ceiling normalization at call site; loader purity; metric-label cardinality | D-1..D-6, C-1..C-2, L-1..L-4, M-1..M-2 |
| **deadline** | effective deadline `= min(configured, routeBudget − headroom) ≤ 45 s`; 300 s clamped, never honoured | D-1..D-3 |
| **timeout** | remaining-time guard defers before starting work it cannot finish; run returns bounded, never hangs/overruns | D-4..D-6, IT-3..IT-4 |
| **retry** | deadline/cap-deferred + transient-fail candidates re-discovered and completed next fire, idempotent, no dup/no loss | RT-1..RT-4 |
| **diagnostics** | producer `CandidateDiagnostics` merged into `resultCounts`; `getEvidenceJobDiagnostics` surfaces them; `candidatesProcessed` filled | DG-1..DG-5 |
| **accounting** | reconciliation identities hold (no silent loss); ceiling never unbounded | AC-1..AC-5 |
| **loader** | concrete completed-rows loader deterministic, terminal-only, fail-closed, bounded, no clock | L-1..L-5 |
| **metrics** | producer-stage counters + `oldest_pending_age` gauge emitted at bounded cardinality; best-effort | M-1..M-5 |
| **integration** | deadline guard + diagnostics merge + metrics fire end-to-end through the two runners | IT-1..IT-7 |
| **failure** | fail-closed on loader/archive faults; diagnostics/metrics never fail the job; deadline guard never drops silently | FA-1..FA-6 |

---

## 3. Fixtures and Test Doubles

Shared helper (non-`.test.ts`, e.g. `tests/_m10stage2dFixtures.ts`), **injected fake clock — no wall-clock, no `Date.now`**.

| Double | Produces | Notes |
|---|---|---|
| `fakeClock(startMs)` | `{ nowMs(), advance(ms) }` | the **only** time source; feeds `remainingMs`, the batch `budget.remainingMs()`, and `evaluationInstant`. `advance()` simulates elapsed work deterministically (the timeout keystone). |
| `budget(remainingFn, perCandidateMs)` | batch `budget` param | drives the mid-batch guard without real time |
| `capturingMetrics()` | a `metrics` spy | records `increment`/`gauge`/`timing` calls (name, labels, value) for M-1..M-5; assert cardinality + values |
| `provider result` builders | `{candidates, diagnostics: CandidateDiagnostics}` | seed known discovered/eligible/selected/deferred/backlog for DG/AC assertions |
| `stubCompletedRows` / `dailyArchiveFixture` | loader inputs | terminal + non-terminal + malformed rows; corrupt-archive variant for L-5/FA-1 |
| `seedStore(...)` + `memory*Archive` | end-to-end runner integration | IT-1..IT-7, RT-1..RT-4 real appends |
| `lockContention(key)` | pre-acquire lock | reuse for IT overlap-minimal (full matrix → 2E) |

**Fidelity rules (carried from the 2B/2C reviews):**
- Exercise the **real `metrics`** module (or a faithful spy), not a hand-rolled counter, so `timing`/`gauge` non-finite guards and label sanitization are covered.
- Drive at least one **real end-to-end run** through `runEvidenceCaptureJob`/`runPredictionSettlementJob` so the merged `resultCounts` and emitted metrics are asserted from the actual runner, not a unit shim.
- Determinism: no wall clock anywhere; the timeout tests advance `fakeClock`, never `sleep`.

---

## 4. Unit Suite

Pure/near-pure, injected clock, repeat-run determinism.

**Deadline math (`deadline.ts`):**
- **D-1** `effectiveJobDeadlineMs(configured=300_000, routeBudget=60_000, headroom=15_000)` → **≤45_000** (300 s clamped, never honoured).
- **D-2** `effectiveJobDeadlineMs(configured=20_000, …)` → `20_000` (honours a smaller configured value).
- **D-3** invalid/zero/negative/`NaN`/non-number configured → fail-safe to the bounded target (never unbounded, never 300 s).
- **D-4** `remainingMs(startMs, nowMs, deadlineMs)` pure, monotone, `≥0`-clamped.
- **D-5** `shouldStartNext(remaining, perCandidateMs)` → `true` iff `remaining ≥ perCandidateMs`; reserves explicit headroom for **diagnostics emission + response serialization** (do not start a candidate if only serialization headroom remains).
- **D-6** all deadline helpers are pure functions of injected numbers — no clock read (static-guard assertion + repeat determinism).

**Ceiling at call site (`limits.ts` binding):**
- **C-1** the producer passes `normalizeBatchLimit(config.maxCandidates)` → `500`→`150`, `0/-1/NaN/undefined`→`100`, `120`→`120`, `999`→`150`. The raw `DEFAULT_CAPTURE_MAX_FIXTURES=500` is **never** the effective ceiling.
- **C-2** symmetric for settlement (settlement had no cap before 2D).

**Metric-label cardinality:**
- **M-1** every producer-stage metric labels only `{job, outcome}` (or an enum outcome) — **no** `fixtureId`/`matchId`/`captureId`/`predictionId`/URL/raw-error appears as a label (assert over the spy's captured labels).
- **M-2** `oldest_pending_age_ms` is emitted via `metrics.gauge` (a gauge, not a label); a `null` oldest-age emits **no** gauge (or emits `0`), never `NaN` (the metrics `gauge` guard already drops non-finite — assert the producer respects it).

---

## 5. Integration Suite (wired runners, seeded stores, fake clock)

- **IT-1 — Diagnostics merged end-to-end (capture).** A capture run with a seeded producer diagnostics → `resultCounts` contains discovered/eligible/selected/deferred_by_cap/processed/backlog; `candidatesProcessed` is filled from the batch (no longer 0). `getEvidenceJobDiagnostics()` surfaces the last-run merged counts.
- **IT-2 — Diagnostics merged end-to-end (settlement).** Symmetric.
- **IT-3 — Deadline guard trips mid-batch.** With `budget` whose `remainingMs()` (driven by `fakeClock.advance`) drops below `perCandidateMs` before candidate k → candidates k..N counted `deferred_by_deadline`, 1..k-1 processed, run `succeeded` (bounded, not `failed`, not overrun).
- **IT-4 — Deadline guard never trips under ample budget.** Ample `remainingMs` → all candidates processed, `deferred_by_deadline===0`.
- **IT-5 — Metrics emitted from a real run.** After a run, the `metrics` spy shows one `increment` per non-zero producer outcome + the `oldest_pending_age_ms` gauge; label set bounded.
- **IT-6 — Capture path unchanged.** The shared runner change does not regress capture: `evidenceCapturePipeline` (9) + `evidenceSettlementPipeline` (26) stay green; a bare fire (no producer) is still the M9 empty-safe `succeeded` zero-count.
- **IT-7 — Ceiling observed at the runner.** A producer fed 130 eligible with default config → 100 selected + 30 `deferred_by_cap` in the merged `resultCounts`; effective ceiling 150 for config 500.

---

## 6. Failure Suite (fail-closed; best-effort observability)

- **FA-1 — Loader failure.** A rejecting/throwing `loadCompletedRows` (or capture `loadSource`) → producer rejects → runner `failed`; **never** an empty success, never a partial-diagnostics success masquerading as complete.
- **FA-2 — Archive failure under the deadline path.** A strict-read throw during discovery → `failed` even when a deadline budget is supplied (the guard must not swallow a real fault as a "deadline defer").
- **FA-3 — Diagnostics merge must never fail the job.** If diagnostics assembly/merge throws, the job still returns its batch outcome (best-effort observability; wrap + log). Assert a thrown merge does not flip a `succeeded` batch to `failed`.
- **FA-4 — Metrics emission must never fail the job.** A throwing `metrics` sink is swallowed (the real module already `safeRun`s — assert the producer path relies on it and a broken sink does not throw out of the run).
- **FA-5 — Deadline guard never silently drops.** Deferred-by-deadline candidates are **counted and logged**, not dropped — assert `considered = processed + deferred_by_deadline + deferred_by_cap + failed + skipped-reasons` (no unaccounted delta).
- **FA-6 — Non-finite/negative timing/gauge.** A `perCandidateMs` of `0`/negative or a `null` oldest-age does not produce a `NaN` metric or a divide-by-zero in the guard (rides the metrics finite-guards; assert at the producer boundary).

---

## 7. Timeout, Retry, Deadline, Accounting, Loader, Metrics — category detail

### 7.1 Deadline / Timeout (D-1..D-6, IT-3..IT-4, FA-2/FA-5)
The keystone is **defer-not-overrun**, proven with `fakeClock.advance` (no real sleep). Assert: 300 s clamped ≤45 s; the guard stops *before* starting a candidate it cannot finish; a timed-out run is `succeeded`+partial with `deferred_by_deadline` counted; the guard reserves serialization/diagnostics headroom (D-5).

### 7.2 Retry (RT-1..RT-4)
- **RT-1 — Deadline-deferred → next-fire completion.** Fire 1 defers candidates k..N by deadline; Fire 2 (advanced clock, same seeded source+archive) re-discovers and processes them — **idempotent, no duplicate** (capture `already_exists` / settlement `no_change` for anything Fire 1 did commit).
- **RT-2 — Cap-deferred → next-fire completion.** Symmetric for `deferred_by_cap`.
- **RT-3 — Transient batch fault → re-fire.** A `write_failed` on one candidate → run `failed` with code; a re-fire (store healthy) completes it once, no duplicate revision/snapshot.
- **RT-4 — No cursor across retries.** No progress state persists between fires; a fresh process reproduces identical remaining work (INV-A) — grep-guard + behavioural.

### 7.3 Accounting (AC-1..AC-5) — reconciliation identities, no silent loss
Assert on the merged `resultCounts` after real runs:
- **AC-1 (settlement):** `sourceRowsDiscovered = sourceRowsMalformed + Σ candidatesRejectedByReason + candidatesEligible`.
- **AC-2 (both):** `candidatesEligible = candidatesSelected + candidatesDeferredByCap`.
- **AC-3 (both):** `candidatesSelected = candidatesProcessed + candidatesDeferredByDeadline + candidatesFailed`.
- **AC-4 (both):** `backlogSize = candidatesDeferredByCap`; `oldestPendingAgeMs` is `null` when nothing deferred, else the earliest-pending age.
- **AC-5 (capture grain — see Condition K-1):** because capture `sourceRowsDiscovered` counts **rows** while `candidatesEligible` counts **grouped fixtures**, the row-grain identity requires a `rowsGroupedIntoEligibleFixtures` (or per-fixture) counter so `discovered = malformed + rejected + grouped` holds with **zero unaccounted rows**. The test asserts full accounting; the exact counter name is fixed once K-1 is resolved.

### 7.4 Loader (L-1..L-5)
- **L-1** deterministic: same daily-archive input → identical `FootyMatchRow[]` (byte/deepEqual), across two calls.
- **L-2** terminal-only: returns finished + lifecycle-terminal (postponed/cancelled/abandoned) rows; excludes live/scheduled/half-time.
- **L-3** no clock/random: purity static guard; determinism on repeat.
- **L-4** bounded classification: an unbounded `completedRows` input is classified without O(F²) blowup (single pass); the count is observable.
- **L-5** fail-closed: a corrupt/unreadable daily archive **throws** (never returns `[]`-as-success) → producer rejects → run `failed`.

### 7.5 Metrics (M-1..M-5)
- **M-1/M-2** cardinality + gauge shape (§4).
- **M-3** one `increment` per **non-zero** producer outcome (mirror `emitOutcomeMetrics`' skip-zero rule); zero outcomes emit nothing.
- **M-4** `oldest_pending_age_ms` gauge emitted once per run with the correct value (or absent when nothing pending).
- **M-5** metrics are **best-effort** and additive to the existing `evidence_job_outcome_total` — the M9 counter set is unchanged (no regression to `refresh_job_*` / `evidence_job_outcome_total`).

---

## 8. Deferred Stage 2E / later tests (NOT counted against 2D)

| Deferred to | Tests |
|---|---|
| **2E — concurrency / benchmark / activation** | representative-depth **benchmark** proving a ceiling-sized run completes within the ≤45 s deadline (the deadline math is unit-proven here; the *empirical* fit is 2E); full multi-worker/overlap matrix; crash/replay matrix; unlock-throw false-500 (H-1); large-archive capacity gate |
| **Live activation** | composing the loader/producer into the cron routes; flag/schedule wiring |
| **Later stage** | corrections; live M4→M5 capture derivation + its provider-level retry/timeout tests |

---

## 9. Binary Acceptance Gate

Stage 2D is test-complete when **all** hold (binary, no partial credit):
- **G-1 (Unit):** D-1..D-6, C-1..C-2, M-1..M-2, L-1..L-4 green, deterministic on repeat; purity/no-clock static guards green.
- **G-2 (Deadline/Timeout):** effective-deadline clamp (≤45 s, 300 s never honoured) + mid-batch defer-not-overrun (IT-3) green.
- **G-3 (Retry):** RT-1..RT-4 green — deferred/failed candidates complete next fire, idempotent, no dup/no loss, no cursor.
- **G-4 (Diagnostics/Accounting/Metrics):** DG/AC/M green — `resultCounts` merged & filled, reconciliation identities hold with **zero unaccounted rows**, metrics bounded-cardinality & best-effort.
- **G-5 (Loader):** L-1..L-5 green — deterministic, terminal-only, bounded, fail-closed.
- **G-6 (Failure):** FA-1..FA-6 green — fail-closed on loader/archive; diagnostics/metrics never fail the job; deadline never drops silently.
- **G-7 (Regression):** full `npm test` green at `baseline + new`, 0 fail / 0 skip; anchors stay green — `evidenceCapturePipeline` (9), `evidenceSettlementPipeline` (26), `evidenceArchiveStateBuilders` (25), `evidenceCandidateProvider` (48), `evidenceSettlement` (34), `m9Activation` (18), `m9Concurrency` (11).
- **G-8 (Static):** typecheck exit 0; lint clean; **no frozen contract modified** (frozen M6/M8, `types/evidence/*`, store interfaces, archive formats); the deadline guard lives in the M9 orchestrators, never in `captureEvidenceSnapshot`/`settleSnapshot`.

Current pre-2D baseline to re-establish: full suite **1795/1795**, typecheck exit 0, lint clean.

---

## 10. Verdict

### STAGE 2D TEST PLAN CONDITIONALLY READY

The plan is implementation-ready across all ten requested categories, and every test maps to a real, verified surface: the `metrics` module (`increment`/`gauge`/`timing` with finite-guards + label sanitization), the already-computed-but-dropped `CandidateDiagnostics`, `getEvidenceJobDiagnostics`, the known deadline/ceiling constants (`DEFAULT_RUN_DEADLINE_MS=300000`, `DEFAULT_CAPTURE_MAX_FIXTURES=500`, route `maxDuration=60`, `normalizeBatchLimit` 1/100/150), and the batch loops that are the correct attach point for an **additive** deadline guard (M6/M8 stay frozen). Deterministic timeout testing is fully enabled by an injected fake clock (no wall clock, no sleep), and the retry guarantees ride the already-proven idempotency (capture `already_exists`, settlement `already_settled`/`no_change`) and no-cursor (INV-A) design.

**Two conditions gate a clean "READY"** — both are genuine, pre-existing design decisions the plan surfaces rather than invents:

- **K-1 (accounting grain).** Capture `sourceRowsDiscovered` counts **rows** while `candidatesEligible` counts **grouped fixtures**, so the reconciliation identity `discovered = malformed + rejected + eligible` does not close at a single grain (the master verification plan flagged this as R3). The accounting tests (AC-5) require the implementation to add a `rowsGroupedIntoEligibleFixtures` (or per-fixture) counter; until the grain counter is pinned, AC-5's exact assertion is provisional. Settlement (per-fixture, one grain) is unaffected.
- **K-2 (loader scope boundary).** The 2C record left the concrete completed-rows loader as "an injected dormant seam; wiring it is a live-activation task." This plan assumes Stage 2D **builds the loader as a pure, deterministic, dormant module** (tested L-1..L-5) while leaving route composition to activation. If the project instead defers the loader entirely to activation, L-1..L-5 move with it and the remainder is READY.

With K-1's grain counter prescribed and K-2's build-but-dormant loader confirmed, the plan is fully implementable; both have recommended defaults baked in above. Deferred 2E/benchmark/activation/correction/live-derivation tests are correctly out of scope and are **not** held against Stage 2D.

---

**Confirmation:** the only file created by this task is `docs/plans/m10-stage-2d-test-plan.md`. No test was written or modified; no runtime code was modified. All cited types, functions, constants, and file paths were read from the current repository.

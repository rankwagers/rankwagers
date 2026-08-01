# M10 Stage 2D — Operational Controls (Architecture & Implementation Plan)

**Document type:** Architecture & implementation plan (Stage 2D of M10). **DESIGN ONLY — no runtime code, test, route, contract, M8, M9, config, archive, or deployment was created or modified.** The only file created is this document.
**Milestone:** Sprint 23B — M10 (Live Candidate Pipeline), **Stage 2D — Operational Controls**.
**Date:** 2026-07-30
**Governing spec:** `docs/architecture/m10-live-candidate-pipeline-specification.md` (Rev A1) — §7.2 (INV-C), §7.3 (INV-D), §7.4 (INV-S), §7.5 (INV-A), §10 (Observability).
**Predecessors:** Stage 2B capture wiring (`m10-stage-2b-closure.md` — CLOSED), Stage 2C settlement wiring (`m10-stage-2c-closure.md` — CLOSED). Stage 2D consumes the carry-forward register in §9 of the Stage-2C closure.

---

## 0. Framing, Non-Negotiables, and the Additive Boundary

Stage 2D is **operational safety, not business logic**. It adds the controls that make a *live* fire bounded, observable, and fail-closed — a deadline below the route budget, hard batch ceilings, aggregated diagnostics, typed failure codes, backlog/oldest-pending metrics, and the live completed-rows loader — **without changing any produced artifact, any frozen contract, or the dormant-at-the-route posture.**

**The additive boundary (binding for the eventual Stage 2D implementation, not this doc):**

- **Frozen and untouched:** M6 capture core (`capture/capture.ts`, `capture/mandatory-odds.ts`), **M8 settlement core** (`settlement.ts`, `outcomes.ts`, `validation/*`), `ValidationRecord` / `EvidenceSnapshot` / `OddsArchiveRecord` and every `types/evidence/*`, identity/hash/revision/lineage formulas, archive NDJSON format, the two cron routes, feature-flag defaults, `locks.ts`, `cronHandler.ts` status→HTTP mapping.
- **The additive host is the M9 *orchestration* layer + the M10 *producer* layer** — exactly where M9 was designed to carry guards "outside frozen capture/settlement": `lib/jobs/runner.ts` (the two job functions), `lib/evidence-capture/jobs/{capture-run,settlement-run}.ts` (the batch sequencers), and `lib/evidence-capture/candidates/{capture,settlement}-pipeline.ts` + a few new pure modules. **Every change is an *optional* parameter or a *new* module; all current call sites keep their behaviour byte-for-byte** (bare route ⇒ empty-safe pass; no producer ⇒ `candidates ?? []`; no deadline ⇒ process the whole array as today). Where this plan says "modify runner / batch runner," it means an additive optional seam on the M9 orchestration wiring — **never** the frozen M6/M8 core, and never a contract.
- **Dormant preserved:** Stage 2D builds and unit-tests the controls but **does not wire the producer into either route and does not enable any flag** (route activation and production enablement are Stage 2E). The settlement completed-rows loader (D-9) ships as a reusable, tested default for the injected seam but is **not** composed into the route.

Everything below is a *design*. Nothing here is implemented by this task.

---

## 1. Current Behaviour Baseline (verified from source)

| Fact | Anchor | Consequence for Stage 2D |
|---|---|---|
| Both routes `export const maxDuration = 60`; status map `failed→500, skipped→409, else 200`; `resultCounts?: Record<string,number>` + `errorCode` surfaced | `app/api/internal/cron/*/route.ts`, `cronHandler.ts:60-78` | Route budget = 60 s; `resultCounts` is the flat numeric channel Stage 2D aggregates into. |
| `DEFAULT_RUN_DEADLINE_MS = 300_000` (5 m); `runDeadlineMs` = `readPositiveInt(EVIDENCE_RUN_DEADLINE_MS, 300_000)` | `config.ts:153,241-244` | **5× the route budget** — INV-D must clamp it, never honour it on the web-cron path. |
| `DEFAULT_CAPTURE_MAX_FIXTURES = 500`; `readPositiveInt` fails safe *to 500* | `config.ts:40,50-56,86-89` | The **500** must never be the effective ceiling; Stage 2D resolves a separate clamped ceiling. |
| `normalizeBatchLimit(v)` → `[1,150]`, default **100**, invalid/0/neg/NaN/non-int → 100, >150 → 150 | `candidates/limits.ts:15-27` | Ceilings are **already fail-safe** in the provider; Stage 2D wires the *configured* value and observes deferrals — it does not re-implement clamping. |
| Producer diagnostics already carry `sourceRowsDiscovered`, `sourceRowsMalformed`, `candidatesEligible`, `candidatesRejectedByReason` (seeded, bounded), `candidatesSelected`, `candidatesDeferredByCap`, `backlogSize`, `oldestPendingAgeMs`, `candidatesProcessed` (=0, runner-owned), `emittedCandidates` | `candidates/diagnostics.ts:21-51`, `candidates/types.ts` | Backlog / oldest-pending / deferred-by-cap / rejected-by-reason are **already computed** — Stage 2D needs a new `candidatesDeferredByDeadline`, and to **surface** these (they are dropped at the array-only seam today). |
| Runner seam `provideCandidates?: () => Promise<readonly Candidate[]>` returns only the array; a rejection → `runWithLock` catch → `errorCode:"unhandled"`; `hardFailed = writeFailed>0 \|\| immutableViolation>0`; `emitOutcomeMetrics(job, counts)` → `evidence_job_outcome_total{job,outcome}` per non-zero count | `runner.ts:282-320` (capture), `runner.ts:322-371` (settlement), `runner.ts:264-273` | The seam discards diagnostics; producer rejections are un-typed. Stage 2D adds a richer optional seam + typed codes, additively. |
| `runCaptureBatch` / `runSettlementBatch` iterate `for (const … of candidates)` with **no** ceiling and **no** deadline; never throw (per-candidate isolation) | `capture-run.ts:87-151`, `settlement-run.ts:124-194` | The mid-batch remaining-time guard is an **additive optional param** on these M9 sequencers; the frozen `captureEvidenceSnapshot`/`settleLatestSnapshotForFixture` are not touched. |
| Settlement `loadCompletedRows` is a required injected seam **with no live default** (BQ-1); capture's `loadSource` defaults to the live `loadPublishedDailyPredictions` | `settlement-pipeline.ts:63-68`; `capture-pipeline.ts:118` | D-9 is primarily a **settlement** gap; capture's source is already live (capture stays dormant on the unbuilt M4/M5 derivation, out of Stage 2D). |

---

## 2. Feature Design

Each feature below is specified across the twelve required dimensions. Shared mechanisms (the deadline clock, the diagnostics channel) are defined once in the first feature that needs them and referenced thereafter.

---

### Feature 1 — Effective Deadline (INV-D)

**Purpose.** Guarantee the end-to-end job deadline used on the web-cron path is **strictly below** the 60 s route budget, so a fire is a clean deferral rather than a platform hard-kill (which risks a torn NDJSON tail).

**Existing behaviour.** No internal deadline anywhere; only `maxDuration = 60`. `runDeadlineMs` resolves to `300_000` — 5× the budget — and is passed to nothing in the M10 path today.

**New behaviour.** A **pure resolver** (proposed `lib/evidence-capture/candidates/deadline.ts`, name non-binding):
`resolveEffectiveJobDeadlineMs(configuredRunDeadlineMs, { routeBudgetMs = 60_000, headroomMs }) = clamp(min(configuredRunDeadlineMs, routeBudgetMs − headroomMs), 1, routeBudgetMs − headroomMs)`, with `headroomMs` default **15_000** ⇒ **effective target ≤ 45_000 ms**. A malformed/zero/negative/non-finite `configuredRunDeadlineMs` fails safe to `(routeBudgetMs − headroomMs)` (never the 300 s value, never unbounded). The resolver also exposes an injected monotonic clock seam `now: () => number` (default `Date.now`) and constructs a run **deadline handle** `{ deadlineAtMs, remainingMs: () => deadlineAtMs − now() }` from a `startedAtMs` captured once at job entry.

**Failure behaviour.** Fail-safe by construction: any bad input clamps to the bounded target. If `now()` ever returns a non-finite value (defensive), `remainingMs()` is treated as `0` ⇒ defer everything (safe). The resolver never throws.

**Determinism.** The resolver is a pure function of its numeric inputs → deterministic. The **produced artifacts remain fully deterministic**: the deadline clock is a *processing-count decision* input only; it never enters `capturedAt`, `completionInstant`, `nowSec`, identity, hash, or ordering. Two runs of differing wall-clock speed may process different *counts*, but each processed candidate is byte-identical and every deferred candidate is re-derived next fire (INV-A). Tests inject a fake `now` for full determinism.

**Interaction with M8.** None to the frozen core. The deadline only decides how many `SettlementCandidate`s reach `settleLatestSnapshotForFixture` this fire; M8 idempotency (`no_change` / `already_settled` re-fire) makes truncation safe.

**Interaction with M9.** The runner captures `startedAtMs` at the top of the locked `fn` and builds the deadline handle from `resolveEvidenceUpstreamConfig(env).runDeadlineMs`. Additive; when no deadline handle is supplied to a batch, behaviour is unchanged.

**Interaction with Stage 2B.** Symmetric: the capture path uses the same resolver; the clamped deadline is also the value that must later be passed into M4 `orchestrateFetches` (fetch sub-budget) — but M4 wiring is the unbuilt live-derivation stage, so Stage 2D only fixes the *job* deadline, not the fetch deadline.

**Interaction with Stage 2C.** The settlement path uses the identical resolver; the deadline bounds the M8 `F·(2+2T)` per-candidate scans.

**Risk analysis.** *R:* headroom too small → serialization/diagnostics overrun. *M:* 15 s headroom is generous relative to the measured discovery cost; the value is a single tunable constant + env override, re-validated by the Stage-2E benchmark. *R:* clock injection mistake reintroduces `Date.now` into artifacts. *M:* the determinism guard (Feature 13 / static rule) forbids `Date.now` under `candidates/` except the single injected `now` seam.

**Test strategy.** Unit: `resolveEffectiveJobDeadlineMs(300_000)` → ≤45_000; `(20_000)` → 20_000; invalid/0/neg/NaN → bounded default (never 300_000, never unbounded); `remainingMs()` monotone-decreasing under an advancing fake clock, `≥0`-safe. No wall clock in any test.

**Rollback.** The deadline handle is optional at every call site; passing `undefined` restores today's unbounded processing. Reverting = delete the module + drop the optional param. Nothing persisted.

---

### Feature 2 — Remaining-Time Guard

**Purpose.** Start **no** candidate the run cannot safely finish: before processing candidate *k*, verify enough budget remains; otherwise stop and defer the remainder (counted), so the run ends inside the deadline rather than being killed mid-write.

**Existing behaviour.** `runCaptureBatch`/`runSettlementBatch` process the entire injected array unconditionally.

**New behaviour.** An **additive optional** parameter on each M9 batch sequencer: `deadline?: { remainingMs: () => number; reservePerCandidateMs: number }`. At the top of each loop iteration (before any store read/write for that candidate): `if (deadline && deadline.remainingMs() < deadline.reservePerCandidateMs) { break; }`; the un-processed tail is counted `deferredByDeadline` and returned. A companion pure helper `shouldStartNext(remainingMs, reservePerCandidateMs): boolean`. `reservePerCandidateMs` is a conservative worst-case per-candidate estimate (proposed defaults: capture ~250 ms, settlement ~120 ms; env-overridable; **validated by the Stage-2E benchmark, not asserted as truth here**). Defense-in-depth: the producer/runner may *also* pre-cap the injected set to `min(effectiveCeiling, floor(remainingBudget / reservePerCandidateMs))` before the batch — a coarse static bound complementing the dynamic guard.

**Failure behaviour.** Fail-closed toward deferral: any doubt (insufficient/unknown remaining) ⇒ stop, defer, count — never start work that could overrun. Deferred candidates carry no state and are re-derived next fire.

**Determinism.** Same as Feature 1: affects *count processed*, not artifact content; deferred set is re-derivable (INV-A). Fake-clock tests make it deterministic.

**Interaction with M8.** None to the frozen core — the guard sits in the M9 sequencer loop *around* `settleLatestSnapshotForFixture`; a deferred candidate is simply not passed to M8 this fire. Committed settlements persist; the re-fire completes the rest (`no_change` for anything already done).

**Interaction with M9.** Additive optional param on `runCaptureBatch`/`runSettlementBatch`; absent ⇒ today's full-array behaviour (regression-guarded). No frozen M9 lock/flag/route change.

**Interaction with Stage 2B.** Capture's per-candidate cost is the steeper curve (mandatory-odds amplification); `reservePerCandidateMs` is larger for capture. Capture remains dormant on the unbuilt derivation regardless.

**Interaction with Stage 2C.** Settlement's per-candidate cost is `2+2T` scans (lighter, no odds hash tax); a smaller reserve.

**Risk analysis.** *R:* `reservePerCandidateMs` too small → a candidate started with too little budget overruns. *M:* choose a conservative (over-)estimate; the Stage-2E benchmark tunes it; the guard is a *floor*, and the 15 s headroom is a second cushion. *R:* too large → chronic under-utilisation (backlog grows). *M:* observable via backlog/oldest-age (Features 7/8) and the INV-S capacity gate; tune down with evidence.

**Test strategy.** Unit on the sequencer with an injected fake clock that advances so `remainingMs` drops below the reserve before candidate *k*: assert candidates `1..k-1` processed, `k..N` counted `deferredByDeadline`, no throw, run `succeeded`; frozen `captureEvidenceSnapshot`/`settleLatestSnapshotForFixture` **not** called for deferred candidates; `deadline` absent ⇒ identical to today (empty-pass + full-array back-compat).

---

### Feature 3 — Default Candidate Ceiling (100)

**Purpose.** Bound per-run work to a safe default so a single fire cannot exceed the route budget on the file adapter.

**Existing behaviour.** `normalizeBatchLimit` already defaults to **100** and is applied by both providers over `config.maxCandidates`. But the pipelines do not yet *resolve* a configured ceiling from the environment, and the separate `DEFAULT_CAPTURE_MAX_FIXTURES = 500` exists un-wired.

**New behaviour.** A **pure resolver** `resolveEffectiveCeiling(kind: "capture"|"settlement", env)` reading a Stage-2D-owned env knob (`EVIDENCE_CAPTURE_MAX_CANDIDATES` / `EVIDENCE_SETTLEMENT_MAX_CANDIDATES`) and returning `normalizeBatchLimit(configured)` ⇒ default **100**. The pipelines pass this into the provider `config.maxCandidates`. The legacy `500` is **explicitly not** used as an effective ceiling (it may remain a separate, unrelated documentation value). The effective ceiling is surfaced in diagnostics (`effectiveCeiling`).

**Failure behaviour.** Fail-safe to 100 on missing/invalid/0/negative/NaN/non-integer (inherited from `normalizeBatchLimit`) — never 500, never unbounded.

**Determinism.** Pure function of env → deterministic; does not touch artifacts.

**Interaction with M8 / M9.** None (frozen). The ceiling bounds the array handed to the M9 batch; M8 sees only the selected set.

**Interaction with Stage 2B / 2C.** Symmetric capture/settlement resolution; both already ride `normalizeBatchLimit`.

**Risk analysis.** *R:* an operator sets the env knob to `500`. *M:* `normalizeBatchLimit` clamps to 150 — the hard cap (Feature 4) is the backstop; the 500 is impossible to reach.

**Test strategy.** Unit: unset → 100; `"120"` → 120; `"0"`/`"-5"`/`"abc"`/`"1.5"` → 100; `"500"` → 150 (clamped). Assert the overflow beyond the effective ceiling is deferred+counted (`candidatesDeferredByCap`), never dropped.

**Rollback.** Optional resolver; if unused the provider default (100) still applies. No persisted state.

---

### Feature 4 — Hard Maximum Ceiling (150)

**Purpose.** An absolute upper bound no configuration can exceed, protecting the file adapter's O(F²) regime.

**Existing behaviour.** `CANDIDATE_LIMIT_MAX = 150`; `normalizeBatchLimit` clamps `>150` to 150.

**New behaviour.** None to the mechanism — Stage 2D **reuses** the existing hard cap; it only ensures every ceiling path flows through `normalizeBatchLimit` (Feature 3) and documents 150 as the binding maximum. The hard cap is asserted, not re-implemented.

**Failure behaviour.** A configured value above 150 clamps *down* to 150 (never honoured); combined with Feature 3's fail-safe-100, the effective ceiling is provably in `[1,150]`.

**Determinism / M8 / M9 / 2B / 2C.** As Feature 3.

**Risk analysis.** *R:* a future refactor bypasses `normalizeBatchLimit`. *M:* a single choke-point + a unit test that the effective ceiling is always `≤150` for any env input; the hard cap constant is shared, not duplicated.

**Test strategy.** Property-style unit: for a sample of env strings (huge, negative, float, empty), `resolveEffectiveCeiling` ∈ `[1,150]` always.

**Rollback.** Constant reuse; nothing to roll back.

---

### Feature 5 — Diagnostics Aggregation

**Purpose.** Surface the producer's per-run `CandidateDiagnostics` (currently discarded at the array-only seam) into the job record `resultCounts` and metrics, merged with the batch counts, at **fixed low cardinality** — so an operator can see discovered / eligible / rejected-by-reason / selected / deferred / processed / backlog / oldest-age per fire.

**Existing behaviour.** The producer computes full `CandidateDiagnostics`; `provideCandidates` returns only the array, so diagnostics are dropped; `resultCounts` carries only the batch counts.

**New behaviour.**
- Add an **additive** field `candidatesDeferredByDeadline: number` (and optional `effectiveCeiling`) to `CandidateDiagnostics` (Stage-1 type; additive, consistent with Stage 2A's optional additions).
- Add an **additive richer runner seam** `provideCandidateBatch?: () => Promise<{ candidates: readonly Candidate[]; diagnostics: CandidateDiagnostics }>`, coexisting with `provideCandidates`. Precedence (pinned, documented, tested): `provideCandidateBatch` > `provideCandidates` > `candidates` > `[]`.
- The runner **flattens** diagnostics into `resultCounts` under bounded keys — `discovered`, `malformed`, `eligible`, `selected`, `deferred_by_cap`, `deferred_by_deadline`, `backlog`, `oldest_pending_age_ms`, `emitted`, plus `rejected_<reason>` over the **seeded, closed** reason vocabulary — and reconciles `processed` from the batch result (Feature 11). No `fixtureId`/`captureId`/`validationId`/`matchId` ever appears.

**Failure behaviour.** Best-effort: a diagnostics-merge/emit error MUST NOT fail an otherwise-successful job (wrap the merge/emit; log + continue). A producer *rejection* still fails the job (Feature 6) — that is the discovery path, not the emit path.

**Determinism.** The reason map is seeded (all keys present, value 0) so the counter set is fixed regardless of what a run encounters (`diagnostics.ts:15-19`); flattening is a pure function of the diagnostics object. No clock.

**Interaction with M8.** Reads the frozen M8-batch `SettlementBatchCounts` (`settled/noChange/pending/unsupported/notFound/fixtureMismatch/invalidScore/invalidInput/immutableViolation/writeFailed`) already returned by `runSettlementBatch` — no M8 change.

**Interaction with M9.** Additive richer seam + a flatten helper in the runner; the existing `emitOutcomeMetrics{job,outcome}` counter is extended to the producer outcomes (same low-cardinality shape). `resultCounts` type (`Record<string,number>`) already accommodates it.

**Interaction with Stage 2B / 2C.** Symmetric; the capture and settlement reason vocabularies are already distinct closed sets (`CAPTURE_REJECTION_REASONS`, `SETTLEMENT_REJECTION_REASONS`).

**Risk analysis.** *R:* cardinality explosion. *M:* only seeded closed-set keys + fixed aggregate keys are emitted; a scope test asserts no entity id is a key (as the 2C route scan does). *R:* a merge bug drops a count. *M:* the reconciliation invariant (Feature 11) is asserted.

**Test strategy.** Unit: flatten a known `CandidateDiagnostics` → expected flat map (all reason keys present); assert no entity-id key; a throwing emit does not change job `status`; `provideCandidateBatch` diagnostics reach `resultCounts` end-to-end through the runner.

**Rollback.** The richer seam is optional; without it the array-only `provideCandidates` path (2B/2C) is unchanged and diagnostics are simply not surfaced (today's behaviour). The additive field defaults to 0.

---

### Feature 6 — Typed Failure Codes

**Purpose.** Replace the generic `errorCode:"unhandled"` on a producer rejection with a distinguishable, alertable classification (`source_load_failed`, `archive_read_failed`, `archive_conflict`, `discovery_failed`), while preserving fail-closed semantics.

**Existing behaviour.** A producer rejection → `runWithLock` catch → `errorCode:"unhandled"` (route → 500). Batch faults already map to `write_failed`/`immutable_violation`.

**New behaviour.** A small **typed error** in the M10 producer layer, e.g. `class ProducerError extends Error { code }` with a closed `code` union. `produceCaptureRequests`/`produceSettlementRequests` wrap their phases: a source-loader rejection → `source_load_failed`; an archive strict-read throw → `archive_read_failed`; an `ArchiveStateConflictError` → `archive_conflict`; anything else → `discovery_failed`. The runner reads `err.code` when the caught error is a `ProducerError`, else falls back to `unhandled`. **Additive** — a new error type + a `catch`-classify in the producer + a small runner mapping. The route status mapping (`failed→500`) is unchanged.

**Failure behaviour.** Still fail-closed: every classified failure is a `failed` run (500, alertable), never an empty success. Classification only enriches the code; it never converts a failure into a success or a success into a failure.

**Determinism.** Pure classification of an error shape; no clock. The *same* fault always yields the *same* code.

**Interaction with M8.** None — M8-batch faults keep their existing codes; typed codes cover only the producer/discovery phase.

**Interaction with M9.** The runner's `errorCode` field (`RefreshJobRecord.errorCode?: string`) already accommodates the strings; additive mapping only.

**Interaction with Stage 2B / 2C.** Symmetric; both pipelines wrap identically.

**Risk analysis (incl. the CF-2 nuance).** The Stage-2C production review flagged that `invalidInput`/`fixtureMismatch`/`invalidScore` are *counted* but do **not** flip the run to `failed` (only `writeFailed`/`immutableViolation` do). **Design decision:** Stage 2D does **not** change the `hardFailed` rule (flipping success→failed on a counted-but-safe reject would break idempotent re-fire semantics and is a business-policy change, not an operational control). Instead it surfaces these as an **observability signal** — an additive `run_degraded` boolean/metric derived from the aggregated counts (Feature 12) — so a degraded (but not corrupt) run is *visible* without altering the frozen no-false-write behaviour. Recorded as a deliberate scoping choice.

**Test strategy.** Unit: a `source_load_failed`-throwing producer → run `failed`, `errorCode:"source_load_failed"`; a conflicting archive → `archive_conflict`; an unclassified throw → `discovery_failed`; a plain non-`ProducerError` throw → `unhandled` (back-compat). Assert `failed`→500 mapping unchanged.

**Rollback.** The runner's fallback to `unhandled` means removing the classification degrades gracefully to today's behaviour. No persisted state.

---

### Feature 7 — Backlog Metrics

**Purpose.** Expose `backlog_size` (eligible-and-not-yet-consumed at end of run) so the INV-S capacity gate (`cadence × effectiveCeiling ≥ sustained arrival`) is checkable and unbounded backlog growth is visible before windows expire.

**Existing behaviour.** `backlogSize` is already computed by the provider (`= deferredByCap`); it is discarded at the array-only seam.

**New behaviour.** `backlog_size` (= `deferredByCap + deferredByDeadline`, once Feature 2 adds the deadline deferral) is included in the flattened `resultCounts` (Feature 5) and emitted as a **gauge-style** low-cardinality metric `evidence_job_backlog{job}` (or folded into `evidence_job_outcome_total{job,outcome=backlog}`), and fed into the process-local `getEvidenceJobDiagnostics` last-run counts.

**Failure behaviour.** Best-effort emit (Feature 5); a metric failure never fails the job.

**Determinism.** A pure function of the run's deferral counts; no clock (the *count* is deterministic given the same eligible set and ceilings).

**Interaction with M8 / M9 / 2B / 2C.** Reads producer diagnostics + batch result; additive emit only; symmetric across paths.

**Risk analysis.** *R:* backlog conflated with a failure. *M:* backlog is a *count*, not a status; a bounded-under-a-spike backlog is normal (drains next fire); only *sustained* over-capacity is the INV-S concern, evaluated at activation (Feature 14).

**Test strategy.** Unit: an eligible set larger than the ceiling ⇒ `backlog_size = eligible − selected`; with a deadline deferral ⇒ `backlog_size = deferredByCap + deferredByDeadline`; emitted at bounded cardinality; no entity id.

**Rollback.** Emit is optional/additive; removing it restores no-backlog-visibility (today).

---

### Feature 8 — Oldest-Pending Metrics

**Purpose.** Expose `oldest_pending_candidate_age` (the age of the oldest still-pending eligible candidate) as the **expired-window early-warning** and the second INV-S capacity signal.

**Existing behaviour.** `oldestPendingAgeMs` is already computed by the provider (max age among deferred anchors relative to the injected eval instant); discarded at the seam.

**New behaviour.** Surface `oldest_pending_age_ms` in `resultCounts` (Feature 5) and as a low-cardinality gauge `evidence_job_oldest_pending_age_ms{job}`; feed `getEvidenceJobDiagnostics`.

**Failure behaviour.** Best-effort emit; `null` (no deferrals) is emitted as absent/0, never as an error.

**Determinism.** Computed from the deferred candidates' anchors vs the **injected** evaluation instant (`capturedAt` for capture, `completionInstant` for settlement) — deterministic given the same inputs; no wall clock.

**Interaction with M8.** None.

**Interaction with M9.** Additive emit; the age is computed in the producer (already), surfaced by the runner.

**Interaction with Stage 2B.** Capture's oldest-pending age is the direct `expired_window` predictor (a window nearing kickoff).

**Interaction with Stage 2C.** Settlement's oldest-pending age flags fixtures long-finished but not yet settled (capacity shortfall).

**Risk analysis.** *R:* age uses a wall clock and diverges across fires. *M:* it uses the injected `evaluationInstant`, not `Date.now`; determinism guard enforced.

**Test strategy.** Unit: given deferred anchors at known ages relative to a fixed `evaluationInstant`, `oldest_pending_age_ms` = the max; no deferrals ⇒ null/absent.

**Rollback.** Optional emit; removable without behaviour change.

---

### Feature 9 — Live Completed-Row Loader (settlement)

**Purpose.** Provide the concrete, deterministic finished-fixture source (`FootyMatchRow[]`) that the settlement producer's `loadCompletedRows` seam currently lacks (BQ-1), so settlement can become live at Stage 2E — **without wiring it to the route now**.

**Existing behaviour.** `loadCompletedRows` is a required injected seam with no live default; capture's `loadSource` already defaults to the live `loadPublishedDailyPredictions`.

**New behaviour.** A new server-only reusable loader (proposed `loadCompletedFixtureRows(date): Promise<FootyMatchRow[]>`, likely a thin filter over the already-strict `readDailyArchive(date)` selecting rows whose lifecycle is terminal/finished — mirroring how the classifier resolves lifecycle). It is deterministic (same date + same archive ⇒ same rows, in a stable order), read-only, and fail-closed. It is offered as the **default** for `SettlementPipelineDeps.loadCompletedRows` **but the route is not changed** — the producer is still composed only by tests/a future activation caller. Capture needs no new loader (its live source exists).

**Failure behaviour.** A read/IO failure **rejects** (fail-closed) → producer `source_load_failed` → run `failed`, never a silent `[]`. A single malformed row is **dropped and counted** (`sourceRowsMalformed`), not thrown — matching the provider's existing malformed-row handling — so one bad row does not fail the whole day (distinct from a whole-file read failure, which does).

**Determinism.** Pure over the archive contents; no clock, no random; stable ordering (the provider re-sorts deterministically anyway).

**Interaction with M8.** Produces the `row: FootyMatchRow` that `settleLatestSnapshotForFixture`'s C3/C4 + `resolveMatchLifecycle` consume — unchanged M8 inputs; no correction, no `correctionCause`.

**Interaction with M9.** Runs inside the producer, inside the held lock; a slow loader consumes the deadline budget (Feature 2 bounds it).

**Interaction with Stage 2B.** None (capture's source is separate and already live).

**Interaction with Stage 2C.** Fills the exact BQ-1 seam; **first-settlement-only firewall preserved** — the loader returns rows only; the provider still excludes `settledFixtureIds`, and `correctionCause`/`currentValidationHeads` remain untouched.

**Risk analysis.** *R:* the loader emits non-terminal rows that mis-settle. *M:* terminal filtering + the provider's `resolveMatchLifecycle` classification + M8 C3/C4 are three independent gates; non-terminal ⇒ deferred. *R:* the loader is accidentally route-wired. *M:* Stage 2D explicitly does not touch the route; a scope test re-asserts the route stays the bare delegate.

**Test strategy.** Unit over a seeded temp daily archive: terminal rows returned, non-terminal filtered out, malformed row dropped+counted, IO failure → reject; determinism (same archive → deep-equal rows). Integration: `loadCompletedFixtureRows` composed into `produceSettlementRequests` → correct candidates; route unchanged (scope guard).

**Rollback.** The loader is a standalone function; the seam still accepts an injected fake. Not wired to the route ⇒ removing it leaves settlement dormant exactly as at Stage 2C.

---

### Feature 10 — Loader Isolation

**Purpose.** Ensure the live loader (and any injected source loader) cannot corrupt, hang, or silently blank a run — its faults are isolated to a fail-closed job outcome, never a partial write or a false empty.

**Existing behaviour.** `Promise.all([loadCompletedRows(date), buildSettlementArchiveState(readPort)])` in the producer; a loader rejection already rejects the producer (fail-closed). No per-row fault isolation inside a live loader yet (the seam is dormant).

**New behaviour.** Codify the loader contract: (a) a **whole-source** failure (IO/parse of the source) **throws** → `source_load_failed` → `failed`; (b) a **single-row** fault is **dropped and counted** (`sourceRowsMalformed`), never thrown; (c) the loader is **read-only** (no writes, so no partial-write surface); (d) the loader runs **under the deadline** (a slow loader is bounded by Feature 2's budget — the producer checks remaining time before the batch and defers if the loader already consumed the budget). The `Promise.all` is retained (both branches are handled; a late rejection is not an unhandled rejection).

**Failure behaviour.** As above — fail-closed on whole-source failure; drop-and-count on per-row; never a silent `[]` on failure (only a genuinely empty archive yields `[]` → `succeeded` zero-count).

**Determinism.** The drop-and-count of malformed rows is deterministic (same archive ⇒ same drops); no clock.

**Interaction with M8 / M9 / 2B / 2C.** As Feature 9; the isolation guarantees no partial M8 write results from a loader fault; capture's loader already follows this contract.

**Risk analysis.** *R:* a loader that resolves `[]` on an internal error (fail-open) masks corruption as "nothing to settle." *M:* the contract forbids catch-to-`[]`; a test injects an internal error and asserts a reject, not an empty resolve.

**Test strategy.** Unit: loader that throws → producer rejects → `failed`; loader with one malformed row among valid → valid rows returned, `sourceRowsMalformed` incremented, no throw; loader that (wrongly) returns `[]` on error is caught by the "must reject, not empty" test.

**Rollback.** Contract + tests only; the seam remains injectable. No persisted state.

---

### Feature 11 — Accounting (Reconciliation Invariants)

**Purpose.** Guarantee **no candidate is silently dropped** anywhere in discover → classify → select → process, by asserting the closed reconciliation identities across the aggregated counts.

**Existing behaviour.** The provider computes the piece-wise counts but they are not reconciled end-to-end (diagnostics dropped at the seam).

**New behaviour.** After aggregation (Feature 5), the runner (or a pure helper) asserts, per fire:
`discovered = eligible + rejected(incl. malformed)`; `eligible = selected + deferred_by_cap`; `selected = processed + deferred_by_deadline + batch_faults`; `backlog = deferred_by_cap + deferred_by_deadline`. Any mismatch is logged (and optionally emits a `reconciliation_mismatch` observability signal) but — being an internal-consistency check, not a data fault — **does not** fail the job (fail-open on the *assertion*, since a mismatch is a metrics bug, not evidence corruption). In tests the identities are hard assertions.

**Failure behaviour.** A reconciliation mismatch is an observability/logging event, never an evidence-corruption path (the underlying writes are already M8/M6-idempotent and content-addressed).

**Determinism.** Pure arithmetic over the counts; deterministic.

**Interaction with M8 / M9.** Reads the M8-batch counts (`considered/settled/…`) and the producer counts; no frozen change.

**Interaction with Stage 2B / 2C.** Symmetric; capture adds `healing`/`not_admitted` reasons, settlement adds `already_settled`/`fixture_not_complete` — both closed sets already seeded.

**Risk analysis.** *R:* an identity is wrong because a reason is double-counted. *M:* the seeded closed reason maps + unit tests pin every reason path; the identity test is the backstop.

**Test strategy.** Unit: construct known diagnostics + batch counts, assert all four identities hold; a deliberately-inconsistent fixture triggers the mismatch log (not a job failure).

**Rollback.** Assertion/log only; removable without behaviour change.

---

### Feature 12 — Observability

**Purpose.** Expose the full §10 binding metric set at fixed low cardinality so an operator (and the Stage-2E capacity/activation gates) can see the health of each fire, with **no entity id ever a label**.

**Existing behaviour.** `emitOutcomeMetrics(job, counts)` emits `evidence_job_outcome_total{job,outcome}` per non-zero batch count; the process-local `getEvidenceJobDiagnostics` exists; producer-stage counts are not emitted.

**New behaviour.** Extend emission (all `{job, outcome}`-labelled, low-cardinality, no id) to the producer set: `source_rows_discovered`, `source_rows_malformed`, `candidates_eligible` (capture split `eligible_capture`/`eligible_settle` by `job`), `candidates_rejected` per §6.3 reason, `candidates_selected`, `candidates_deferred{_by_cap,_by_deadline}`, `candidates_processed`, plus the gauges `backlog_size` and `oldest_pending_candidate_age` (Features 7/8). Feed the last-run counts into `getEvidenceJobDiagnostics` (process-local, reset on restart — durable history is an ops concern, out of scope). Add the derived `run_degraded` signal (Feature 6). **No** `verifyEvidenceChain`/`verifyValidationChain` inline call (that stays an out-of-band scheduled sweep — Stage 2E).

**Failure behaviour.** Best-effort: an emit error is logged and swallowed; it never fails or alters a job outcome.

**Determinism.** Counts are deterministic given the run inputs; emission is a side effect, not part of artifact production.

**Interaction with M8 / M9.** Reuses the existing metrics + diagnostics surfaces (`metrics`, `getEvidenceJobDiagnostics`); additive labels/keys only; no frozen change.

**Interaction with Stage 2B / 2C.** Symmetric; distinct closed reason vocabularies keep cardinality fixed.

**Risk analysis.** *R:* an entity id leaks into a label. *M:* a scope/unit test asserts no `fixtureId`/`captureId`/`validationId`/`matchId` appears as a label or `resultCounts` key (mirrors the 2C route scan discipline). *R:* per-request chain-verify sneaks in. *M:* explicitly forbidden; sweep stays out-of-band.

**Test strategy.** Unit: given a run's diagnostics, the emitted metric set matches the expected low-cardinality keys; a spy asserts no id-bearing label; `getEvidenceJobDiagnostics` reflects the last run.

**Rollback.** Additive emission; removing it restores the M9 metric surface. No persisted state.

---

### Feature 13 — Operational Invariants

**Purpose.** State the binding operational invariants Stage 2D must preserve, so implementation and review can check them by trace.

**Existing behaviour.** INV-A (archive sole checkpoint), INV-C (bounded fail-safe ceilings), INV-L (discovery in-lock), fail-closed strict reads, dormant-at-route, frozen contracts — all established by Stages 2A–2C.

**New behaviour (the Stage-2D invariant set):**
- **INV-D** — effective job deadline `= min(configured, 60_000 − headroom) ≤ 45_000`; the 300 s default is clamped, never honoured; no candidate starts without sufficient remaining budget.
- **INV-C (reaffirmed)** — effective ceiling `∈ [1,150]`, default 100, never 500, never unbounded; overflow deferred+counted, never dropped.
- **No silent truncation** — the reconciliation identities (Feature 11) hold; every discovered row is accounted as eligible/rejected/deferred/processed.
- **Determinism of artifacts** — no operational control (deadline clock included) enters any candidate field, identity, hash, or ordering; the only clock is the injected `now` for deadline decisions and the injected `evaluationInstant` for classification.
- **Fail-closed** — corruption/read-throw/source-failure ⇒ `failed` (never empty success); a metrics/diagnostics failure ⇒ best-effort (never fails the job).
- **Bounded cardinality** — no entity id in any metric label or `resultCounts` key.
- **Dormant preserved** — the route is unchanged; no flag default changes; the producer is not route-composed.
- **Frozen preserved** — M6/M8 cores, `ValidationRecord`/`EvidenceSnapshot`/all `types/evidence/*`, identity/hash/revision/lineage formulas, archive format untouched; corrections/`currentValidationHeads`/`correctionCause` not introduced.

**Failure behaviour / Determinism / Interactions.** These invariants are the contract every other feature is measured against; each feature's sections above show conformance.

**Risk analysis.** *R:* an operational control silently changes behaviour when its param is absent. *M:* every seam is optional with a byte-for-byte-unchanged default, regression-guarded by the existing 2B/2C/M9 suites.

**Test strategy.** A dedicated invariant test group: INV-D clamp; ceiling ∈ [1,150]; reconciliation identities; determinism (shuffled input + two `now` clocks ⇒ identical *produced* candidates, possibly different processed *count*); fail-closed (source/read throw ⇒ failed, emit throw ⇒ still succeeded); no-id-label scan; route-unchanged scope guard; frozen-core source scan (no 2D markers in M8/M6).

**Rollback.** Invariants are properties, not code; they are preserved precisely because every change is additive/optional.

---

### Feature 14 — Activation Requirements

**Purpose.** Document exactly what must be true before a live fire is enabled (Stage 2E), so Stage 2D delivers *activation-ready* controls without itself activating anything.

**Existing behaviour.** Flags default-off; routes dormant; single-writer rests on `EVIDENCE_DATABASE_URL` (prod fail-closed); no benchmark recorded.

**New behaviour (documented prerequisites, not enabled here):**
- **INV-S capacity gate** — activation MUST fail/block if the measured/estimated sustained arrival rate exceeds `cadence × effectiveCeiling` for each path; checkable against the backlog/oldest-age metrics (Features 7/8).
- **Deadline+workload benchmark (Stage 2E, Gate B5)** — the ceiling-sized run must be proven `< 45 s` at representative archive depth; this validates `reservePerCandidateMs` (Feature 2) and the headroom (Feature 1). **Stage 2D does not run it** (Stage-2E benchmarks are out of scope) — it only makes the knobs benchmarkable.
- **Single-writer config** — `EVIDENCE_DATABASE_URL` present+reachable and `NODE_ENV=production` (M9, unchanged).
- **Live completed-rows loader validated** (Feature 9) and the capture derivation (M4/M5) built — the latter is the separate live-derivation stage, still out of scope.
- **Out-of-band chain-verify sweep + alerting + H-1 unlock-500 fix** — Stage 2E gates; Stage 2D emits the signals but wires no sweep and does not touch the unlock path.

**Failure behaviour / Determinism / Interactions.** Documentation only; no runtime behaviour. Stage 2D's controls make each gate *checkable*; enabling remains an out-of-repo operational action.

**Risk analysis.** *R:* Stage 2D is mistaken for activation. *M:* this plan and the eventual implementation record state STAGE 2D IS DORMANT; the route is untouched; a scope test asserts it.

**Test strategy.** No runtime test (documentation); the checklist is validated by the Stage-2E activation review.

**Rollback.** N/A (documentation).

---

## 3. Proposed File-Level Change Set (for the eventual Stage 2D implementation — not this task)

All additive; frozen M6/M8 cores and all contracts untouched; route/flags unchanged.

| # | File | Change | Boundary |
|---|---|---|---|
| 1 | **NEW** `lib/evidence-capture/candidates/deadline.ts` (name non-binding) | `resolveEffectiveJobDeadlineMs`, deadline handle (`remainingMs` over injected `now`), `shouldStartNext`, `resolveEffectiveCeiling` | Pure M10 producer-layer |
| 2 | **MODIFY (additive)** `candidates/types.ts` | add `candidatesDeferredByDeadline` (+ optional `effectiveCeiling`) to `CandidateDiagnostics`; add the `ProducerError`/code union | Additive type only |
| 3 | **MODIFY (additive)** `candidates/diagnostics.ts` | seed the new `candidatesDeferredByDeadline` key (value 0) | Additive |
| 4 | **MODIFY (additive)** `capture-pipeline.ts` / `settlement-pipeline.ts` | resolve effective ceiling into provider config; return `{candidates,diagnostics}` via the richer seam; wrap loader/reader faults into typed codes; loader-isolation contract | M10 producer-layer, additive |
| 5 | **MODIFY (additive)** `lib/evidence-capture/jobs/capture-run.ts` / `settlement-run.ts` | optional `deadline?` guard param + `deferredByDeadline` count | M9 *orchestration* (frozen M6/M8 core untouched) |
| 6 | **MODIFY (additive)** `lib/jobs/runner.ts` | capture `startedAtMs`; build the deadline handle; optional `provideCandidateBatch?` seam; flatten+reconcile diagnostics into `resultCounts`; typed `errorCode`; extend `emitOutcomeMetrics` | M9 *orchestration*, additive/optional |
| 7 | **NEW** `lib/evidence-capture/source-completed.ts` (or additive to `source.ts`) | `loadCompletedFixtureRows(date)` live settlement loader (dormant; not route-wired) | New server-only reader |
| 8 | **MODIFY (additive)** `lib/evidence-capture/config.ts` | additive resolvers/env knobs (`EVIDENCE_JOB_RESERVED_HEADROOM_MS`, `EVIDENCE_CAPTURE_MAX_CANDIDATES`, `EVIDENCE_SETTLEMENT_MAX_CANDIDATES`, `EVIDENCE_PER_CANDIDATE_RESERVE_MS`) with conservative fail-safe defaults; **no existing default changed** | Additive config (M0 surface) |
| 9 | **NEW** `tests/evidenceOperationalControls.test.ts` (+ additions to pipeline/runner suites) | the test matrix below | New tests only |
| 10 | **NEW** `docs/plans/m10-stage-2d-operational-controls-implementation.md` | implementation record (later) | Doc |

**Explicitly NOT changed:** M8 (`settlement.ts`/`outcomes.ts`), M6 (`capture.ts`/`mandatory-odds.ts`), `types/evidence/*`, `ValidationRecord`, store interfaces, the two cron routes, `locks.ts`, `cronHandler.ts`, flag defaults, archive format, `DEFAULT_CAPTURE_MAX_FIXTURES`/`DEFAULT_RUN_DEADLINE_MS` (kept; only *clamped/superseded* at the call site).

---

## 4. Consolidated Risk Register

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| R1 | `reservePerCandidateMs`/headroom mis-tuned → overrun or chronic under-use | Med | Conservative defaults; Stage-2E benchmark tunes; backlog/oldest-age make under-use visible; 15 s headroom cushion |
| R2 | Deadline clock leaks `Date.now` into artifacts | High→Low | Single injected `now` seam; determinism static rule; artifacts proven clock-free |
| R3 | Diagnostics cardinality explosion / entity-id label | Med | Seeded closed reason maps + fixed aggregate keys; no-id-label test |
| R4 | Additive seam silently changes a default path | High→Low | Every param optional; unchanged default; 2B/2C/M9 regression suites are the guard |
| R5 | Live loader fail-open (`[]` on error) masks corruption | High | Loader contract forbids catch-to-`[]`; "must reject not empty" test; whole-file failure ⇒ `failed` |
| R6 | An operational control drifts into business logic (corrections) | High | OUT-OF-SCOPE firewall (below) + source scan asserting no `correctionCause`/`currentValidationHeads` |
| R7 | Reconciliation mismatch mistaken for evidence corruption | Low | Mismatch is a metrics-only log, never a job failure; underlying writes stay idempotent/content-addressed |
| R8 | Stage 2D mistaken for activation | Med | Route untouched; dormant preserved; scope test; explicit status wording |

---

## 5. Test Matrix (design; authored test-first at implementation)

- **Deadline (INV-D):** clamp 300 000→≤45 000; honour smaller; fail-safe on invalid; `remainingMs` monotone/≥0 under fake clock.
- **Remaining-time guard:** mid-batch defer before candidate *k*; frozen core not called for deferred; `deadline` absent ⇒ full-array back-compat; empty array ⇒ no trip.
- **Ceilings:** default 100; `>150`→150; invalid→100; property `∈[1,150]`; overflow deferred+counted.
- **Diagnostics aggregation:** flatten → expected keys; richer seam threads diagnostics to `resultCounts`; emit-throw ⇒ still `succeeded`; precedence pinned (`provideCandidateBatch` > `provideCandidates` > `candidates` > `[]`).
- **Typed codes:** source/read/conflict/unclassified → distinct codes; non-`ProducerError` → `unhandled`; `failed`→500 unchanged.
- **Backlog / oldest-age:** correct counts/age vs fixed eval instant; bounded cardinality; null when no deferral.
- **Live loader + isolation:** terminal-only; malformed row dropped+counted; IO failure → reject (never `[]`); determinism; **route unchanged** scope guard; first-settlement firewall preserved (no `correctionCause`/`currentValidationHeads`).
- **Accounting:** four reconciliation identities hold; mismatch logs (not fails).
- **Observability:** metric set matches; no id label; `getEvidenceJobDiagnostics` reflects last run; no inline chain-verify.
- **Invariants:** determinism (shuffled input + two clocks ⇒ identical produced candidates); fail-closed sweep; frozen-core no-2D-markers scan.
- **Regression:** full suite (baseline **1795** + new), typecheck exit 0, lint clean; Stage 2B/2C/M8/M9 suites unchanged-green.

---

## 6. Rollback Summary

Every Stage-2D control is an **optional parameter or a new module**; the dormant route and all default call sites are byte-for-byte unchanged. Rollback of any feature = drop the optional param / delete the module — no data to un-migrate (nothing is written by Stage 2D that is not already a frozen M6/M8 idempotent record), no schema change, no flag change, no route change. The append-only archive and the frozen contracts guarantee that even an accidental live fire under these controls is safe (bounded, fail-closed, first-settle-only).

---

## 7. Out of Scope (explicitly excluded from Stage 2D)

**Not designed, not implemented, not planned here:** corrections; consuming `currentValidationHeads`; producing `correctionCause`; any revision/lineage logic; any `ValidationRecord` or archive-schema change; route activation; production enablement / flag flips; Postgres adapters or the shared adapter resolver; Stage-2E benchmarks (representative-depth whole-route, M8 read-amplification, event-loop-delay, peak-RSS, string-wall capacity), overlap/crash-replay matrices, the H-1 unlock-500 remediation, and the out-of-band chain-verify sweep. These belong to the later correction stage, Stage 2E, or the future adapter/migration work per the Stage-2C closure register (§10–§12 there). Stage 2D **emits the signals** those gates consume but **wires none of them**.

---

## 8. Stage Status & Dependencies

- Stage 2D is a **design plan**; nothing is implemented by this task.
- Implementation is **authorized to begin** only after the Stage-2D preparation reviews (architecture — this plan; safety; performance; test; migration) are authored and reconciled, per the Stage-2C closure decision.
- Stage 2D ships **dormant**: controls built and unit-tested, route unchanged, flags off, producer not route-composed; live activation remains a Stage-2E action.
- On completion, Stage 2D will be recorded as **STAGE 2D IMPLEMENTED — DORMANT OPERATIONAL CONTROLS** (not M10-complete, not production-ready).

---

# STAGE 2D PLAN READY

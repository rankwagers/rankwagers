# M10 Stage 2D — Operational Controls (Implementation Record)

**Document type:** Implementation-stage record (Stage 2D of M10).
**Date:** 2026-07-30
**Status:** Stage 2D implemented, **dormant** (routes unchanged, flags off, producer not route-composed). **M10 is NOT complete; NOT production-ready.**
**Governing:** `m10-stage-2d-operational-controls-plan.md` + the five preparation reviews (implementation CONDITIONALLY APPROVED, production/performance CONDITIONALLY PASSED, test CONDITIONALLY READY, migration COMPATIBLE), with RC-1/RC-2 resolved and the 15 acceptance criteria met.

---

## 1. Implemented Files

**Created:**
- `lib/evidence-capture/candidates/operational.ts` — pure operational helpers: `resolveEffectiveJobDeadlineMs`, `createDeadline`, `shouldStartNext`, `resolveEffectiveCeiling`, `ProducerError`/`producerErrorCode`, `reconcileCaptureDiagnostics`/`reconcileSettlementDiagnostics`, `flattenDiagnostics`, `emitProducerMetrics`, the `BatchDeadlineBudget`/`ProducerBatch` types.
- `lib/evidence-capture/candidates/completed-rows.ts` — dormant loader: `filterCompletedRows` (pure) + `createCompletedRowLoader` (whole-source + per-row isolation).
- `tests/evidenceOperationalControls.test.ts` — 29 tests (fake clock, no sleeps/network/archive mutation).
- `docs/plans/m10-stage-2d-operational-controls-implementation.md` — this record.

**Modified (additive; frozen M6/M8 cores + all `types/evidence/*` untouched):**
- `lib/evidence-capture/candidates/types.ts` — 4 additive `CandidateDiagnostics` fields (`candidatesDeferredByDeadline`, `sourceRowsAdmitted`, `groupedFixtures`, `effectiveCeiling`).
- `lib/evidence-capture/candidates/diagnostics.ts` — seed the 4 new fields to 0.
- `lib/evidence-capture/candidates/capture-provider.ts` — RC-1 counters (`sourceRowsAdmitted`++ per admitted row; `groupedFixtures` = distinct groups) + surface `effectiveCeiling`.
- `lib/evidence-capture/candidates/settlement-provider.ts` — surface `effectiveCeiling`.
- `lib/evidence-capture/jobs/capture-run.ts` — additive optional `deadline?` guard param + `deferredByDeadline` count.
- `lib/evidence-capture/jobs/settlement-run.ts` — same, symmetric.
- `lib/jobs/runner.ts` — `provideCandidateBatch?` rich seam + injected `now?`; INV-D deadline engaged only on a producer path; typed producer `errorCode`; best-effort diagnostics merge + `run_degraded`; two helpers (`producerDeadlineBudget`, `mergeProducerResultCounts`).
- `lib/evidence-capture/config.ts` — additive `resolveEvidenceOperationalConfig` + provisional constants (`DEFAULT_JOB_RESERVED_HEADROOM_MS=15000`, capture/settlement per-candidate reserves). **No existing default changed.**

**NOT changed:** M6 (`capture.ts`/`mandatory-odds.ts`), M8 (`settlement.ts`/`outcomes.ts`/`validation/*`), `ValidationRecord`/`EvidenceSnapshot`/`SettlementCandidate` frozen fields, identity/hash/revision/`settledAt` semantics, archive NDJSON format, both cron routes, flag defaults, `locks.ts`, `cronHandler.ts`, `DEFAULT_CAPTURE_MAX_FIXTURES`/`DEFAULT_RUN_DEADLINE_MS`.

## 2. Deadline Semantics (INV-D)

`resolveEffectiveJobDeadlineMs(configured, {routeBudgetMs=60000, headroomMs=15000})` = `clamp(min(configured, min(routeBudget−headroom, 45000)), 1, …)`. The 300 s `DEFAULT_RUN_DEADLINE_MS` clamps to **45 000** and is never honoured; invalid/0/neg/NaN/non-number fails safe to the bounded upper (never unbounded, never 300 s). The clock is an **injected `now`** (`createDeadline`); a non-finite `now()` ⇒ `remainingMs=0` (defer everything). The clock never enters `capturedAt`/`completionInstant`/`nowSec`/identity/hash/ordering — it only decides whether the next candidate may begin.

## 3. Remaining-Time Semantics (defer-not-overrun)

`shouldStartNext(remainingMs, reserve)` = finite `remainingMs ≥ reserve`. The M9 batch sequencers (`runCaptureBatch`/`runSettlementBatch`) take an additive optional `deadline?: {remainingMs, reservePerCandidateMs}` and, **at the top of each loop iteration before any store touch**, defer the remainder (`deferredByDeadline += remaining`) and `break`. This is strictly **between candidates**: an in-flight mint/settle append completes; only the *next* candidate is prevented. Absent ⇒ today's full-array behaviour. Engaged automatically on a producer path (reserve from config: capture 250 ms, settlement 120 ms — provisional, Stage-2E-tunable).

## 4. Ceiling Semantics (INV-C)

`resolveEffectiveCeiling(configured)` = `normalizeBatchLimit` ⇒ `[1,150]`, default **100**, `>150→150`, invalid/0/neg/NaN→100. Verified boundaries: undefined/0/NaN→100, 1→1, 99→99, 100→100, 101→101, 150→150, 151→150, **500→150** (the legacy constant can never be the effective ceiling). Both providers surface `effectiveCeiling` in diagnostics; overflow is deferred+counted (`candidatesDeferredByCap`), never dropped, and re-discoverable next fire (INV-A, no cursor).

## 5. Diagnostics Schema

`flattenDiagnostics` → a flat `Record<string,number>` with fixed aggregate keys — `discovered, malformed, admitted, grouped_fixtures, eligible, selected, deferred_by_cap, deferred_by_deadline, healing, processed, emitted, backlog, oldest_pending_age_ms, effective_ceiling` — plus `rejected_<reason>` over the **seeded, closed** reason set (cardinality cannot grow; `bumpReason` ignores unknown keys). Merged into the job `resultCounts` by `mergeProducerResultCounts` (fills `candidatesProcessed` = batch considered; `run_degraded` flag). All values finite; **no fixtureId/matchId/captureId/validationId ever a key**. Best-effort: a merge/emit throw falls back to batch counts — never fails the job. `getEvidenceJobDiagnostics` surfaces the merged `resultCounts` unchanged.

## 6. Failure-Code Policy

`ProducerError{code}` with the bounded set `source_load_failed | archive_read_failed | archive_conflict | invalid_source_row | discovery_failed`. A producer rejection inside the lock is caught → run `failed` with `errorCode = producerErrorCode(err) ?? "unhandled"` (non-`ProducerError` → `unhandled`, back-compat). The route `failed→500` mapping is unchanged; classification never converts failure↔success. `run_degraded` (derived from counted-but-safe rejects — capture `notAdmitted/invalid`; settlement `invalidInput/fixtureMismatch/invalidScore/notFound`) is a **visibility flag** that does **not** flip `hardFailed`/HTTP status (frozen no-false-write behaviour preserved). Batch write/append faults keep the existing `write_failed`/`immutable_violation` hard-failure path.

## 7. RC-1 Resolution (capture accounting grain)

Capture mixes row-grain (`sourceRowsDiscovered`) and fixture-grain (`candidatesEligible`); N distinct-market rows merge into one fixture, leaving N−1 rows unaccounted. **Resolved** by adding `sourceRowsAdmitted` (rows admitted into a group) and `groupedFixtures` (distinct groups). `reconcileCaptureDiagnostics` asserts FOUR closing identities with **zero unaccounted rows**:
- row: `discovered = malformed + rowRejects(unsupported_market+duplicate_candidate) + admitted`
- fixture: `groupedFixtures = eligible + fixtureRejects`
- eligible: `eligible = selected + deferredByCap`
- selected: `selected = emitted + derivationRejects`; emitted: `emitted = processed + deferredByDeadline`.
Proven by a test with 3 distinct-market rows → 1 fixture (admitted=3, grouped=1) — the identity closes. Settlement is single-grain (`reconcileSettlementDiagnostics`) and needs no counter.

## 8. RC-2 Resolution (cancellation policy)

Stage 2D introduces **no unsafe mid-append cancellation and no broad cancellation framework**. The cancellation mechanism is **between-candidate deferral** (Feature 2): the guard runs before starting each candidate and never interrupts an in-flight atomic append. Cooperative `AbortSignal` cancellation of loader/M4 (production SD-3) is **deferred**: live M4 network derivation is unbuilt (out of scope), and the D-9 completed-rows loader is **read-only** and bounded at the orchestration boundary by the pre-batch remaining-time posture — a slow loader consumes budget but can never tear an evidence/validation write. **Residual (documented, Stage-2E):** a *hung* loader/read is bounded only by the 60 s platform kill; safe because read-only (no partial write), but not graceful. A deadline-bounded loader timeout (NB-1) is the recommended Stage-2E hardening. No `AbortSignal` reaches any append.

## 9. Loader Behaviour

`filterCompletedRows(rows, {nowSec})` — PURE, deterministic (matchId-asc order), terminal-only via the authoritative `resolveMatchLifecycle` (finished with valid FT/HT scores; postponed/cancelled/abandoned no-score). `createCompletedRowLoader({readRows, nowSec, onFilter})` builds a `loadCompletedRows(date)` over an **injected** whole-source reader. **The concrete production reader is an ACTIVATION DEPENDENCY, deliberately not fabricated** — it is supplied by injection (tests / a future Stage-2E caller), never wired into a route here. `nowSec` is the run's deterministic evaluation seconds (no clock).

## 10. Whole-Source vs Per-Row Isolation

- **Whole-source failure** (reader throws or returns `null`): FAIL-CLOSED → `ProducerError("source_load_failed")` → run `failed`. **Never** a silent empty-success `[]`.
- **Per-row fault**: dropped + counted by bounded reason (`malformed_row | invalid_fixture_id | invalid_kickoff | invalid_final_score | unresolved_lifecycle | duplicate_row`); valid rows continue. Non-terminal rows are excluded (not a fault; `excludedNonTerminal`, re-checked next fire).
- **Provider/candidate faults** keep existing provider semantics (counted; no unsafe write; `run_degraded`).

## 11. Accounting Identities

See §7. Reconciliation is an internal-consistency check: a mismatch is detectable (`recon.ok === false`) and logged/observable but **does not fail the job** (the underlying M6/M8 writes are content-addressed + idempotent; a count mismatch is a metrics bug, not evidence corruption). No candidate is silently dropped: deadline/cap deferrals are counted and re-discoverable (INV-A, no cursor).

## 12. Metrics

`emitProducerMetrics(job, diag)` → `evidence_producer_outcome_total{job,outcome}` (per non-zero outcome), `evidence_producer_rejected_total{job,reason}` (closed reason set), and gauges `evidence_producer_backlog{job}` + `evidence_producer_oldest_pending_age_ms{job}` (dropped when null/non-finite). Reuses the existing `metrics` module (`safeRun`-wrapped); the whole emit is additionally try/caught → **best-effort, never fails a job**. Bounded cardinality: labels are `{job, outcome|reason}` only — no entity identifiers.

## 13. Dormancy Proof

Both cron routes remain the bare M9 delegates (`runEvidenceCaptureJob()` / `runPredictionSettlementJob()`) — a scope test asserts they wire no `provideCandidate*`, no `produce*Requests`, and no `createCompletedRowLoader`. No flag default changed; the producer is not route-composed; the completed-rows loader is built-but-not-wired. The deadline engages only when a producer seam is supplied, so the bare fire and the M9 static-candidates path are byte-for-byte unchanged (regression suites green). A static-guard test asserts `operational.ts`/`completed-rows.ts` use no `Date.now`/`Math.random`/`correctionCause`/`currentValidationHeads`.

## 14. Explicitly Excluded Scope

No corrections / `currentValidationHeads` / `correctionCause` / revision-lineage; no `ValidationRecord`/schema/archive-format change; no migration; no route activation / flag enablement / scheduler / deployment change; no Postgres; no Stage-2E benchmarks (representative-depth, event-loop, RSS, string-wall capacity), overlap/crash matrices, H-1 unlock-500, chain-verify sweep, or live M4→M5 derivation. Stage 2D emits the signals those gates consume but wires none of them.

## 15. Validation Commands and Results

| Check | Command | Result |
|---|---|---|
| Stage-2D operational controls | `… --test tests/evidenceOperationalControls.test.ts` | **29 pass / 0 fail / 0 skip** |
| Stage-1 provider (RC-1 grain) | `… --test tests/evidenceCandidateProvider.test.ts` | **48 / 0 / 0** |
| Stage-2A / 2B / 2C | archive-state 25 · capture-pipeline 9 · settlement-pipeline 26 | **60 / 0 / 0** |
| M8 settlement | `… --test tests/evidenceSettlement.test.ts` | **34 / 0 / 0** |
| M9 activation / concurrency | 18 · 11 | **29 / 0 / 0** |
| Full suite | `npm test` | *(see final report — 1795 + 29 new)* |
| Typecheck | `npm run typecheck` | **clean — exit 0** |
| Lint | `npm run lint` | **clean** |

## 16. Known Residual Risks

- **Hung read/loader** bounded only by the 60 s platform kill (safe: read-only) — Stage-2E timeout (NB-1) recommended (RC-2 residual).
- **`reservePerCandidateMs` / headroom** are provisional constants — the Stage-2E Gate-B5 benchmark must validate them against representative archive depth.
- **In-flight single M6/M8 whole-archive scan is uninterruptible** — the guard is between-candidate; the real fix (streaming/off-process) is Stage-2E.
- **`run_degraded`** is a visibility flag only; alert routing is an ops gate.
- Diagnostics are **process-local** (reset on restart); durable history/alerting is an ops gate.

## 17. Stage 2E Carry-Forward

Representative-depth whole-route + M8 read-amplification + event-loop-delay + peak-RSS benchmarks; string-wall capacity gate; multi-worker/overlap + crash/replay matrices; route-activation tests; H-1 unlock-500; single-writer config gate; fsync/sweep/quarantine; hung-loader timeout (NB-1); live completed-rows production reader + M4→M5 capture derivation.

## 18. Correction-Stage Carry-Forward

Consume `currentValidationHeads`; genuine correction detection; `correctionCause` policy; `settlement_correction` vs `data_correction`; correction replay/idempotency/observability/burst — all excluded here.

## 19. Rollback

Every Stage-2D control is an optional parameter or a new module; the dormant route and all default call sites are byte-for-byte unchanged. Rollback = drop the optional params / delete the two new modules + the 4 additive diagnostics fields — no schema, no migration, no persisted state. The append-only archive + frozen contracts guarantee even an accidental producer-driven fire under these controls is bounded, fail-closed, and first-settle-only.

---

# STAGE 2D IMPLEMENTED — DORMANT OPERATIONAL CONTROLS

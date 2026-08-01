# M10 Stage 2 — Locked Discovery & Archive-State Orchestration — Architecture & Integration Plan

**Document type:** Implementation-ready architecture plan (read-only planning; no code/tests/flags/routes/schedules/archive/env/db/deploy changed).
**Date:** 2026-07-30
**Author:** Architecture & Integration Planner, Sprint 23B / M10 Stage 2.
**Governing:** `docs/architecture/m10-live-candidate-pipeline-specification.md` (Rev A1), `docs/plans/m10-live-candidate-pipeline-architecture-review.md`, `docs/plans/m10-stage-1-candidate-provider-foundation.md`, `docs/plans/m10-stage-1-candidate-provider-implementation-review.md` (STAGE 1 APPROVED), the Rev 2 contract, the Phase 2.7 DoD, the M9/M10 closures.
**Method:** Current call graph, signatures, and boundaries were read directly from source (file:line cited). No runtime file was modified.

---

## 1. Executive Summary

M9 shipped runnable capture/settlement orchestration whose runners call the frozen M6/M8 batches with an **injected candidate array that defaults to empty**, so a bare cron fire is a correct no-op. M10 Stage 1 shipped the pure, approved candidate **provider** (`lib/evidence-capture/candidates/*`): deterministic discovery/classification/ordering/bounded-selection with archive-derived progress and the derivation dependency **injected**.

**Stage 2 is the wiring that runs discovery — inside the durable job lock — and feeds the provider's bounded output into the existing M6/M8 batches, with flags still default-off.** The single load-bearing constraint (INV-L) is that *authoritative discovery, eligibility, archive-state derivation, ordering, bounded selection, and processing all occur inside the held lock*; only the cheap auth + flag checks may precede it. The current runner already holds the lock in exactly the right place (`runWithLock`'s callback in `lib/jobs/runner.ts:291,328`), so Stage 2's insertion is **inside that callback** via an injected `discover` producer — no business logic moves into cron routes, and no frozen contract, identity, hash, revision, archive format, or replay semantic changes.

**Architecture readiness: READY.** All consumer surfaces (routes, runners, lock, stores, M4 routing, M5 derivation, diagnostics) exist, are typed, and are green (1735/1735). Stage 2 is a bounded set of **additive** modules + a small, backward-compatible extension to the two runner functions and the two batch orchestrators, plus two one-line route wirings. No unresolved blocker. Stage 2 may be implemented now that Stage 1 is APPROVED.

---

## 2. Authoritative Inputs

Read and cross-checked: the M10 spec (Rev A1, §4.0 Option C, §6 eligibility, §7 scheduling/INV-C/D/L/A/S, §9 perf, §10 observability, §12 DoD), the architecture review (Option C binding, discovery-inside-lock C14/BF-2), the Stage 1 foundation + APPROVED implementation review (provider is pure/injected; §22 lists exactly the Stage 2 conditions), the Rev 2 contract (§1 selected-fixture, §3 identities, §4.9 replay), the DoD (Gate A/B model), and the M9/M10 closures (empty-pass baseline; H-1/H-2/H-3 carry-forward).

---

## 3. Existing Capture Call Graph (verified)

```
POST /api/internal/cron/evidence-capture/route.ts   (maxDuration=60, force-dynamic, nodejs)
  → handleCronPost(req, () => runEvidenceCaptureJob())          lib/jobs/cronHandler.ts:13
      → evaluateCronAccess(...)   (POST-only 405 / internalCronEnabled 404 / x-cron-secret 403)   ← BEFORE lock
      → rate-limit 6/60s → 429                                                                     ← BEFORE lock
      → run()  ==  runEvidenceCaptureJob()                                                          lib/jobs/runner.ts:282
          → isCaptureEnabled(env)  (env EVIDENCE_CAPTURE_ENABLED, "true"/"1")  → flagSkippedJob if off  ← BEFORE lock
          → runWithLock("evidence_capture", async (job) => { … })                                  lib/jobs/runner.ts:55,291
              → tryAcquireJobLock("job:evidence_capture", { requireDurable:true })                 lib/jobs/locks.ts:18   ── LOCK HELD ──
              → deps = { evidenceStore: getEvidenceArchiveStore(), oddsStore: getOddsArchiveStore() }  runner.ts:292
              → runCaptureBatch(deps, options?.candidates ?? [])                                    lib/evidence-capture/jobs/capture-run.ts:87
                    for each CaptureRequest:
                      → captureEvidenceSnapshot(evidenceStore, req)                                 capture/capture.ts:70  (full-stream idempotency, mint)
                      → ensureMandatoryCaptureOdds(oddsStore, snapshot)                             capture/mandatory-odds.ts:121  (C5, one record/market)
              → emitOutcomeMetrics("capture", counts)                                               runner.ts:265
              → return RefreshJobRecord{ status, resultCounts:{...counts}, errorCode }
              ── finally: lock.release() ──                                                         runner.ts:135
      → status→HTTP: failed→500, skipped→409, else 200 (+resultCounts, no-store, noindex)           cronHandler.ts:71
```

| Property | Value | Anchor |
|---|---|---|
| Route export | `POST` (thin) | `app/api/internal/cron/evidence-capture/route.ts:12` |
| Runner symbol / args / return | `runEvidenceCaptureJob(options?: { env?, candidates?: readonly CaptureRequest[], deps?: CaptureBatchDeps }) : Promise<RefreshJobRecord>` | `runner.ts:282-286` |
| Callee (batch) | `runCaptureBatch(deps: CaptureBatchDeps, candidates): Promise<{counts, failures}>` | `capture-run.ts:87` |
| M6 write path | `captureEvidenceSnapshot` + `ensureMandatoryCaptureOdds` | `capture.ts:70`, `mandatory-odds.ts:121` |
| **Lock boundary** | inside `runWithLock` callback (batch runs under the lock) | `runner.ts:291` |
| **Deadline boundary** | **none in the runner**; only route `maxDuration=60`; batch has no internal timeout | route `:7`; `capture-run.ts` (no clock) |
| **Diagnostics boundary** | `resultCounts` = batch `CaptureBatchCounts`; `emitOutcomeMetrics` → `evidence_job_outcome_total{job,outcome}`; `getEvidenceJobDiagnostics` reads `listRecentJobs` | `runner.ts:265-273`, `diagnostics.ts:59` |
| Candidate source today | `options?.candidates ?? []` → **empty** (route passes none) | `runner.ts:296` |

## 4. Existing Settlement Call Graph (verified)

```
POST /api/internal/cron/prediction-settlement/route.ts   (maxDuration=60)
  → handleCronPost(req, () => runPredictionSettlementJob())
      → evaluateCronAccess / rate-limit                                                             ← BEFORE lock
      → runPredictionSettlementJob()                                                                runner.ts:319
          → isSettlementEnabled(env) → flagSkippedJob if off                                        ← BEFORE lock
          → runWithLock("prediction_settlement", async (job) => { … })                              runner.ts:328   ── LOCK HELD ──
              → deps = { evidenceStore: getEvidenceArchiveStore() }                                 runner.ts:329
              → runSettlementBatch(deps, options?.candidates ?? [])                                 lib/evidence-capture/jobs/settlement-run.ts:124
                    for each SettlementCandidate:
                      → C3 fixture correspondence (row.matchId === fixtureId)                        settlement-run.ts:135
                      → C4 score sanity (hasValidCompletedScores)                                    settlement-run.ts:147
                      → settleLatestSnapshotForFixture(evidenceStore, {fixtureId,row,completionInstant,nowSec,correctionCause?,recordedBy?})  settlement.ts:364
                            → latestSnapshot(fixtureId) → settleSnapshot(...) → per-market resolveValidationOutcome → append revision-aware
              → emitOutcomeMetrics("settlement", counts)
              → return RefreshJobRecord{ status, resultCounts, errorCode }
              ── finally: lock.release() ──
```

| Property | Value | Anchor |
|---|---|---|
| Runner symbol / args / return | `runPredictionSettlementJob(options?: { env?, candidates?: readonly SettlementCandidate[], deps?: SettlementBatchDeps }) : Promise<RefreshJobRecord>` | `runner.ts:319-323` |
| Callee (batch) | `runSettlementBatch(deps, candidates): Promise<{counts, failures}>` | `settlement-run.ts:124` |
| M8 write path | `settleLatestSnapshotForFixture` → `settleSnapshot` (latest snapshot, all markets) | `settlement.ts:364,191` |
| Lock / deadline / diagnostics boundaries | identical structure to capture (lock in `runWithLock`; no deadline; `resultCounts` = `SettlementBatchCounts`) | `runner.ts:328` |
| Candidate source today | `options?.candidates ?? []` → **empty** | `runner.ts:332` |

**Key finding:** both runners already hold the durable lock exactly where discovery must run. The only change needed to satisfy INV-L is to compute candidates **inside** the `runWithLock` callback instead of receiving them pre-computed from the caller.

---

## 5. Proposed Stage 2 Architecture

A thin **producer-injection** seam on the runner + a dedicated **discovery/orchestration** module + a dedicated **derivation adapter** (the M4/M5 implementation of Stage 1's injected `deriveCaptureInput`). Cron routes stay one-liners.

```
route (thin, unchanged shape)
  → handleCronPost → runLive{Capture,Settlement}Job()      [wiring.ts one-liner OR route passes `discover`]
      → auth + rate-limit            (BEFORE lock — cheap, no archive/network)   ✅ INV-L
      → flag check                   (BEFORE lock — cheap env read)              ✅ INV-L
      → runWithLock(...) {           ── LOCK HELD ──                             ✅ INV-L begins
          evalInstant = clock once   (single read for eligibility timing only; never enters identity)
          candidates,diag = await discover(deps, { evalInstant, config })   ← NEW, inside lock
              1. loadPublishedDailyPredictions(dateFrom(evalInstant))       (source, inside lock)
              2. deriveCaptureArchiveState / deriveSettlementArchiveState(stores, fixtureIds)  (archive read, inside lock)
              3. build{Capture,Settlement}Candidates(Stage-1 provider)      (pure classify/order/bound)
                 (capture: deriveCaptureInput = M4 fetch/admission + M5 derive, inside lock)
          result = await run{Capture,Settlement}Batch(deps, candidates, { deadline })  ← existing batch + optional INV-D guard
          mergedCounts = merge(provider diag, batch counts)
          emitOutcomeMetrics(...); return RefreshJobRecord{ resultCounts: mergedCounts }
        } finally lock.release()
```

**Design rules honoured:** cron routes contain no business logic (they name a pre-wired job); the runner orchestrates lock + discover + batch (no discovery *logic*, just invocation order); the discovery module is the only place that reads source + archive; the Stage 1 providers remain pure; the M4/M5 wiring lives behind the injected `deriveCaptureInput`. Adapter-neutral throughout — everything flows through the `EvidenceArchiveStore` / `OddsArchiveStore` interfaces and the M4 source/routing entry points, never the file adapter directly (Postgres-safe).

---

## 6. Durable Lock Boundary (INV-L — binding)

**Verified current lock placement:** `runWithLock(jobType, fn)` acquires `tryAcquireJobLock("job:"+jobType, { requireDurable:true })` (`runner.ts:74`, `locks.ts:18`), runs `fn(job)` with the lock held, and releases in `finally` (`runner.ts:135`). Durable-lock binding is `EVIDENCE_DATABASE_URL`, **fail-closed in production** (`locks.ts:27-41`); contention → `null` → `skipped`/409.

**Required movement (minimal, no code leaves the lock):**
- **Before lock (already correct, keep):** `evaluateCronAccess` + rate-limit (cronHandler), and `isCaptureEnabled`/`isSettlementEnabled` (runner, before `runWithLock`). These read no archive and touch no store. A disabled/denied fire short-circuits without acquiring the lock. ✅
- **Inside lock (new — all of it):** the `discover(...)` call (source load → archive-state derivation → Stage 1 provider → M4 fetch/M5 derive for capture → bounded selection) **and** the existing `run{Capture,Settlement}Batch` processing. Both already run inside `runWithLock`'s callback; `discover` is inserted as the first statement of that callback.

**Wrapper structure (no logic in the route):** add an optional `discover?: (deps, ctx) => Promise<{ candidates, diagnostics }>` to the two job options. Inside the `runWithLock` callback: `const produced = options?.discover ? await options.discover(deps, ctx) : { candidates: options?.candidates ?? [], diagnostics: null }`. This keeps discovery inside the lock, preserves the empty-pass default and the test injection path (`candidates`/`deps`), and adds no route logic. Two overlapping fires cannot both discover/derive/process: the second gets `null` from the lock → `skipped` (no wasted provider spend, no TOCTOU archive-state drift). ✅ INV-L satisfied.

**`evalInstant` (the one permitted clock read):** taken once at the top of the `runWithLock` callback (inside the lock) and threaded into `discover` for eligibility timing (window-open test) and `nowSec` (lifecycle). It is a *decision* input, never an identity input: `capturedAt`/`captureId`/`snapshotId` derive from **kickoff** (not evalInstant), and `completionInstant` derives from **kickoff** — so the archive stays byte-stable and replay-safe (verified: Stage 1 computes `capturedAt` from `(kickoff, leadMinutes)` only; `nowSec` feeds `resolveMatchLifecycle` which is status-driven for the terminal fixtures we act on).

---

## 7. Capture Archive-State Normalization

**Goal:** build the Stage 1 `CaptureArchiveState { capturedWindowKeys: Set<string>, partialWindowKeys?: Set<string> }` (window-key shape `"<fixtureId>|<capturedAt>"`) for the discovered fixture set, from the durable stores, distinguishing the six required states.

**Reuse (no new readers):**
- `evidenceStore.listSnapshots(fixtureId, { limit })` and/or `latestSnapshot` — `store.ts:50,62` (file adapter is strict-read, §9).
- `oddsStore.listByCapture(captureId)` — `odds-archive/store.ts:30`.
- `captureIdentityFromSnapshot(snapshot)` → `{ captureId, captureWindowKey }` — `mandatory-odds.ts:48` (the frozen `"<fixtureId>|<capturedAt>"` key + captureId).
- `isEvidenceCaptureRecord(record)` — `odds-archive/index.ts:16` (identifies the mandatory `evidence_capture` odds record among a capture's odds).

**Per-fixture derivation (for each discovered fixtureId):**

| Archive observation | Normalized state | Placement |
|---|---|---|
| no snapshot for `(fixtureId, capturedAt, capturedBy="evidence_capture")` | **no record** | window in neither set → provider may capture |
| snapshot exists **and** ≥1 `evidence_capture` odds record present for its `captureId` (per supported market) | **complete pair** | `capturedWindowKeys` → provider `already_captured` |
| snapshot exists **and** zero mandatory odds records | **snapshot-only partial** | `partialWindowKeys` → provider re-emits `healing:true` |
| a mandatory odds record exists but no snapshot for the window | **odds-only partial** | treat as **no snapshot** → provider may capture; the odds append is idempotent (`duplicate`) — never a duplicate mint |
| duplicate snapshots / duplicate odds (same id+hash) | **duplicate complete** | collapse to complete (`(id,contentHash)` idempotency); window in `capturedWindowKeys` |
| snapshot id present with **divergent** content / read error / chain break | **corrupt/conflicting** | **fail closed** — do not classify the fixture; defer + alert (§9); never treat as "no record" (would risk a duplicate mint) |

**Complete-vs-partial rule (precise):** a window is `capturedWindowKeys` iff a snapshot exists **and** the mandatory odds records for its `captureId` cover its `supportedMarkets` (C5 completeness). Otherwise, if the snapshot exists but odds are incomplete, it is `partialWindowKeys` (heal). The check ordering in Stage 1 (`capturedWindowKeys` before `partialWindowKeys`) guarantees a complete pair is never re-healed.

**Scaling note:** the store interface is per-fixture, so derivation is O(F) store calls bounded by the discovered set. On the file adapter each call is O(A); a bounded discovered set (≤ cap after eligibility) keeps this within the deadline budget (§13). A future single-bounded-read helper (read the file once, index in memory) is an optimization, not required for Stage 2.

---

## 8. Settlement Archive-State Normalization

**Goal:** build Stage 1 `SettlementArchiveState { capturedFixtureIds: Set<number>, settledFixtureIds: Set<number> }` for the completed fixture set.

**Reuse:** `evidenceStore.latestSnapshot(fixtureId)` (is there something to settle?); `evidenceStore.listValidations(fixtureId)` — `store.ts:56`; `currentValidationRevisions(records)` → `Map<validationId, ValidationRecord>` (highest revision per logical validation) — `validation/records.ts:264`; optionally `verifyValidationChain` — `validation/integrity.ts:43` (out-of-band sweep, not inline per request).

| Archive observation | Normalized state | Placement |
|---|---|---|
| latest snapshot exists, no terminal validation yet | **captured pending prediction** | `capturedFixtureIds` (not in `settledFixtureIds`) → eligible |
| latest snapshot's markets all have a current **terminal** validation revision | **already-settled** | `settledFixtureIds` → provider `already_settled` |
| per-market `validationId` / `revisionId` | **validation identity** | derived by `currentValidationRevisions`; used only to decide settled-or-not (Stage 2 minimum) |
| duplicate validation line (same revisionId+hash) | **duplicate validation** | idempotent no-op; does not change settled-ness |
| current terminal outcome **differs** from the now-observed lifecycle/scores | **correction/revision needed** | **Stage 2: NOT represented** — deferred (§12). The coarse `settledFixtureIds` marks it settled → skipped. |
| divergent content / read error / chain break / malformed line | **corrupt/conflicting** | **fail closed** — `archiveStateOk` false → Stage 1 rejects every row `corrupt_archive_state` (already implemented, `settlement-provider.ts:90-95`); Stage 2 additionally defers + alerts on a read throw |

**Stage 2 minimum (safe):** `settledFixtureIds` = fixtures whose latest snapshot already carries a current terminal validation for its scored markets. This settles first-time won/lost **and** the lifecycle-terminal (postponed/cancelled/abandoned) predictions Stage 1 now emits, and skips already-settled — correct, no false result. Corrections (re-settling a changed outcome) are §12-deferred.

---

## 9. Strict-Read and Failure Semantics

**Verified current strict reads (must be preserved, never weakened):** the evidence file adapter `readNdjson` (`lib/archive/evidence/file.ts`) returns `[]` **only** for `ENOENT`; it **throws** on malformed NDJSON, `EACCES`/`EPERM`, `EIO`/`EBUSY`/`ENXIO`/`ENODEV`, and any other error — never a partial or empty-on-error read (M9 G6). The durable lock **fails closed in production** with no memory fallback for evidence jobs (`locks.ts:39-41`).

**Stage 2 obligations:**
- Archive-state derivation calls the store readers, which **throw** on corruption. Stage 2 MUST let that throw **fail the run** for the affected fixture (defer + surface `failed`/alert), never `catch → treat as empty history` (that would risk a duplicate mint on capture or a false "pending" on settlement). A `try/catch` around a per-fixture derivation that swallows and continues **is forbidden**; a `try/catch` that classifies a fixture as `corrupt/deferred` and re-throws/aborts the fixture (not the whole run silently) is acceptable, provided the corruption is **counted and alertable**, never converted to a clean state.
- **ENOENT-as-empty is allowed only where the contract already allows it** (a fresh archive with no file yet → empty history → the fixture is "no record" → capture proceeds). This is the same semantics M6 relies on and is safe (a genuinely empty archive cannot hide an existing record).
- No production memory fallback: Stage 2 uses `getEvidenceArchiveStore()`/`getOddsArchiveStore()` (the file adapter by default); it must not substitute an in-memory store in production.
- M4 provider-fetch failures are **not** archive reads — they defer the fixture (`not_admitted`), never persist evidence (contract §5.13); the provider/odds archive readers are already fail-closed.

---

## 10. Candidate-to-Runner Adapter Boundaries

**Capture:** Stage 1 `buildCaptureCandidates` returns `CaptureRequest[]` — **exactly** the type `runCaptureBatch(deps, candidates)` consumes (verified: `capture-run.ts:89` `readonly CaptureRequest[]`; Stage 1 re-exports the frozen `CaptureRequest`). **No adapter required** — the arrays pass through unchanged. Any need to translate fields here would signal a Stage 1 contract defect; none exists (Stage 1 review §5 confirmed field-validity + typecheck).

**Settlement:** Stage 1 `buildSettlementCandidates` returns `SettlementCandidate[]` — **exactly** what `runSettlementBatch(deps, candidates)` consumes (`settlement-run.ts:34`). **No adapter required.**

**The only new "adapter" is the injected derivation dependency** `deriveCaptureInput` (Stage 1's `CaptureProviderDeps`) — this is **not** a candidate translator but the **M4-fetch + M5-derive implementation** Stage 1 deliberately left injectable. It is a *narrow, well-specified* adapter (§16 `derive-adapter.ts`): input `CaptureDeriveRequest { fixtureId, kickoffAt, capturedAt, leagueCode, competitionLabel, markets, healing }`, output `{ ok:true, modelInput: FixtureModelInput, ...provenance } | { ok:false, reason }`. It must: (a) run M4 `buildFetchPlan`→`orchestrateFetches`→`admitProviderArchive` under the M0 config, (b) run M5 `deriveEvidenceModel(FixtureModelInput)`, (c) return `modelInput.fixtureId === request.fixtureId`, (d) **reuse `request.capturedAt` verbatim** (never recompute/clock it), (e) map M4/M5 failures to the exact Stage 1 reason keys (`not_admitted`/`invalid_odds`/`missing_odds`/`no_scorable_markets`). No semantic translation of identity occurs — the adapter supplies the derivation *body*, not any identity coordinate.

---

## 11. Completion-Instant Source

**Available `FootyMatchRow` fields (verified `lib/footystats/types.ts`):** `kickoff: string` (ISO), `kickoffTime: number` (unix), `status: string`, `isFinished`, scores, `listResult?`. **There is no terminal/updated/result timestamp on the row.** (`fetchedAt` exists on the daily-archive/observation wrapper, not on the settlement row, and is an *observation* time — non-deterministic across re-fetch.)

**Authority/determinism ranking for `completionInstant`:**

| Rank | Source | Authority | Determinism | Verdict |
|---|---|---|---|---|
| 1 | true provider terminal timestamp | highest | deterministic if source-stable | **NOT AVAILABLE** on `FootyMatchRow` |
| 2 | provider status/result timestamp | high | deterministic if present | **NOT AVAILABLE** |
| 3 | **canonical kickoff (`kickoff` / `ISO(kickoffTime)`)** | moderate (a fixed, source-stable anchor) | **fully deterministic** | **USE — Stage 1 default; keep** |
| 4 | daily-archive `fetchedAt` (observation time) | low | **non-deterministic** across re-fetch | **FORBIDDEN** as completionInstant |
| 5 | current wall-clock | n/a | **non-deterministic** | **FORBIDDEN** (breaks idempotency/replay) |

**Stage 2 decision:** keep the Stage 1 default `deriveCompletionInstant = ISO(row.kickoff)` (deterministic, source-stable → `recordedAt=settledAt` byte-stable → M8 `no_change` on re-fire). It affects the validation `contentHash` but **not** identity (`validationId`/`revisionId` exclude it) nor the won/lost outcome. It is imprecise (settledAt=kickoff) but never violates a chain invariant (`settledAt=kickoff > capturedAt`). **A more precise terminal instant is impossible without a new upstream field** — record that as a future upstream enhancement; do **not** introduce any current-time fallback.

---

## 12. Correction/Revision Boundary

**Verified M8 correction path:** `settleSnapshot` writes a correction **only** when the current head outcome differs (`head.state !== outcome.state`) **and** an explicit typed `correctionCause` is supplied (`settlement.ts:299-323`); otherwise unchanged → `no_change`; missing `correctionCause` on a change → `invalid_input` (no write). Corrections are revision-aware and idempotent.

**Does Stage 2 need corrections now?** **No — defer to a later M10 stage.** Rationale: (a) driving a correction requires the *settled-to-what-outcome* archive state that Stage 1's `SettlementArchiveState` intentionally does not carry (Stage 1 review §16), and deciding **why** a result changed (`result_reinterpreted` vs `source_lineage_changed`) is a genuine product/data-lineage decision, not mechanical wiring; (b) omitting corrections is **fail-safe** — the first settlement stands and is correct; only a *later provider correction* is not propagated, which is a completeness gap, not a false result.

**Minimum safe Stage 2 behaviour:** first-settle only. `settledFixtureIds` marks any fixture with a current terminal validation as settled → Stage 1 skips it (`already_settled`) → Stage 2 never supplies `correctionCause` → M8 never sees a change → no `invalid_input`. This is correct and idempotent. **Document the deferred correction path explicitly** (a Stage 3 item): enrich `SettlementArchiveState` with per-market current outcome, emit an `already_settled`-but-changed candidate, and set the typed `correctionCause`.

---

## 13. Deadline and Batch Budget

**Verified numbers:** route `maxDuration = 60` (both routes); `DEFAULT_RUN_DEADLINE_MS = 300_000` (`config.ts:153`) — **5× the route budget**, must not be the authoritative web-cron deadline (BF-1); `DEFAULT_CAPTURE_MAX_FIXTURES = 500` (`config.ts:40`) — over budget, must not be the effective ceiling (BF-3); settlement has no cap today. M4 config carries `runDeadlineMs`, `globalConcurrency`, `footystatsConcurrency`, `requestBudget`, `maxSourceAgeMs`.

**Budget map (one route invocation, under the lock):**

| Phase | Bound | Stage 2 control |
|---|---|---|
| route | `maxDuration = 60_000 ms` | fixed platform ceiling |
| effective job deadline (INV-D) | `min(configuredRunDeadlineMs, 60_000 − 15_000) ≤ 45_000 ms` | **new** clamp helper; 300 s clamped, never honoured on web-cron |
| lock acquisition | ≤ ~1 s try-window | `locks.ts` (existing) |
| source fetch (M4) | `globalConcurrency` 4 / `footystatsConcurrency` 2 / `requestBudget` / `orchestrateFetches` deadline | pass the **clamped** deadline (not 300 s) into `orchestrateFetches`'s `Clock`/budget |
| archive read | O(F) per-fixture strict reads, F ≤ effective cap | bounded by cap |
| processing (M6/M8 write) | ~capture steeper curve; settlement ~85–97 ms/fixture | bounded by cap |
| diagnostics / serialization | small fixed | bounded |

**Proposed initial caps (spec-consistent):**
- **Capture:** default **100**, hard max **150** — `effectiveCaptureCeiling = clamp(configured, 1, 150)`; invalid/zero/negative/>150 → 100/150 (Stage 1 `normalizeBatchLimit` already does this; Stage 2 passes `config.maxCandidates` = clamped value, **never** the 500 default).
- **Settlement:** default **100**, hard max **150** — symmetric `clamp(configured, 1, 150)`.
- **Effective deadline:** initial target **≤ 45_000 ms** (`ROUTE_BUDGET 60_000 − RESERVED 15_000`), passed into M4 fetch and used by an optional mid-batch guard.

**INV-D enforcement (two layers):** (1) **primary** — the cap bounds total work to a benchmarked <45 s on the file adapter (Stage 4 benchmark B5 confirms); (2) **defence-in-depth** — an **optional, additive** `deadline?: () => number` (remaining-ms) parameter on `runCaptureBatch`/`runSettlementBatch` (M9 orchestrators, **not** frozen M6/M8 core): before starting each candidate, if remaining < a conservative per-candidate estimate, **break** and count the rest `deferred_by_deadline`. This keeps `captureEvidenceSnapshot`/`settleSnapshot` frozen. Deferring is safe/deterministic (INV-A); overrunning the route is not.

---

## 14. Diagnostics Integration

**Current:** the runner returns `resultCounts: Record<string, number>` = the batch counts and calls `emitOutcomeMetrics(job, counts)` → one `evidence_job_outcome_total{job,outcome}` per non-zero outcome (`runner.ts:265-273`); `getEvidenceJobDiagnostics` surfaces the last run's `resultCounts` + freshness (`diagnostics.ts:59`).

**Stage 2 merge:** combine the Stage 1 provider `CandidateDiagnostics` with the batch counts into one flat, low-cardinality `resultCounts`:

| Field | Source | Label form |
|---|---|---|
| discovered | provider `sourceRowsDiscovered` | `discovered` |
| malformed | provider `sourceRowsMalformed` | `malformed` |
| eligible | provider `candidatesEligible` | `eligible` |
| rejected by reason | provider `candidatesRejectedByReason` (bounded set) | **flatten** → `rejected_<reason>` (one per closed key) |
| selected | provider `candidatesSelected` | `selected` |
| deferred by cap | provider `candidatesDeferredByCap` | `deferred_by_cap` |
| deferred by deadline | batch guard (§13) | `deferred_by_deadline` |
| processed | batch (captured+duplicate / settled+noChange+…) | `processed` |
| failed | batch `writeFailed` + `immutableViolation` | `write_failed` / `immutable_violation` |
| backlog | provider `backlogSize` | `backlog` |
| oldest pending age | provider `oldestPendingAgeMs` | `oldest_pending_age_ms` (gauge in diagnostics, not a metric label) |
| lock contention | runner `skipped`/`lock_unavailable` (existing) | existing counter |
| — | **never** `fixtureId`/`matchId`/`captureId`/`predictionId` as a label | forbidden (bounded cardinality) |

**Rules:** flatten the nested reason map to `rejected_<reason>` using the **closed** vocabularies (`CAPTURE_REJECTION_REASONS`/`SETTLEMENT_REJECTION_REASONS`) — cardinality is fixed and predefined. `emitOutcomeMetrics` continues to label only `{job, outcome}`. Diagnostics is **best-effort**: a diagnostics failure must never fail the job (wrap emission; on error, log and continue). Chain-verify (`verifyEvidenceChain`/`verifyValidationChain`) stays an **out-of-band scheduled sweep**, never inline per request.

---

## 15. No-Cursor Proof (INV-A)

The design persists **no** progress state:
- **Discovery** is a pure function of `(source-for-date, archive-state-derived-from-stores, evalInstant, config)`. The date is `dateFrom(evalInstant)` (deterministic from the single clock read); the archive state is recomputed from the immutable stores every run.
- **Progress = what the archive already contains.** `capturedWindowKeys`/`settledFixtureIds` are derived each run from `listSnapshots`/`listByCapture`/`listValidations` — never stored between runs.
- **Deferred candidates carry no state** — a deferred (by cap or deadline) fixture is simply re-derived next run and, once earlier windows drain, selected (deterministic ordering, INV-S). No "advancement" marks a candidate consumed without processing; consumed-ness is defined solely by its archive presence.
- **No** process-local cursor (only ephemeral, non-authoritative last-run diagnostics counts, reset on restart — already the pattern), **no** filesystem offset, **no** NDJSON line pointer (identity is content/coordinate-derived), **no** request-supplied cursor (the cron request carries no page/offset the producer trusts), **no** database cursor (the durable lock DB stores a lock, never a record/cursor).
- **Restart / multi-worker safe:** any worker re-derives identical pending work from the same immutable archive; the lock serialises writers; idempotency (`already_exists`/`no_change`) makes concurrent/repeated work safe. Verified: a repo-wide grep for cursor/checkpoint/offset state under `lib/evidence-capture`, `lib/jobs`, `lib/archive/evidence` returns nothing (architecture review §4/§14) — Stage 2 adds none.

**Conclusion:** the immutable archive remains the **sole** authoritative checkpoint. ∎

---

## 16. Exact File Change Plan

| File | Action | Purpose | Expected symbols | Risk | Shared cap/settle? | Tests required |
|---|---|---|---|---|---|---|
| `lib/evidence-capture/candidates/discovery.ts` | **create** | Locked-discovery orchestration: source load → archive-state derive → Stage 1 provider → bounded `{candidates, diagnostics}` | `discoverCaptureCandidates(deps, ctx)`, `discoverSettlementCandidates(deps, ctx)`, `DiscoveryContext` | **med** | both (two fns) | unit: source→provider wiring, bounded, deterministic, fail-closed on read throw |
| `lib/evidence-capture/candidates/archive-state.ts` | **create** | Derive normalized `CaptureArchiveState`/`SettlementArchiveState` from stores (strict reads) | `deriveCaptureArchiveState(evidenceStore, oddsStore, fixtureIds)`, `deriveSettlementArchiveState(evidenceStore, fixtureIds)` | **med** | both | unit: all six/ five states incl. corrupt→fail-closed; reuse of `captureIdentityFromSnapshot`/`currentValidationRevisions` |
| `lib/evidence-capture/candidates/derive-adapter.ts` | **create** | Implement Stage 1's injected `deriveCaptureInput` = M4 fetch/admission + M5 derive; reuse `capturedAt`; map failures to reason keys | `createCaptureDeriveInput(deps, config): CaptureProviderDeps["deriveCaptureInput"]` | **high** | capture only | unit (stubbed fetcher): fixtureId match, capturedAt-reuse, failure→reason mapping, no clock |
| `lib/evidence-capture/candidates/deadline.ts` | **create** | Effective-deadline clamp (INV-D) + remaining-ms checker | `effectiveJobDeadlineMs(config, evalMs)`, `remainingMs(...)` | low | both | unit: 300 s clamped to ≤45 s; invalid→safe |
| `lib/evidence-capture/candidates/wiring.ts` | **create** | Pre-wired live jobs so routes stay one-liners (compose discovery + runner) | `runLiveCaptureJob()`, `runLiveSettlementJob()` | low | both | integration (Gate B) |
| `lib/jobs/runner.ts` | **modify** | Add optional `discover?` to the two job options; invoke inside `runWithLock`; take `evalInstant` once; merge provider diag into `resultCounts` | extend `runEvidenceCaptureJob`/`runPredictionSettlementJob` options | **high** | both | unit: discover-inside-lock, empty-pass preserved, merged counts |
| `lib/evidence-capture/jobs/capture-run.ts` | **modify** | Optional `deadline` guard param → mid-batch `deferred_by_deadline`; add `deferredByDeadline` count (additive) | `runCaptureBatch(deps, candidates, opts?)` | med | capture | unit: deadline defer counted, M6 untouched |
| `lib/evidence-capture/jobs/settlement-run.ts` | **modify** | Symmetric optional `deadline` guard + count | `runSettlementBatch(deps, candidates, opts?)` | med | settlement | unit: symmetric |
| `app/api/internal/cron/evidence-capture/route.ts` | **modify** | One-line: `runLiveCaptureJob()` instead of `runEvidenceCaptureJob()` (no business logic) | `POST` | low | capture | integration (auth/flag/lock/empty unchanged) |
| `app/api/internal/cron/prediction-settlement/route.ts` | **modify** | One-line: `runLiveSettlementJob()` | `POST` | low | settlement | integration |
| `lib/jobs/diagnostics.ts` | **modify (optional)** | Surface the new flattened producer counts if additional fields are wanted | `getEvidenceJobDiagnostics` | low | both | unit (if changed) |
| `tests/evidenceCandidateDiscovery.test.ts` | **create** | Gate-A/B for discovery + archive-state + adapter + deadline | — | — | both | the tests in §17 |

**No change to:** `types/evidence/*`, `EvidenceArchiveStore`/`OddsArchiveStore` interfaces, `capture.ts`/`settlement.ts`/`outcomes.ts` (frozen M6/M8), `mandatory-odds.ts`, `identity.ts`, `model/derive.ts` math, `locks.ts`, `cronHandler.ts`, feature-flag defaults, archive formats, `config.ts` defaults (Stage 2 *clamps* at the call site; it does not edit the 500/300 000 defaults). Postgres, schedules, env, deploy: untouched.

---

## 17. Required Tests

**Gate A (offline/deterministic):**
- `deriveCaptureArchiveState`/`deriveSettlementArchiveState`: each of the six/five states incl. **corrupt → fail-closed** (read throw not swallowed); window-key shape matches `captureIdentityFromSnapshot`.
- `discover*` determinism: same `(seeded source, seeded stores, evalInstant)` → byte-identical candidate arrays; shuffled source rows → identical output.
- `derive-adapter`: `modelInput.fixtureId === request.fixtureId`; `capturedAt` reused verbatim; M4/M5 failure → correct Stage 1 reason key; **no clock/random** in the adapter path.
- `deadline`: 300 000 clamped to ≤45 000; invalid config → safe bounded value.
- ceiling: discovered > cap → selected = cap, remainder `deferred_by_cap` counted.
- **A4 replay:** the M7 serialization-boundary replay test extended over M10-discovered captures (byte-identical Evidence Inputs + `contentHash` under the original `modelVersion`).
- determinism guard: no `Date.now`/`Math.random` under `candidates/` except the single evalInstant read in the runner.

**Gate B (integration, flags-on in-test, stubbed fetch + seeded archive):**
- B1 end-to-end capture: N eligible → N snapshots each with one mandatory odds record; idempotent re-fire (no duplicates).
- B2 end-to-end settlement: completed + lifecycle-terminal fixtures settle to correct states; re-fire `no_change`.
- B3 empty/again-safe: no eligible → `succeeded` zero-count (M9 baseline preserved); all-already-captured → no writes.
- B4 failure: injected transient fetch → `not_admitted` deferred (no evidence); injected `write_failed` → `failed`; **corrupt archive line → read throw surfaced, fixture deferred, no duplicate mint**.
- B5 budget benchmark: run at the cap against representative archive depth completes < 45 s (< 60 s route).
- B6 multi-worker overlap: two concurrent fires → one runs, other 409; no duplicate mint / no divergent backlog.
- B7 crash/replay: interrupt after N of M → re-fire completes remainder from archive, no duplicates, no permanent skip.

---

## 18. Risks and Open Questions

| # | Risk / question | Disposition |
|---|---|---|
| R1 | Runner option change (`discover`) touches M9 code | Additive + backward-compatible (empty-pass + `candidates` path preserved); covered by B3 |
| R2 | O(F) per-fixture archive reads on the file adapter | Bounded by cap (≤150) + deadline guard; single-bounded-read is a later optimization |
| R3 | Adding `deadline` param to the batch orchestrators | They are M9 orchestrators (not frozen M6/M8); additive optional param; frozen `captureEvidenceSnapshot`/`settleSnapshot` untouched |
| R4 | `evalInstant` clock read | Permitted (one read, eligibility-only); proven not to enter any identity/hashed field (§6) |
| R5 | Corrections deferred | Fail-safe (first settlement stands); explicitly Stage 3 (§12) |
| R6 | completionInstant precision | Kickoff is the only deterministic source; a precise terminal instant needs a new upstream field (§11) — future |
| R7 | H-1 unlock-500 (PG path) | Land the swallow/log fix opportunistically (carry-forward, low severity) |
| Q1 | `dateFrom(evalInstant)` — single day vs day-boundary windows near midnight UTC | Recommend: discover the current UTC date; a fixture whose window opens just before midnight is handled by frequent cadence; document, don't special-case in Stage 2 |
| Q2 | Should `discover` live in the runner default or be injected by the route/wiring | **Injected via `wiring.ts`** so the runner stays discovery-agnostic and unit-testable without fetch/network |

No open question is a blocker; each has a safe default.

---

## 19. Stage 2 Entry Conditions

- **Stage 1 APPROVED** ✅ (`m10-stage-1-candidate-provider-implementation-review.md` §0/§23; BF-S1 resolved; 1735/1735).
- Spec Rev A1 amendments closed (BF-1…BF-4 → INV-C/D/L/S/A) ✅.
- Consumer substrate present & green: routes, runners, `runWithLock` durable/fail-closed, stores (strict reads), M4 routing, M5 derivation, diagnostics ✅.
- No frozen-contract change required by this plan ✅.

## 20. Implementation Recommendation

Implement in this order, each independently green and default-off:
1. `deadline.ts` + `archive-state.ts` (pure; Gate-A tested) — lowest risk, no wiring.
2. `derive-adapter.ts` (M4+M5 behind the Stage 1 dep; stubbed-fetch Gate-A).
3. `discovery.ts` (compose source + archive-state + provider; bounded; Gate-A).
4. `runner.ts` `discover` seam + batch `deadline` params (additive; unit).
5. `wiring.ts` + the two one-line route edits (Gate-B integration B1–B7).
6. A4 replay test + B5 benchmark; then the Stage 2 review + closure-stub update.

Keep flags **default-off** throughout; activation stays operational. Corrections (§12), single-bounded-read (R2), and precise completionInstant (R6) are explicitly **later** stages.

---

## 21. Statement on this Plan

Planning only. The **only** file created is this document. No runtime code, tests, contracts, feature flags, cron routes, runners, schedules, environment, database, archive, or deployment configuration was modified. All cited types, functions, config values, and `file:line` references were read from the current repository so an implementer can verify them. Stage 2 remains unbuilt; this document defines its architecture and integration.

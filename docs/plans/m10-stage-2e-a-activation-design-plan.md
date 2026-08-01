# M10 Stage 2E-A — Activation Design Plan (Design & Plan Only)

**Document type:** Activation architecture & plan (Stage 2E-A of M10). **DESIGN-ONLY — no runtime code, test, route, flag, config, reader, cron, migration, or deployment was created or modified.** The only file created is this document.
**Milestone:** Sprint 23B — M10 (Live Candidate Pipeline), **Stage 2E-A — Activation Design**.
**Date:** 2026-07-30
**Governing spec:** `docs/architecture/m10-live-candidate-pipeline-specification.md` (Rev A1) — §7 (INV-A/C/D/L/S), §10 (observability), §12 (DoD gates).
**Authorization:** Stage 2E preparation & planning is authorized; **Stage 2E production activation is NOT authorized.** This plan authorizes only its own independent review.

---

## 1. Executive Summary

The M10 live-candidate pipeline is **built and dormant** through Stage 2D. Capture (Stage 2B) and settlement (Stage 2C) discovery run inside the durable job lock; Stage 2D added the operational envelope (≤45 s deadline, between-candidate guard, ceilings 100/150, bounded diagnostics, typed producer errors, backlog/oldest-pending metrics, dormant completed-rows loader with whole-source + per-row isolation). Nothing composes the producer into a route, no live source reader is wired, and no flag is enabled.

Stage 2E-A designs — **without implementing** — the exact, fail-closed, reversible path from that dormant state to production writes: activation topology, a bounded flag/mode hierarchy, a production completed-fixture-row reader over the **existing** daily-archive surface, testable route composition outside the handlers, the single-writer/lock model, route-budget composition, dry-run/canary/full modes, kill switches, rollback, a failure-mode matrix, bounded observability, the Stage-2E-B benchmark contract, activation gates, a go/no-go matrix, a test plan, and minimal implementation slices.

**Central finding — the activation is not blocked.** An authoritative completed-fixture source **exists** (`readDailyArchive(date)` → per-date JSON, `FootyMatchRow`-shaped rows with status/scores) and its format is fully understood, so no frozen-contract, schema, or migration change is required. Three bounded design dependencies are identified and specified (not fabricated): a **strict** daily-archive read wrapper (the current `readDailyArchive` is fail-open — §9), **route-start deadline anchoring** so source-load+discovery are charged to the ≤45 s budget (§12), and a **dry-run composition** that runs discovery but never invokes the frozen write batch (§13). Each has a defined interface, owner, and acceptance criteria.

**Final decision: STAGE 2E-A PLAN READY FOR INDEPENDENT REVIEW.**

## 2. Current State (repository-grounded)

| Surface | Symbol / file | Current behaviour |
|---|---|---|
| Capture route | `app/api/internal/cron/evidence-capture/route.ts` | `handleCronPost(req, () => runEvidenceCaptureJob())` — bare, dormant; `maxDuration = 60` |
| Settlement route | `app/api/internal/cron/prediction-settlement/route.ts` | `handleCronPost(req, () => runPredictionSettlementJob())` — bare, dormant; `maxDuration = 60` |
| Cron access | `lib/security/cronAccess.ts` `evaluateCronAccess` | `ENABLE_CRON` + `x-cron-secret == CRON_SECRET/INTERNAL_CRON_SECRET`; rate-limit 6/60 s (`cronHandler.ts`) |
| Capture job | `lib/jobs/runner.ts:runEvidenceCaptureJob` | flag gate `isCaptureEnabled` → `runWithLock("evidence_capture")` → `runCaptureBatch`; seams `candidates`/`provideCandidates`/`provideCandidateBatch`/`now` (Stage 2B/2D) |
| Settlement job | `lib/jobs/runner.ts:runPredictionSettlementJob` | symmetric; `runWithLock("prediction_settlement")` → `runSettlementBatch` |
| Batch guards | `capture-run.ts:runCaptureBatch`, `settlement-run.ts:runSettlementBatch` | optional `deadline?` between-candidate guard; frozen M6/M8 inner calls untouched |
| Producer (capture) | `candidates/capture-pipeline.ts:produceCaptureRequests` + `createFileCaptureReadPort` | reads source + archive-state, returns `{candidates, diagnostics}`; derivation `deriveCaptureInput` an injected seam (M4/M5 unbuilt) |
| Producer (settlement) | `candidates/settlement-pipeline.ts:produceSettlementRequests` + `createFileSettlementReadPort` | reads `loadCompletedRows` + archive-state, returns `{candidates, diagnostics}`; `loadCompletedRows` a required injected seam (no live default) |
| Loader | `candidates/completed-rows.ts:filterCompletedRows` + `createCompletedRowLoader` | pure terminal filter + fail-closed factory over an injected `readRows`; **not wired** |
| Operational | `candidates/operational.ts` | deadline/guard/ceiling/`ProducerError`/reconcile/flatten/`emitProducerMetrics` |
| Config | `lib/evidence-capture/config.ts` | `EVIDENCE_CAPTURE_ENABLED`/`EVIDENCE_SETTLEMENT_ENABLED` (readFlag), `resolveEvidenceOperationalConfig`, `EVIDENCE_ARCHIVE_ADAPTER`, `EVIDENCE_DATABASE_URL`, `EVIDENCE_RUN_DEADLINE_MS` |
| Lock | `lib/jobs/locks.ts:tryAcquireJobLock` | PG advisory lock (`advisoryLockKey` int4) bound to `EVIDENCE_DATABASE_URL`; **fail-closed in production** (`requireDurable && NODE_ENV==="production"` + no URL → `null`); memory fallback only non-prod / `JOB_LOCK_ADAPTER=memory` |
| Source | `lib/footystats/dailyArchive.ts:readDailyArchive(date)` | `data/daily-archives/<date>.json` → `DailyArchive { fh, over15, over25, sh: ArchivedRow[] }`, `ArchivedRow = FootyMatchRow & { listResult }`; **fail-open** (`catch → null`) |
| Metrics | `lib/observability/metrics.ts` | `increment`/`gauge`/`timing`, `safeRun`, `sanitizeLabels` (64-char cap, sensitive-label drop) |
| Job diagnostics | `lib/jobs/diagnostics.ts:getEvidenceJobDiagnostics` | process-local `jobLog` (bounded 500, reset on restart), last status/error/`resultCounts` |
| Deployment | `deploy/ecosystem.rankwagers.cjs` | `instances: 1`, `exec_mode: "fork"`, `kill_timeout: 10000`; `instrumentation.ts` registers **no** SIGTERM drain |

## 3. Stage 2E-A Objective

Deliver an implementation-ready activation design that connects the dormant pipeline to production **safely, reversibly, and fail-closed**, preserving every Stage-2D guarantee and every frozen boundary, and gating each step behind explicit human go/no-go and Stage-2E-B benchmark evidence.

## 4. Explicit Non-Goals

Not designed to be done in Stage 2E-A (and not authorized): enabling any flag; wiring the production reader; activating any cron; running the Stage-2E-B benchmark; corrections / `currentValidationHeads` / `correctionCause`; any `ValidationRecord`/`EvidenceSnapshot`/archive-format/identity/hash/`settledAt`/M6/M8 change; any migration; any deployment/infrastructure change. This plan produces **only** this document.

## 5. Repository Inventory (activation-relevant, verified)

Files this plan reasons about (all cited above): the two routes; `runner.ts`; `capture-run.ts`/`settlement-run.ts`; `candidates/{capture-pipeline,settlement-pipeline,completed-rows,operational,capture-provider,settlement-provider}.ts`; `config.ts`; `locks.ts`; `cronHandler.ts`; `cronAccess.ts`; `metrics.ts`; `jobs/diagnostics.ts`; `footystats/{dailyArchive,types,listSettle}.ts`; `deploy/ecosystem.rankwagers.cjs`; `instrumentation.ts`. No Postgres evidence adapter exists (evidence archive is NDJSON file; `EVIDENCE_ARCHIVE_ADAPTER=postgres` is selectable-but-unimplemented — out of scope).

## 6. Activation Topology

**Two independent routes, two independent durable locks, independently activatable and rollback-able.**

- **Capture:** `POST /api/internal/cron/evidence-capture` → `runEvidenceCaptureJob({ provideCandidateBatch, now })` → lock `job:evidence_capture` → `runCaptureBatch` → frozen `captureEvidenceSnapshot` + `ensureMandatoryCaptureOdds` → NDJSON `snapshots.ndjson` + `odds-archive/records.ndjson`.
- **Settlement:** `POST /api/internal/cron/prediction-settlement` → `runPredictionSettlementJob({ provideCandidateBatch, now })` → lock `job:prediction_settlement` → `runSettlementBatch` → frozen `settleLatestSnapshotForFixture` → `validations.ndjson`.

**Concurrency.** Distinct lock keys → capture and settlement **may overlap** safely: they write **disjoint** targets (capture: snapshots+odds; settlement: validations); settlement only **reads** snapshots (under its own lock, re-reading the head at settle time — no TOCTOU). No shared write target ⇒ no cross-path corruption. They do **not** share a source loader (capture: daily-list predictions via `loadPublishedDailyPredictions`; settlement: completed rows via the new reader), do **not** share an evaluation instant (each run injects its own), and are **independently disableable**.

**Data (not code) dependency & ordering.** Settlement can only settle fixtures that already have snapshots; therefore **settlement activation SHOULD LAG capture activation** by enough capture history to be meaningful (a data-driven ordering, §22 — evidenced by `settledFixtureIds`/`capturedFixtureIds` growth, not a code coupling). Neither route depends on the other's code. Preference: **independent activation and rollback** per path.

**Shared archive reads.** Both read the same evidence NDJSON archive via the strict whole-archive readers (`readAllSnapshotsStrict`/`readAllValidationsStrict`/`readAllOddsRecordsStrict`) — one bounded read per store per run (PB-1), under the respective lock.

## 7. Feature-Flag Hierarchy

Bounded, explicit, all default **OFF**, resolved once per run into an immutable snapshot. Reuses `readFlag` semantics (`"true"`/`"1"` case-insensitive; else off).

| Flag / knob | Type | Default | Role | Owner |
|---|---|---|---|---|
| `EVIDENCE_M10_LIVE_ENABLED` | flag | off | **Master.** Off ⇒ all routes stay the dormant bare pass (no discovery, no reader, no writes). | Platform |
| `EVIDENCE_CAPTURE_ENABLED` (existing) | flag | off | Capture **write** gate (unchanged M9 semantics: off ⇒ `flagSkippedJob` before the lock). | Platform |
| `EVIDENCE_SETTLEMENT_ENABLED` (existing) | flag | off | Settlement **write** gate (unchanged). | Platform |
| `EVIDENCE_CAPTURE_MODE` | enum `off\|dry_run\|canary\|full` | `off` | Per-path activation mode (§8). | Platform |
| `EVIDENCE_SETTLEMENT_MODE` | enum `off\|dry_run\|canary\|full` | `off` | Per-path activation mode. | Platform |
| `EVIDENCE_COMPLETED_SOURCE_ENABLED` | flag | off | Live completed-row reader gate (settlement). Off ⇒ reader not constructed. | Platform |
| `EVIDENCE_CANARY_CEILING` | int (≤ hard 150) | (mode-derived, e.g. 10) | Canary bounded ceiling; clamped by `normalizeBatchLimit` (never widens). | Platform |
| `EVIDENCE_CANARY_LEAGUE_ALLOWLIST` | csv (optional) | empty ⇒ first-N | Optional deterministic competition allowlist (§8/§14). | Platform |

**Precedence & fail-safe (binding):**
1. `EVIDENCE_M10_LIVE_ENABLED` off ⇒ **everything off** (master overrides all).
2. Per path: effective write is permitted **only** when master on **AND** the path enable flag on **AND** mode ∈ {`canary`,`full`}. `dry_run` requires master on + reader-source flags but **suppresses writes** (§8/§13).
3. Settlement `full`/`canary` additionally requires `EVIDENCE_COMPLETED_SOURCE_ENABLED` on (no reader ⇒ fail-closed skip).
4. **Contradictions fail closed:** mode `full` with path-enable off ⇒ treated as `off` (skipped). Invalid enum ⇒ `off`. Invalid int ⇒ mode-derived default (never unbounded).
5. **No flag can:** bypass the lock (the lock is unconditional inside `runWithLock`), widen the ceiling above 150 (`normalizeBatchLimit` clamps), widen the deadline above 45 s (`resolveEffectiveJobDeadlineMs` clamps), or enable corrections (no correction flag exists; §23).

**Evaluation:** **request-time** (each run reads `process.env` once via a new `resolveM10ActivationConfig(env)` in `config.ts`, additive), producing an **immutable per-run snapshot** threaded through composition. No mid-run re-read. No undocumented env behaviour (all knobs enumerated above).

## 8. Activation Modes

A single per-path **enum** (`EVIDENCE_{CAPTURE,SETTLEMENT}_MODE`) rather than a matrix of write flags — smallest safe design; each maps to a validated composition:

- **OFF** — dormant: no source load, no discovery, no reader construction, no writes. Route = bare M9 pass (`succeeded` zero-count). *(= today.)*
- **DRY_RUN** — under the lock: construct the reader (settlement) / source (capture), run archive-state reads + the producer (`produceX Requests`) → `{candidates, diagnostics}`; **do NOT invoke `runCaptureBatch`/`runSettlementBatch`** (the sole write path) → **zero durable writes**; emit diagnostics/metrics/reconciliation; return `succeeded`. Proves source validity, archive compatibility, candidate volume, ceiling/deadline behaviour, and accounting closure with no mutation (§13).
- **CANARY_WRITE** — `full` semantics with `effectiveCeiling = normalizeBatchLimit(EVIDENCE_CANARY_CEILING)` (bounded, ≪ 100), deterministic selection (first-N under the provider's existing total order, or the optional allowlist), independently killable, rollback-safe, deterministic (no randomness) (§14).
- **FULL_WRITE** — normal Stage-2D ceiling (100/150) + deadline (≤45 s), still flag-gated and independently killable.

Write-suppression for DRY_RUN lives at the **composition layer** (a `runLive{Capture,Settlement}Job` orchestrator that gates whether the write batch is invoked) — **no frozen M6/M8 change, no runner write-path change.** CANARY differs from FULL only by the ceiling value + the promotion criteria (§14); it reuses the identical code path.

## 9. Source-Reader Design (production completed-fixture rows)

**Authoritative source (verified, not invented):** `readDailyArchive(date)` (`lib/footystats/dailyArchive.ts`) → `data/daily-archives/<date>.json`, a JSON `DailyArchive` whose `fh/over15/over25/sh` are `ArchivedRow[]` (`= FootyMatchRow & { listResult }`). Rows carry `matchId`, `status`, `isFinished`, `homeScore`/`awayScore`, `htHome`/`htAway`, `kickoff`/`kickoffTime` — exactly what `filterCompletedRows` + `resolveMatchLifecycle` consume. Written by the existing prepare job (`saveDailyArchive`).

**Design of the production `readRows(date)` adapter (Slice-2; not implemented here):**
- **Source identity/provenance:** file `data/daily-archives/<date>.json` (`ARCHIVE_DIR` = `process.cwd()/data/daily-archives`). *(Note: release-local `process.cwd()` — a deployment/partition concern, §Risks R-3.)*
- **Date partitioning:** one file per UTC date string; the run's `date` is derived deterministically from the injected evaluation instant (UTC), documented.
- **Rows:** flatten the four tab arrays and **dedup by `matchId`** (a fixture legitimately appears in multiple tabs — expected, not a fault; dedup happens in the adapter so `filterCompletedRows`'s `duplicate_row` counter reflects only genuine intra-tab duplicates).
- **Completion/score semantics:** delegated unchanged to `filterCompletedRows` (finished + valid scores; postponed/cancelled/abandoned no-score; non-terminal excluded).
- **Ordering:** deterministic (`filterCompletedRows` sorts matchId-asc).
- **Bounded scope:** one date per run; row count is the day's finished set (tens–low-hundreds) — O(D), no archive scan.
- **BLOCKING SUB-REQUIREMENT — strict read (Gate C):** `readDailyArchive` is **fail-open** (`catch → null`), which cannot distinguish a legitimately-missing partition (ENOENT ⇒ empty/skip) from a corrupt/unreadable one (malformed/EACCES/EIO ⇒ **throw**). Activation MUST use a **strict** variant (`readDailyArchiveStrict(date)`, additive, mirroring `readNdjson`: ENOENT → `null`/empty; any other errno / malformed JSON → throw) so the loader's whole-source contract holds. Using the fail-open reader would risk converting source corruption into an empty success (a Stop Condition) — so the strict wrapper is a **required Slice-2 dependency, not a blocker** (the source and format exist; only the read discipline is added).
- **Read-only, no cancellation/timeout today:** the adapter performs a single `fs.readFile` + `JSON.parse`; it cannot be aborted mid-read (bounded by file size; a hung read is the RC-2 residual, §16/§L). A deadline-bounded wrapper is a recommended §L item.

**Interface required (for the owner):** `readRows: (date: string) => Promise<readonly FootyMatchRow[] | null>` (already the Stage-2D `CompletedRowLoaderDeps.readRows` contract). Owner: the FootyStats/daily-archive subsystem. Test fixture required: a seeded temp `data/daily-archives/<date>.json` with terminal + non-terminal + malformed-row + duplicate-across-tab variants, plus a malformed-document and missing-file case. Acceptance before wiring: strict ENOENT-vs-throw parity test + determinism test + the §W loader integration tests green.

## 10. Route Composition

**Composition lives in a dedicated testable module, not the route handler.** New `lib/evidence-capture/activation/` (module names non-binding): `resolveM10ActivationConfig(env)` (immutable snapshot), `buildCaptureComposition(config, deps)` / `buildSettlementComposition(config, deps)` (construct reader/source/producer/clock/mode/ceiling), and `runLiveCaptureJob()` / `runLiveSettlementJob()` (thin orchestrators that delegate to the existing runner jobs with the composed `provideCandidateBatch` + `now`, or run the dry-run discover-only path).

Per live route, exactly (all reusing existing surfaces):
1. **Auth/authorization:** unchanged `evaluateCronAccess` (`x-cron-secret`, `ENABLE_CRON`) + rate-limit — inside `handleCronPost`.
2. **Flag snapshot:** `resolveM10ActivationConfig(env)` once.
3. **Master/mode gate:** master off or mode `off` ⇒ bare `runEvidence…Job()` (dormant pass) — route stays effectively unchanged.
4. **Reader/source construction:** settlement builds the completed-row loader from the strict reader (only if `EVIDENCE_COMPLETED_SOURCE_ENABLED`); capture uses `loadPublishedDailyPredictions` + the (still-injected) `deriveCaptureInput` seam.
5. **Injected clock + deadline:** `now = Date.now`; deadline anchored at **route start** (§12).
6. **Ceiling:** from mode (`canary` → `EVIDENCE_CANARY_CEILING`; `full` → operational config), clamped by `normalizeBatchLimit`.
7. **Runner invocation:** `runEvidenceCaptureJob({ provideCandidateBatch, now })` (write modes) or the discover-only dry-run path.
8. **Response mapping:** unchanged `cronHandler` (`failed→500`, `skipped→409`, else 200); lock released in `runWithLock`'s `finally`; metrics/diagnostics best-effort.

**The route handler itself changes minimally** — ideally a one-line swap `() => runLiveCaptureJob()` — with all logic in the tested composition module. The route contains **no business logic**.

## 11. Lock and Single-Writer Model

- **Type/key/scope:** PG advisory lock via `tryAcquireJobLock("job:evidence_capture"|"job:prediction_settlement", { requireDurable: true })`, key = `advisoryLockKey(name)` (int4), bound to `EVIDENCE_DATABASE_URL`, held across the whole locked job body (discovery + batch), released in `finally`.
- **Independence:** distinct keys ⇒ capture and settlement never contend (verified `m9Concurrency`). Overlap is safe (§6).
- **Production single-writer:** `requireDurable && NODE_ENV==="production"` + no/unreachable `EVIDENCE_DATABASE_URL` ⇒ `null` ⇒ `skipped`/409 — **never** a memory-lock degrade in prod. Provisioning + reachability of `EVIDENCE_DATABASE_URL` is Gate D.
- **Multi-instance / horizontal scale:** current deployment is `instances: 1` (fork) ⇒ single-writer holds structurally today; the durable advisory lock is what makes it **also** safe if instances>1 (all instances share the PG lock). **Activation MUST keep `instances: 1` OR require the durable lock provisioned before any scale-out** (Gate D; deployment change is a separate authorized task, §Y).
- **Overlap prevention:** the lock prevents duplicate route overlap, scheduler-retry overlap, and manual+scheduler overlap (loser → 409, no discovery). **No flag bypasses the lock** (unconditional inside `runWithLock`).
- **Crash/reconnect/release:** PG session drop auto-releases the advisory lock; a re-fire re-acquires; committed appends persist; no cursor (INV-A). **Carry-forward (H-1):** a successful run whose `pg_advisory_unlock` throws can misreport 500 (§C/§17) — land the swallow/log at Stage 2E-B/hardening.
- **Stale-lock assumption:** advisory locks are session-scoped (no stale lock survives a process death) — documented, no reaper needed.

## 12. Deadline and Route-Budget Model

- **Route clock start:** `handleCronPost` records `started = Date.now()` (cronHandler); the composition anchors the injected `now` and builds the **effective deadline at route entry**, so **source-load + discovery + batch + cleanup** are all charged to the ≤45 s effective budget (`resolveEffectiveJobDeadlineMs(runDeadlineMs, {headroomMs:15000})`).
- **Design change vs Stage 2D (bounded, additive):** today `producerDeadlineBudget` anchors `startedAtMs` **after** discovery (`runner.ts`), so discovery is not charged. Stage 2E must anchor the deadline at **route/job entry** (inject a route-start-anchored deadline handle, or move the anchor earlier in the runner) and add a **pre-batch remaining-time check**: if source-load+discovery already consumed the budget, defer the **entire** batch (`deferred_by_deadline = all`) and return `succeeded` — never start the batch it cannot finish. This is an injected-clock/composition change, **not** a frozen change.
- **Sub-budget reserve (initial, to be validated by 2E-B, not final):** route budget 60 s; reserve ≥15 s (write-drain + diagnostics + serialization + lock release); effective ≤45 s split (illustrative, benchmark-tuned): source-read ≤8 s, discovery ≤5 s, batch ≤30 s, cleanup/serialize inside the 15 s reserve. **No production numbers are finalized without §25 benchmark evidence.**
- **Overrun fail-safe:** the guarantee `source_load + discovery + batch + cleanup ≤ route budget` is enforced by (a) the ≤45 s effective deadline anchored at entry, (b) the pre-batch remaining-time check, and (c) the between-candidate guard. If any phase overruns, the run defers the remainder and returns `succeeded` bounded — the platform 60 s kill is never the enforcement mechanism.

## 13. Dry-Run Design

DRY_RUN (per path), under the lock, using the live reader/source:
- loads the live source (settlement: the completed-row loader; capture: daily-list),
- performs **strict** archive-state reads (`buildX ArchiveState`),
- runs the producer → `{candidates, diagnostics}` (discovery + provider classification + ceiling + deadline math applied),
- computes backlog / oldest-pending / reconciliation,
- **invokes NO write batch** → **zero durable writes** (the composition simply does not call `runCaptureBatch`/`runSettlementBatch`),
- emits bounded diagnostics/metrics; returns `succeeded`.

**Proves:** expected candidate volume, source validity, archive compatibility, deadline sufficiency (elapsed vs 45 s), ceiling behaviour, accounting closure (reconciliation ok), no correction leakage (static + runtime firewall, §23), and provider degradation visibility (`run_degraded`). **Output bounded:** only aggregate `resultCounts` + metrics (no fixture/market/entity detail).

## 14. Canary Design

- **Ceiling:** `normalizeBatchLimit(EVIDENCE_CANARY_CEILING)` (default 10; never > 150).
- **Selection (deterministic, no randomness, no entity-id in labels):** **first-N under the provider's existing total order** (capture: `capturedAt` asc, tie `fixtureId`; settlement: `completionInstant` asc, tie `fixtureId`). Optional `EVIDENCE_CANARY_LEAGUE_ALLOWLIST` (csv of `leagueCode`, config-owned, default empty ⇒ first-N only) as a competition-scoped bound. No fixture-ID allowlist by default (avoids entity-id config sprawl).
- **Scope:** one date partition/run; competition scope = allowlist or all; duration = a fixed minimum number of **consecutive successful runs** (e.g. ≥3 over the scheduled cadence) with success criteria below.
- **Success criteria:** run `succeeded`; writes committed == expected; `run_degraded==0`; reconciliation ok; `verifyEvidenceChain`/`verifyValidationChain` (out-of-band sweep) clean over the canary-written records; no duplicate/immutable-violation; elapsed < effective deadline.
- **Abort criteria:** any `failed` run; `write_failed`/`immutable_violation`; reconciliation mismatch of an unsafe class (§20); chain-verify failure; elapsed ≥ deadline; backlog/oldest-age above alert thresholds.
- **Comparison:** canary write counts must match the immediately-preceding DRY_RUN candidate counts for the same partition (bounded expectation check).
- **Promotion to full:** explicit human go/no-go after the minimum successful canary window + a clean chain-verify + benchmark headroom (§25/§27).

## 15. Kill Switches

Reusing flags (no new remote-control infra — none exists):
- **Master kill:** `EVIDENCE_M10_LIVE_ENABLED=off` — evaluated at request-time in the composition **before the lock**; next fire does no discovery/reader/write (skipped).
- **Capture write kill:** `EVIDENCE_CAPTURE_ENABLED=off` (existing) — pre-lock short-circuit `flagSkippedJob`.
- **Settlement write kill:** `EVIDENCE_SETTLEMENT_ENABLED=off` (existing).
- **Source-reader kill:** `EVIDENCE_COMPLETED_SOURCE_ENABLED=off` — settlement reader not constructed ⇒ fail-closed skip.

**Semantics (binding):** kill switches take effect on the **next fire** (env re-read per request; a running fire completes). They **never interrupt an in-flight append** (the between-candidate guard is the only stop mechanism, RC-2). An in-flight run finishes its current candidate's atomic append; new candidates/source-loads stop only at the next fire. Diagnostics remain available. A killed fire returns `skipped` (409) or, if killed mid-flight, completes bounded. **Startup vs request:** flags are request-time (no restart required to flip a kill switch). Optional hardening (§L): a SIGTERM drain that stops *starting* new candidates — not required (recovery is idempotent), deferred.

## 16. Rollback

Per phase, rollback = **stop future activity** (flag off), relying on immutable/idempotent semantics; **never delete valid append-only evidence**:
- **DRY_RUN rollback:** mode `off` — no writes ever occurred; nothing to undo.
- **CANARY / FULL rollback:** mode `off` / enable flag off — future writes stop; already-written snapshots/validations are **immutable and valid** and remain (a re-fire is idempotent: `already_exists`/`already_settled`/`no_change`).
- **Source-reader rollback:** `EVIDENCE_COMPLETED_SOURCE_ENABLED=off` — settlement returns to no-source skip.
- **Route rollback:** revert the route to the bare `runEvidence…Job()` delegate.
- **Flag rollback:** the primary mechanism — reversible config change, no restart required.
- **Code rollback:** revert the composition module + route swap; the additive runner/config/loader changes are dormant with flags off.

**Corruption response (separate):** rollback is NOT a corruption remedy. If `immutable_violation` (a determinism bug) or a torn NDJSON line is detected, quarantine the affected file/line + escalate (P0) via the out-of-band `verifyEvidenceChain`/`verifyValidationChain` sweep — do **not** delete valid records. Duplicate-safe replay is already guaranteed by content-addressing + full-stream idempotency.

## 17. Failure-Mode Matrix

| # | Failure | Detection | Class / write | HTTP / job | Retry / response |
|---|---|---|---|---|---|
| 1 | Source unavailable (missing partition) | strict reader ENOENT | empty (no write) | 200 `succeeded` zero-count | re-fire when partition exists |
| 2 | Source unreadable (EACCES/EIO) | strict reader throw | `ProducerError(source_load_failed)` | 500 `failed` | re-fire; alert |
| 3 | Malformed document | strict reader `JSON.parse` throw | `source_load_failed` | 500 `failed` | alert; quarantine file |
| 4 | Malformed row | `filterCompletedRows` per-row drop+count | isolated (valid rows continue) | 200 `succeeded` | `dropped.*` counted |
| 5 | Stale source (old partition) | freshness check on `savedAt`/date (§9) | deferred/skip (no write) | 200 `succeeded` | re-fire; `run_degraded` optional |
| 6 | Incomplete partition | fewer terminal rows than expected | partial (bounded) | 200 `succeeded` | rest re-discovered next fire |
| 7 | Archive read failure | strict whole-archive read throw | `archive_read_failed` | 500 `failed` | alert; never empty |
| 8 | Archive conflict | `ArchiveStateConflictError` | `archive_conflict` | 500 `failed` | alert; quarantine |
| 9 | Evidence append failure | `runCaptureBatch` `writeFailed` | hard-fail | 500 `failed`+`write_failed` | idempotent re-fire |
| 10 | Validation append failure | `runSettlementBatch` `writeFailed` | hard-fail | 500 `failed`+`write_failed` | idempotent re-fire |
| 11 | Metrics failure | `safeRun`/try-catch | best-effort (swallowed) | unchanged | never fails job |
| 12 | Lock unavailable | `tryAcquireJobLock` → null | skipped (no work) | 409 `skipped` | next fire |
| 13 | Lock lost (session drop) | PG auto-release | committed persists | (mid-run) | re-fire re-acquires |
| 14 | DB unavailable (prod) | `requireDurable` + no URL → null | fail-closed skip | 409 `skipped` | provision `EVIDENCE_DATABASE_URL` |
| 15 | Process crash | — | committed prefix persists | — | re-fire re-derives (INV-A) |
| 16 | Route timeout | deadline guard defers before | bounded (no overrun) | 200 `succeeded` partial | re-fire remainder |
| 17 | Scheduler retry overlap | lock loser | no double-write | 409 `skipped` | serialized |
| 18 | Duplicate source rows | adapter dedup + `duplicate_row` count | isolated | 200 | expected across-tab dedup |
| 19 | Late completion update | next fire re-reads partition | first-settle stands; correction deferred (§22/§23) | 200 | Stage-3 (not 2E) |
| 20 | Non-finite clock | `remainingMs=0` | defer everything | 200 `succeeded` zero | re-fire |
| 21 | Deadline before 1st candidate | pre-batch remaining check | all `deferred_by_deadline` | 200 `succeeded` zero | re-fire |
| 22 | Deadline after partial | between-candidate guard | committed prefix + deferred tail | 200 `succeeded` | re-fire remainder |
| 23 | Ceiling truncation | `deferred_by_cap` | bounded | 200 | re-discovered next fire |
| 24 | Invalid flag combination | `resolveM10ActivationConfig` fail-safe | fail-closed off | 409/200 | fix config |
| 25 | Misconfigured source path | strict reader ENOENT/throw | #1 or #2 | 200/500 | Gate C/K |
| 26 | PM2 restart | jobLog reset (non-authoritative) | no cursor | — | re-derive from archive |
| 27 | Multi-instance overlap | durable lock loser | no double-write | 409 | keep `instances:1` or durable lock (Gate D) |

Every mode is **fail-closed or bounded**; none converts source failure into an empty success (except a genuinely-missing partition, which IS empty — distinguished by the strict reader, §9).

## 18. Observability

Reuse `lib/observability/metrics.ts` (no second framework). All labels `{job, outcome|reason|mode}` — **bounded cardinality, finite, sanitized, no fixture/market/provider/entity id, no raw exception message** (`sanitizeLabels` + fixed enums). Metric set:

- **Counters:** route invoked / skipped; lock unavailable; source-load success/failure; producer outcomes (`evidence_producer_outcome_total{job,outcome}` — discovered/malformed/eligible/selected/deferred_by_cap/deferred_by_deadline/processed); `evidence_producer_rejected_total{job,reason}`; writes committed / already-existing (from batch counts `captured`/`duplicate`/`settled`/`noChange`); producer hard-failure; canary success/failure; kill-switch skips.
- **Gauges:** `evidence_producer_backlog{job}`; `evidence_producer_oldest_pending_age_ms{job}`; `route_budget_remaining_ms{job}` (new); flag/mode state as a bounded enum gauge.
- **Timings (histograms via `metrics.timing`):** run duration; source-load duration; discovery duration; batch duration; cleanup duration; lock-hold duration (new).
- **Per-run diagnostics:** merged `resultCounts` (already surfaced via `getEvidenceJobDiagnostics`), incl. `run_degraded`.

**Alert inputs (conditions defined; routing is an ops gate, not built here):** any `failed` run; `write_failed`/`immutable_violation` > 0; `oldest_pending_age_ms` above the INV-S capacity threshold; `backlog` sustained-growth; run duration > effective deadline; canary abort criteria (§14). Alert delivery uses the existing metrics/log backend — no new alerting infra invented.

## 19. Durable Diagnostics Decision

**Decision: (1) ephemeral diagnostics are sufficient for the initial dry-run + canary; (2) existing logs + metrics provide adequate durability.** `getEvidenceJobDiagnostics` (process-local, reset on restart) + the `metrics` snapshot + `logInfo`/`logWarn` structured logs cover incident investigation for the bounded canary. A **durable job-run store is NOT required for initial activation** and is therefore **not designed here** (creating a schema would itself be a blocked migration). If, during canary, incident-investigation or audit needs prove ephemeral history insufficient, a durable job-run store becomes a **separate migration plan** that **blocks full-write** until delivered (recorded as a §32 conditional carry-forward, not a Stage-2E-A blocker).

## 20. Reconciliation Policy (Stage 2D OB-1/C-2 carry-forward)

Stage 2E **wires** the reconcilers at runtime (they exist, unit-proven, unused): after discovery, before writes, call `reconcileCaptureDiagnostics`/`reconcileSettlementDiagnostics` and emit a bounded `evidence_reconciliation_ok{job}` gauge (1/0) + `evidence_reconciliation_mismatch{job}` counter. **Severity policy:**
- A mismatch on an **accounting-safety** identity (row/fixture/eligible grain — indicates lost or double-counted candidates) ⇒ **fail closed before live writes** (dry-run/canary especially) — do not write against unaccounted candidates.
- A mismatch on a **pure-observability** grain ⇒ `run_degraded` (log + continue), never silently ignored.
- **RC-1 grain definitions are NOT altered.** Exact per-identity severity is fixed in the Stage-2E implementation spec + reviewed. No mismatch is ever silently dropped.

## 21. Capture Activation Requirements

Before capture canary: the master + `EVIDENCE_CAPTURE_ENABLED` + `EVIDENCE_CAPTURE_MODE` flags; the capture composition; **and the M4→M5 `deriveCaptureInput` live derivation** — which is **unbuilt** (an injected seam). **Capture full activation is therefore gated on a separate live-derivation stage** (M4 fetch/admission + M5 derive behind `deriveCaptureInput`), out of Stage 2E-A scope. Capture **DRY_RUN** can proceed with the daily-list source but will emit zero candidates until derivation exists (documented). The §W capture-specific tests (C-1 carry-forward) are required regardless. *(This makes settlement the nearer-term activation candidate — §22.)*

## 22. Settlement Activation Requirements

Preserve the **first-settlement-only firewall**, strict archive reads, no correction inference, no `currentValidationHeads`, no `correctionCause`, immutable validation records, deterministic `settledAt` (source kickoff instant), idempotent retry, no duplicate writes — all already guaranteed by Stage 2C + the frozen M8. Settlement needs **only** the production completed-row reader (§9) — no unbuilt derivation — so **settlement is the nearer-term activatable path.** Ordering (data, not code): settlement DRY_RUN/canary is meaningful only once capture has minted snapshots for finished fixtures; therefore **settlement canary SHOULD follow a capture write period** (evidenced by `capturedFixtureIds` coverage of the finished set), or run against back-filled snapshot history. Settlement may otherwise activate **independently** of capture code.

## 23. Correction Firewall (static + runtime)

Stage 2E MUST NOT: read `currentValidationHeads`; infer changed outcomes; emit `correctionCause`; write correction revisions; classify correction types; mutate old validation records; replay corrected histories. Enforcement:
- **Source static guards** (extend the existing 2C/2D scope tests): assert the activation/composition modules contain no `correctionCause`/`currentValidationHeads` (comment-stripped scan).
- **Route-composition guard:** the composition never passes `correctionCause` on a `SettlementCandidate` (it never sets the optional field); M8's causeless-change → `invalid_input` backstop remains.
- **Test guards:** a dedicated correction-firewall test group (§W).
- **Review checklist item** (§34). Correction remains a **separate later stage**; no correction item is pulled into Stage 2E.

## 24. Deployment Sequence (human go/no-go at every promotion)

| Phase | Flags / mode | Max candidates | Min observation | Success | Abort → rollback |
|---|---|---|---|---|---|
| **0 — Deploy dormant** | all OFF | 0 | smoke | routes return dormant `succeeded`; 1824/1824 in CI | any regression → revert code |
| **1 — Settlement DRY_RUN** | master on; `SETTLEMENT_MODE=dry_run`; `COMPLETED_SOURCE_ENABLED` on; writes OFF | discovery-only | ≥1 scheduled window | candidate counts sane; reconciliation ok; zero writes verified | mismatch/source fail → mode off |
| **2 — Settlement CANARY** | `SETTLEMENT_ENABLED` on; `SETTLEMENT_MODE=canary`; `CANARY_CEILING` ≤10 | ≤10 | ≥3 consecutive clean runs | writes==expected; chain-verify clean; no dup; `run_degraded==0` | any `failed`/dup/chain fail → mode off |
| **3 — Settlement FULL** | `SETTLEMENT_MODE=full` | 100/150 | ≥1 clean day | bounded within deadline; chain-verify clean | → mode canary/off |
| **4 — Capture DRY_RUN** | `CAPTURE_MODE=dry_run` | discovery-only | ≥1 window | source/archive compatible; zero writes | → off |
| **5 — Capture CANARY/FULL** | requires live M4→M5 derivation (separate stage) | ≤10 → 100/150 | ≥3 clean → ≥1 day | as phases 2–3 | → off |

**No automatic promotion.** Each promotion requires explicit human go/no-go by the named owner (§27) with the gate artifacts (§26). Capture phases (4–5) additionally depend on the unbuilt derivation stage.

## 25. Stage 2E-B Benchmark Contract

Stage 2E-B (a separate authorized task — **not executed here, no results fabricated**) must run and record:
- **Archive depth:** small / medium / current-production-representative / projected high-water-mark (snapshots + validations + odds NDJSON).
- **Source size:** normal day / high-volume / malformed-row-heavy / duplicate-heavy partitions.
- **Candidate volume:** 0, 1, 10, 50, 100, 150, and eligible-above-ceiling.
- **Modes:** dry-run / capture-canary / capture-full / settlement-dry-run / settlement-canary / settlement-full.
- **Measurements:** source-load, source-parse, archive-read, discovery, provider, candidate-loop, append, total-route, lock-hold, cleanup durations; peak memory / RSS / heap; event-loop delay; archive reads; bytes parsed; files opened; writes attempted/committed; deferrals by deadline/cap; retries; duplicate-avoidance.
- **Outputs:** p50/p95/p99/worst; sample count; machine/runtime spec; archive+source fixture descriptions; reproducible commands; raw-artifact location; tuning recommendations for `reservePerCandidateMs`, headroom, source-read budget, discovery budget, canary ceiling, full-write ceiling, route timeout, scheduler interval; **go/no-go result**.
- **Binding gate:** FULL_WRITE (either path) is **not authorized** until 2E-B proves a ceiling-sized run < the effective ≤45 s deadline at current-representative depth **and** the provisional `reservePerCandidateMs`(250/120)/headroom(15 s) are validated or retuned (Stage-2D provisional constants).

## 26. Activation Gates

| Gate | Evidence | Pass criteria | Owner | Blocking failures | Artifact |
|---|---|---|---|---|---|
| **A — Frozen-contract integrity** | source scan + typecheck diff | no change to M6/M8/`types/evidence`/identity/hash/format | Reviewer | any frozen change | scan report |
| **B — Test completeness** | §W suite | all §W tests green incl. capture-specific (C-1) | Test owner | any gap in write-path tests | test run |
| **C — Source-reader readiness** | strict reader + fixtures | strict ENOENT-vs-throw parity; determinism; fail-closed | FootyStats owner | fail-open reader used | reader tests |
| **D — Lock & single-writer** | prod `EVIDENCE_DATABASE_URL` + `instances:1` or durable-lock proof | fail-closed prod lock; no memory degrade | Platform | scale-out without durable lock | lock config proof |
| **E — Deadline & route-budget** | 2E-B partial | source+discovery+batch+cleanup ≤ 60 s; effective ≤45 s anchored at entry | Perf | overrun without defer | budget proof |
| **F — Performance & memory** | 2E-B full | ceiling-run < deadline at representative depth; RSS/event-loop bounded | Perf | any budget breach | benchmark |
| **G — Observability** | metrics snapshot | bounded-cardinality set present; no entity id; best-effort | Ops | entity-id label | metrics audit |
| **H — Dry-run** | phase-1 run | zero writes; reconciliation ok; counts sane | Ops | any write in dry-run | dry-run report |
| **I — Canary** | phase-2 runs | ≥3 clean; chain-verify clean; no dup | Ops | any abort criterion | canary report |
| **J — Rollback** | flag-off drill | flags-off stops writes; no data delete | Ops | rollback fails to stop writes | drill report |
| **K — Deployment** | ecosystem review | `instances:1`/durable-lock; secrets present | Platform | multi-instance no lock | deploy checklist |
| **L — Correction firewall** | static+test guards | no correction symbols/paths | Reviewer | any correction leak | firewall report |

No production activation with a failed blocking gate. Conditional findings allowed only on non-blocking observability/coverage items.

## 27. Go / No-Go Matrix

| Decision | Required gates | Required verdicts | Benchmark | Approval |
|---|---|---|---|---|
| Code implementation authorization | A, B (design), L | 2E-A design review APPROVED | — | Eng lead |
| Staging activation | A–D, G, H, L | impl reviews APPROVED | partial (E) | Eng lead |
| Production DRY_RUN | A–D, G, H, J, K, L | prod-safety APPROVED | partial | Eng lead + Ops |
| Production capture/settlement CANARY | A–L | all APPROVED | 2E-B canary | Eng lead + Ops + owner |
| Production FULL_WRITE | A–L | all APPROVED | 2E-B full (E/F) | Eng lead + Ops + owner |

**This plan authorizes only: STAGE 2E-A DESIGN REVIEW.** It does not authorize implementation or activation.

## 28. Test Plan (Stage 2E implementation)

**Unit:** activation-mode resolution; flag precedence + invalid combinations (fail-closed); kill-switch evaluation; source-reader composition; budget/deadline composition (route-start anchor); canary ceiling clamp; dry-run no-write; reconciliation-severity policy; correction-firewall scan.
**Integration (real runner + injected production-style strict reader over temp `data/daily-archives`):** capture route composition; settlement route composition; lock unavailable → skipped/no-discovery; concurrent invocation (distinct locks); source failure (ENOENT vs malformed); archive failure; partial-deadline defer; retry-after-defer idempotent; route-timeout boundary; kill-switch before run; kill-switch mid-run between candidates; dry-run zero-write; canary bounded-write + chain-verify; full write; rollback-to-OFF; multi-instance lock behaviour (durable-lock contention).
**Failure injection:** process crash (committed prefix + re-fire); append failure; DB disconnect; source-reader hang (RC-2 residual documented); malformed/stale source; metrics failure (best-effort); PM2 restart (no cursor); scheduler overlap (lock loser).
**Static guards:** no correction symbols / `currentValidationHeads` / `correctionCause`; routes contain no business logic; frozen M6/M8 unchanged; no schema migration; all new flags default OFF; source reader not enabled by default.
**Capture-specific (C-1, required — do not rely on settlement symmetry):** `provideCandidateBatch` integration; `runCaptureBatch` deadline-defer; capture retry-after-defer; capture ceiling truncation+rediscovery; capture dry-run no-write; capture canary bounded-write; capture flag-off; capture lock-unavailable; capture whole-source failure; capture accounting reconciliation.

## 29. Implementation Slices (minimal, safe, each default OFF)

| Slice | Adds | Files likely affected | Tests | Activation state | Stop condition |
|---|---|---|---|---|---|
| **1 — Activation model** | `resolveM10ActivationConfig` + mode enum + flag snapshot + composition ports | `config.ts` (additive), new `activation/config.ts` | unit (flags/modes/precedence) | dormant | any flag defaults ON |
| **2 — Strict source reader + dry-run** | `readDailyArchiveStrict` + `readRows` adapter + settlement dry-run composition + route-start deadline anchor | new `footystats/dailyArchiveStrict.ts` (additive), `activation/settlement.ts`, runner deadline-anchor (additive) | reader parity + dry-run no-write | dormant (writes off) | fail-open reader / any write in dry-run |
| **3 — Settlement canary/full wiring** | `runLiveSettlementJob` + route swap + reconciliation wiring + metrics | `activation/settlement.ts`, settlement route (one-line), `operational` metric calls | canary/full integration | default OFF | writes default ON / lock bypass |
| **4 — Capture dry-run wiring** | capture dry-run composition (derivation still a seam) | `activation/capture.ts`, capture route (one-line) | capture C-1 suite | default OFF | requires unbuilt derivation for writes |
| **5 — Runbook + gate verification + metrics finalization** | operational runbook + gate artifacts | docs + `operational` gauges | observability | default OFF | missing gate artifact |

No slice defaults production behaviour to ON. Capture write (beyond dry-run) is explicitly gated on the separate M4→M5 derivation stage.

## 30. Expected File-Change Boundary (for Stage 2E implementation)

**May change (additive):** `lib/evidence-capture/config.ts`; new `lib/evidence-capture/activation/*`; new `lib/footystats/dailyArchiveStrict.ts`; `lib/jobs/runner.ts` (deadline anchor + optional dry-run/mode param, additive); the two cron route files (one-line composition swap, no business logic); `lib/observability` call-sites (emit only); new tests; new docs.
**Must remain untouched:** M6 (`capture.ts`/`mandatory-odds.ts`); M8 (`settlement.ts`/`outcomes.ts`/`validation/*`); `types/evidence/*`; `ValidationRecord`/`EvidenceSnapshot`; identity/hash/revision/`settledAt`; `EVIDENCE_ARCHIVE_DIR`/NDJSON format; `locks.ts` semantics (used as-is); `metrics.ts`; existing daily-archive `saveDailyArchive`/`readDailyArchive` (add the strict variant beside them).
**Separate authorized task (not app code):** `deploy/ecosystem.rankwagers.cjs` / `instrumentation.ts` / secret provisioning (`EVIDENCE_DATABASE_URL`, `CRON_SECRET`, `ENABLE_CRON`, scheduler cadence) — deployment/infra changes require their own explicit authorization.

## 31. Risks

- **R-1 (source read discipline):** `readDailyArchive` is fail-open → strict variant required (Gate C). Bounded, specified.
- **R-2 (route-budget composition):** source-load+discovery currently uncharged to the deadline → route-start anchoring required (§12). Bounded.
- **R-3 (source location):** `data/daily-archives` is `process.cwd()`-relative (release-local), unlike the shared evidence dir — a partition/availability concern across releases; confirm the prepare job and reader resolve the same path (Gate C/K).
- **R-4 (capture derivation unbuilt):** capture full write blocked on the M4→M5 stage — capture activation deferred; settlement is the near-term path.
- **R-5 (single-writer on scale-out):** safe at `instances:1`; scale-out requires the provisioned durable lock (Gate D).
- **R-6 (deep-archive O(F²)):** inherited M6/M8 whole-archive scan cost — a 2E-B/adapter gate, not introduced here.
- **R-7 (H-1 unlock-500):** carry-forward; land the swallow/log at hardening.

## 32. Blockers

**None that block Stage 2E-A (design).** No frozen-contract/schema/migration change is required; an authoritative source exists with a known format. The three bounded dependencies (strict reader, route-start deadline anchor, dry-run composition) are **specified design work with defined interfaces/owners/acceptance**, gated before their respective phases — not design blockers. Conditional activation blockers (owned by later gates, not Stage 2E-A): live M4→M5 derivation (capture full); `EVIDENCE_DATABASE_URL` provisioning (prod lock, Gate D); a durable job-run store **only if** canary proves ephemeral diagnostics insufficient (§19).

## 33. Carry-Forward

- **Stage 2D cleanup (non-blocking):** OB-2 docstring; error-code asserts; entity-id heuristic (fold into §W).
- **Stage 2E-B (this plan's §25):** the full benchmark contract.
- **Stage 2E hardening:** H-1 unlock-500; fsync/sweep; hung-loader timeout (RC-2 residual); durable metrics/alerting if canary demands it; single-writer scale-out.
- **Capture live-derivation stage:** M4 fetch/admission + M5 derive behind `deriveCaptureInput` (blocks capture writes).
- **Correction stage (separate, later):** `currentValidationHeads`/`correctionCause`/classification/revision/activation/replay — never pulled into Stage 2E.

## 34. Review Checklist (for the independent Stage-2E-A reviewers)

- [ ] Topology: two routes, two durable locks, independent activation/rollback; overlap-safe justification correct.
- [ ] Flags: bounded, all default OFF, master-off disables all, contradictions fail closed, no lock/ceiling/deadline/correction bypass.
- [ ] Modes: OFF/DRY_RUN/CANARY/FULL semantics precise; dry-run zero-write mechanism does not touch frozen M6/M8.
- [ ] Source: strict reader requirement; format/partition/dedup/freshness correct; read-only; whole-source fail-closed.
- [ ] Budget: route-start deadline anchor; source+discovery charged; pre-batch defer; ≤45 s effective; overrun fail-safe.
- [ ] Lock: prod fail-closed; single-writer at `instances:1` or durable lock; no bypass.
- [ ] Canary: deterministic first-N/allowlist; no randomness; no entity-id labels; abort/promotion criteria.
- [ ] Kill switches: request-time; never interrupt an append; stop new work.
- [ ] Rollback: flags-off stops writes; never deletes valid evidence; corruption response separate.
- [ ] Failure matrix: every mode fail-closed/bounded; no source-failure→empty-success.
- [ ] Firewall: no `currentValidationHeads`/`correctionCause`; static+runtime+test+review guards.
- [ ] Frozen boundaries: no M6/M8/schema/format/identity change; additive-only file boundary.
- [ ] 2E-B benchmark contract complete; FULL gated on evidence; no fabricated numbers.
- [ ] Gates A–L + go/no-go matrix require human approval; no auto-promotion.

## 35. Final Recommendation

Stage 2E-A is a complete, repository-grounded, fail-closed, reversible activation design that preserves every Stage-2D guarantee and every frozen boundary. The near-term activatable path is **settlement** (source exists; no unbuilt derivation); capture full write is deferred to the separate M4→M5 derivation stage. The three bounded design dependencies (strict daily-archive reader, route-start deadline anchoring, dry-run composition) are specified with interfaces, owners, and acceptance criteria and are gated before their phases. No frozen-contract, schema, or migration change is required, so the design is not blocked. Proceed to independent Stage-2E-A design review; implementation and activation remain unauthorized pending that review, the gates, and the Stage-2E-B benchmark.

---

# STAGE 2E-A PLAN READY FOR INDEPENDENT REVIEW

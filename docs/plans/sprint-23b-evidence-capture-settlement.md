# Sprint 23B — Evidence Capture & Settlement Operations — Implementation Plan

**Status:** M9 (Activation & Production Wiring) — **COMPLETE — CODE COMPLETE, ACTIVATION DORMANT** (2026-07-30). Repository implementation merged in a default-off, dormant posture; flags default-off; production durable locks fail closed; mandatory snapshot+odds pair enforced; strict archive reads fail-closed; frozen contracts unchanged. Code complete: YES · Repository blockers: NONE · Production enabled: NO · End-to-end candidate pipeline active: NO · Ready to proceed to M10: YES. Closure record: [`sprint-23b-m9-closure.md`](./sprint-23b-m9-closure.md). (Live M4→M5 candidate derivation, candidate supply to runners, production-useful cron with non-empty sets, and live batching/scheduling belong to M10.)
**Author:** reconstructed from the approved Sprint 23B audit findings + targeted source inspection.
**Date:** 2026-07-28
**Predecessors:** Sprint 23 (Evidence Archive architecture — COMPLETE), Sprint 24 (Public Acca Pages — COMPLETE).

## Purpose

Activate the *already-built* Evidence Archive with a deterministic **production capture** and **settlement** pipeline for **published daily-list predictions only**. This sprint wires real data into an existing, tested-but-dormant system. It does **not** redesign Sprint 23 contracts, and it does **not** capture Acca selections.

---

## 1. Confirmed repository facts (verified by inspection)

Everything in this section was read directly from source during planning. File-and-line references are load-bearing.

### 1.1 Evidence Archive domain already exists and is complete
- **Store contract:** `lib/archive/evidence/store.ts` — `EvidenceArchiveStore` interface: `appendSnapshot`, `appendValidation`, `listSnapshots`, `listValidations`, `latestSnapshot`, `nextSequence`. Append-only, idempotent on `(id, contentHash)`, immutable-violation on hash mismatch. **No update/delete by design.**
- **Service entry point:** `lib/archive/evidence/service.ts` — `appendEvidenceSnapshot`, `appendValidationRecord`, `getEvidenceHistoryView`, `getLatestEvidenceSnapshot`, `getValidationRevisions`, `nextEvidenceSequence`. Fail-soft reads, failure-returning writes. Store resolved by `createDefaultStore()` (service.ts:33) via `EVIDENCE_ARCHIVE_ADAPTER` — currently only `memory` vs `file`.
- **NDJSON adapter:** `lib/archive/evidence/file.ts` — append-only `appendFile`; `createFileEvidenceArchive()`.
- **Memory adapter:** `lib/archive/evidence/memory.ts`.
- **Append admission rules:** `lib/archive/evidence/rules.ts` (`decideSnapshotAppend`, `decideValidationAppend`).
- **Snapshot construction:** `lib/evidence/snapshot.ts` — `createEvidenceSnapshot(input)` is the ONLY sanctioned mint path; normalizes, validates, hashes, deep-freezes. Returns `{ok:false, errors}` rather than throwing.
- **Deterministic identity:** `lib/evidence/identifiers.ts` — `evidenceSnapshotId({fixtureId, capturedAt, sequence})`, `validationId({snapshotId, marketKey, selectionKey})`, `validationRevisionId({validationId, revision})`. Content-derived; same coordinates → same id.
- **Validation contract:** `types/evidence/validation.ts` — `ValidationState = pending | won | lost | void | cancelled | postponed | abandoned`; `ValidationReasonCode` covers `settled_result | market_void | fixture_cancelled | fixture_postponed | fixture_abandoned | data_correction | settlement_correction | awaiting_result`. Corrections are new revisions (immutable), "current" derived as highest revision. **The void/postponed/cancelled/abandoned model already exists.**
- **API routes (read):** `app/api/evidence/{history,latest,validation,diagnostics}/route.ts`.
- **History UI:** renders on the existing fixture URL (`lib/archive/evidence/schema.ts` URL policy); developer surface at `app/developer/evidence`.
- **Tests:** `tests/evidenceArchive.test.ts` is the only current exerciser of `createEvidenceSnapshot` / `appendEvidenceSnapshot`.

### 1.2 The three gaps this sprint fills (confirmed absent)
- **No production capture writer.** Nothing outside tests calls `createEvidenceSnapshot`/`appendEvidenceSnapshot`.
- **No `evidence_capture` cron and no `prediction_settlement` cron.** The existing `evidence_prepare` job (`lib/jobs/runner.ts:101`, route `app/api/internal/cron/evidence-prepare/route.ts`) calls `refreshComboPreparedSnapshot` — that builds the **combo prepared snapshot**, an unrelated dataset. It does **not** touch the Evidence Archive. The name collision is a trap; do not extend it.
- **No PostgreSQL evidence adapter.** `service.ts:createDefaultStore()` offers only memory/file. No `postgres` branch, no `lib/archive/evidence/postgres.ts`.

### 1.3 Release-local / orphaning risk (confirmed)
- `lib/archive/evidence/file.ts:34`: `ARCHIVE_DIR = path.join(process.cwd(), "data", "evidence-archive")`. **Release-local.** `EVIDENCE_ARCHIVE_DIR` is referenced **nowhere** in the codebase (grep-confirmed empty) — it does not yet exist.
- The daily-list capture *source* has the same shape: `lib/footystats/dailyArchive.ts:7`: `ARCHIVE_DIR = path.join(process.cwd(), "data", "daily-archives")` — also release-local. (Noted as a related risk; **out of scope to change** unless it blocks reproducible capture.)

### 1.4 Existing infrastructure this sprint reuses (do not reinvent)
- **Cron plumbing:** `lib/jobs/cronHandler.ts` (`handleCronPost`) — request id, `evaluateCronAccess` (`lib/security/cronAccess.ts`, `x-cron-secret`/`CRON_SECRET`, `ENABLE_CRON`), rate limiting, structured logging, status→HTTP mapping.
- **Job runner:** `lib/jobs/runner.ts` — `runWithLock(jobType, fn)` pattern, `RefreshJobRecord`, metrics, in-memory `jobLog`. `JobType` union in `lib/jobs/types.ts` (currently lacks capture/settlement).
- **Locks:** `lib/jobs/locks.ts` — `tryAcquireJobLock` via `pg_advisory_lock` (falls back to in-memory), keyed on `SNAPSHOT_/ATTRIBUTION_/ODDS_HISTORY_DATABASE_URL`.
- **Postgres adapter pattern to mirror:** `lib/acca-publication/adapters/postgres.ts` + contract `lib/acca-publication/store.ts` + `adapters/memory.ts` — `storageMode: "memory"|"postgres"`, `durable` flag, `Pool`, transactional writes, SQLSTATE `23505` handling, never leaks SQL text. Sprint 24 precedent.
- **Migration convention:** `db/migrations/YYYYMMDD_create_<name>.sql` — forward-only, additive, documented reverse path in-header (e.g. `20260728_create_published_accas.sql`). Rehearsed via `scripts/rehearse-migrations.mjs` (`npm run ops:migrate-rehearse`). Backup via `scripts/backup-postgres.mjs` (`npm run ops:backup`).
- **`pg` dependency:** present (`pg ^8.22.0`).

### 1.5 Authoritative daily-list prediction source (discovered)
- **Origin:** FootyStats `DailyMatchLists` (`lib/footystats/types.ts`, fetched by `lib/footystats/client.ts`), persisted per-date by `lib/footystats/dailyArchive.ts` (`saveDailyArchive`/`readDailyArchive`, `data/daily-archives/<date>.json`).
- **Mapping to predictions:** `mapDailyListsToQualifiedFixtures(lists, locale)` (`lib/research/qualifiedFixture.ts:91`) → `QualifiedFixture`; `buildCandidatesFromDailyLists` (`lib/combo/candidates.ts:140`). Per-selection shape `ComboSelection` (`lib/combo/types.ts:56`): carries `matchId: number`, `marketKind: MatchListKind`, `oddsMarketKey`, `modelProbability`, `kickoffAt`, `competitionId`, `evidenceStrength`, `qualifiedSample`, etc.
- **Existing settlement primitives:** `lib/footystats/listSettle.ts` — `listSettleState(row, tab) → "won"|"lost"|"pending"|"postponed"`; `isPredictionWin` (`predictionWin.ts`); `isMatchPostponed` (`matchStatus.ts`); `countSettledRows`. `FootyMatchRow` (`lib/footystats/types.ts`) exposes `isFinished`, `status`, `listResult`.

> **Identity mismatch to resolve (see Blockers):** `EvidenceSnapshot.fixtureId` is a **positive integer** (`snapshot.ts:207`), but `ComboSelection.fixtureId` is a **string**; the numeric handle on the daily-list side is `matchId: number`. The evidence archive and the fixture history URL key on the numeric id.

---

## 2. Proposed architecture (new work)

All new capture/settlement logic lives in a **new** module `lib/evidence-capture/*`, keeping it separate from the dormant combo `evidence_prepare` path and from the Sprint 23 archive internals it *consumes but does not modify*.

```
lib/evidence-capture/
  source.ts        # discover authoritative published daily-list predictions for a date
  identity.ts      # numeric fixture id + capture-window key derivation (idempotency)
  capture.ts       # pre-kickoff snapshot build + append (idempotent)
  settlement.ts    # completion detection + deterministic market settlement → ValidationRecord
  outcomes.ts      # FootyMatchRow.status → ValidationState/ValidationReasonCode mapping table
  markets.ts       # MatchListKind ↔ (marketKey, selectionKey) canonical mapping
  diagnostics.ts   # capture/settlement health + counts
  config.ts        # env parsing, feature flags, capture-window params
  index.ts
```

Archive-adapter and infra changes are **surgical edits** to existing files.

---

## 3. Implementation plan — phases & file-level changes

### Phase 0 — Guardrails & config (no behavior change)
- **NEW** `lib/evidence-capture/config.ts` — read/validate: `EVIDENCE_CAPTURE_ENABLED`, `EVIDENCE_SETTLEMENT_ENABLED`, `EVIDENCE_CAPTURE_LEAD_MINUTES` (default e.g. 60), `EVIDENCE_CAPTURE_MAX_FIXTURES` (safety cap), plus adapter/dir passthroughs. Pure, browser-unsafe-free.
- **EDIT** `.env.example` — document every new var (see §6). Additive comments only.
- **Acceptance:** flags default **off**; importing config has no side effects.

### Phase 1 — Shared-directory NDJSON fallback (fix orphaning) ⚠️ do first, it is a data-safety fix
- **EDIT** `lib/archive/evidence/file.ts` — resolve archive dir from `EVIDENCE_ARCHIVE_DIR` (trimmed) when set; otherwise fall back to a **documented shared default** (e.g. `/opt/rankwagers/shared/evidence-archive`, matching the existing `/opt/rankwagers/shared` convention seen for `.env`), **never** `process.cwd()/data` in production. Keep `process.cwd()/data/evidence-archive` only as a last-resort dev default guarded by `NODE_ENV !== "production"`. `evidenceArchivePaths()` must reflect the resolved dir.
- **Acceptance:** with `EVIDENCE_ARCHIVE_DIR` set, snapshots/validations write there and survive a simulated release swap (path independent of `process.cwd()`). Existing tests that rely on the dev default still pass (they set the env or use memory).

### Phase 2 — Capture source discovery & stable identity
- **NEW** `lib/evidence-capture/source.ts` — `loadPublishedDailyPredictions(date)`: read the authoritative daily list via `readDailyArchive(date)` → `archiveToDailyLists` → `mapDailyListsToQualifiedFixtures`, yielding a normalized list of `{ fixtureId:number, competitionId, seasonId?, kickoffAt, marketKind, oddsMarketKey, modelProbability, evidenceStrength, qualifiedSample, ... }`. Source is **daily-list only**; Acca candidates are explicitly excluded.
- **NEW** `lib/evidence-capture/identity.ts` —
  - `numericFixtureId(selection)`: canonical mapping to the archive's numeric `fixtureId` (**= `matchId`**, pending Blocker #1 confirmation), with a single choke-point so a wrong assumption is fixed in one place.
  - `captureWindowKey(fixtureId, kickoffAt, leadMinutes)`: deterministic pre-kickoff slot; feeds a **quantized `capturedAt`** so re-runs in the same window mint the **same** `evidenceSnapshotId` and dedupe rather than accreting sequences.
- **NEW** `lib/evidence-capture/markets.ts` — canonical `MatchListKind → { marketKey, selectionKey }` (and reverse) mapping used by both capture (to fill `supportedMarkets`) and settlement.
- **Acceptance:** given a fixed daily archive, discovery is deterministic and returns a stable id + window key per prediction across repeated calls.

### Phase 3 — Pre-kickoff evidence capture (idempotent)
- **NEW** `lib/evidence-capture/capture.ts` — `captureFixture(prediction, now)`:
  1. **Window gate:** only capture when `now` is within `[kickoff − leadMinutes, kickoff)`.
  2. **Idempotency pre-check:** `getLatestEvidenceSnapshot(fixtureId)`; if a snapshot for this `captureWindowKey`/`capturedBy` already exists, **skip** (report `duplicate`).
  3. Derive `sequence = nextEvidenceSequence(fixtureId)`; build `CreateEvidenceSnapshotInput` (quantized `capturedAt`, `capturedBy = "evidence_capture"`, `supportedMarkets` from `markets.ts`, `modelProbability`, optional `bestOddsSnapshot` when odds present, `signals` from qualified evidence).
  4. `createEvidenceSnapshot(...)`; on `{ok:false}` log + count `invalid` (never throw).
  5. `appendEvidenceSnapshot(snapshot)`; treat `duplicate:true` as success, `immutable_violation` as an alert-worthy anomaly, `write_failed` as retryable.
- **Immutable-snapshot semantics:** rely entirely on the Sprint 23 append rules (deterministic id + content hash). Capture never overwrites.
- **Acceptance:** two capture runs over the same window produce exactly one snapshot per fixture; a second window (config change) never rewrites the first.

### Phase 4 — Fixture completion detection & deterministic settlement
- **NEW** `lib/evidence-capture/outcomes.ts` — pure mapping from `FootyMatchRow` (`status`, `isFinished`, `listResult`) + `listSettleState` to `{ state: ValidationState, reasonCode: ValidationReasonCode, settledAt }`:
  - `won`/`lost` → `settled_result`.
  - `postponed` → `fixture_postponed` (from `listSettleState`/`isMatchPostponed`).
  - `cancelled`/`abandoned`/`void` → mapped from explicit `FootyMatchRow.status` values **(Blocker #2 — coverage decision)**.
  - not finished → `pending` / `awaiting_result` (no record written, or a pending record per decision).
- **NEW** `lib/evidence-capture/settlement.ts` — `settleFixture(fixtureId, row)`:
  1. Load latest snapshot; for each `supportedMarket`, compute the outcome via `outcomes.ts` (mapping market→tab through `markets.ts`).
  2. `validationId({snapshotId, marketKey, selectionKey})`; determine `revision` from existing revisions (`getValidationRevisions`). Only append when the outcome **differs** from the current revision (corrections use `settlement_correction`/`data_correction`, incrementing revision + `supersedesRevisionId`).
  3. Build `ValidationRecord` and `appendValidationRecord(...)`; idempotent on `(revisionId, contentHash)`.
- **Void/postponed/cancelled/abandoned handling:** written as terminal-but-unscored states per `validation.ts`; downstream accuracy/ROI must exclude them (they are **not** losses).
- **Acceptance:** re-running settlement on an unchanged result is a no-op; a genuine correction appends exactly one new revision; non-scored states are recorded with the correct reason code.

### Phase 5 — Retry, recovery & cron integration
- **EDIT** `lib/jobs/types.ts` — extend `JobType` with `"evidence_capture" | "prediction_settlement"`.
- **EDIT** `lib/jobs/runner.ts` — add `runEvidenceCaptureJob(opts?)` and `runPredictionSettlementJob(opts?)`, each via `runWithLock(...)` (advisory-lock serialized), returning `RefreshJobRecord` with `resultCounts` (`captured`, `duplicate`, `invalid`, `failed` / `settled`, `corrected`, `pending`, `skipped`). Failures return `status:"failed"` + `errorCode` so the cron surface retries/alerts.
- **NEW** `app/api/internal/cron/evidence-capture/route.ts` — mirror `evidence-prepare/route.ts`: `handleCronPost(req, () => runEvidenceCaptureJob())`. Flag-gated (returns skipped when `EVIDENCE_CAPTURE_ENABLED` is off).
- **NEW** `app/api/internal/cron/prediction-settlement/route.ts` — same shape for settlement.
- **Retry/recovery:** capture is idempotent (Phase 3), settlement is revision-aware (Phase 4), both lock-serialized; a crashed or duplicate run is safe to re-fire. `write_failed` is transient-retryable; `immutable_violation` is escalated, never retried blindly.
- **Cron registration (config):** add two schedules alongside the existing `evidence-prepare`/`odds-refresh` entries in the deploy cron configuration (`deploy/*` — exact file to confirm during implementation). Capture runs frequently near kickoffs; settlement runs post-kickoff on a cadence.
- **Acceptance:** both routes enforce `cronAccess` + rate limit; concurrent invocations one wins / one `skipped:lock_unavailable`.

### Phase 6 — PostgreSQL schema, migration & adapter (hybrid, not yet cut over)
- **NEW** `db/migrations/20260728_create_evidence_archive.sql` — two additive, forward-only tables mirroring the `published_accas` migration style:
  - `evidence_snapshots` — PK `id TEXT` (`^evs_[0-9a-f]{24}$` check), `fixture_id BIGINT NOT NULL`, `sequence INTEGER NOT NULL`, `captured_at TIMESTAMPTZ NOT NULL`, `content_hash TEXT NOT NULL`, JSONB payload columns (`signals`, `supported_markets`, `operator_availability`, `best_odds_snapshot`), scalar mirrors (`evidence_score NUMERIC`, `qualification`, `model_version`, `schema_version`, `status`, `previous_snapshot_id`, `captured_by`). **`UNIQUE (fixture_id, sequence)`** and **`UNIQUE (id)`** enforce append-only identity at the storage layer.
  - `evidence_validations` — PK `revision_id TEXT`, logical `id TEXT`, `revision INTEGER`, `supersedes_revision_id`, `snapshot_id`, `fixture_id BIGINT`, `market_key`, `selection_key`, `state`, `reason_code`, `settled_at`, `recorded_at`, `content_hash`, `schema_version`. **`UNIQUE (revision_id)`**, **`UNIQUE (id, revision)`**; index on `fixture_id`.
  - Header documents invariants + reverse path (`DROP TABLE ...`), per convention. Not executed by the sprint; applied via runbook.
- **NEW** `lib/archive/evidence/postgres.ts` — `createPostgresEvidenceArchive(connectionString)` implementing `EvidenceArchiveStore` exactly, mirroring `acca-publication/adapters/postgres.ts`: `Pool`, `INSERT ... ON CONFLICT` mapped to the append rules (conflict + same hash → `duplicate`; conflict + different hash → `immutable_violation`), row mappers with `iso()`/JSONB parsing, SQLSTATE `23505` handling, never leaks SQL. `nextSequence` via `MAX(sequence)+1` (advisory-lock serialized by the job runner; concurrent writers also guarded by the `UNIQUE (fixture_id, sequence)` constraint).
- **EDIT** `lib/archive/evidence/service.ts:createDefaultStore()` — add a `postgres` branch when `EVIDENCE_ARCHIVE_ADAPTER === "postgres"` **and** `EVIDENCE_DATABASE_URL` is set; otherwise fall through to file (NDJSON). **Default stays NDJSON** until Postgres is verified (hybrid).
- **NEW/EDIT tests** for the adapter (structural + against a disposable pg per the rehearsal harness).
- **Acceptance:** adapter passes the same store-contract suite as file/memory; migration rehearses clean; cutover is a single env flip, reversible.

### Phase 7 — Accuracy / ROI / calibration readiness
- Confirm the downstream calibration/analytics surfaces consume `ValidationRecord` + `bestOddsSnapshot`/`modelProbability` from the archive (read-only; **no new modeling in this sprint**). If a thin read/aggregation helper is missing, add `lib/evidence-capture/diagnostics.ts` counts + a documented query path — do **not** compute ROI/calibration numbers here; just make the data reachable.
- **Non-scored exclusion** (`void/cancelled/postponed/abandoned`) is honored per `validation.ts`.
- **Acceptance:** for a settled fixture, history view (`getEvidenceHistoryView`) shows the snapshot + terminal validation; the data required for hit-rate/ROI/calibration is present and correctly typed.

### Phase 8 — API / History UI compatibility
- **No contract changes.** The Postgres adapter must satisfy `EvidenceArchiveStore` byte-for-byte so `app/api/evidence/*` and the fixture history UI work unchanged. Verify all four API routes read through `service.ts` (not a store directly).
- **Acceptance:** with real captured/settled data, `app/api/evidence/{history,latest,validation,diagnostics}` return populated payloads and the fixture-page history section renders.

### Phase 9 — Diagnostics & health reporting
- **NEW** `lib/evidence-capture/diagnostics.ts` — per-run summary (fixtures considered, captured, duplicates, invalid, settled, corrections, pending, skipped, last-success timestamps) surfaced through the existing job `resultCounts` + metrics (`metrics.increment/timing`, following runner conventions). Optionally extend `app/api/evidence/diagnostics/route.ts` with capture/settlement freshness.
- **Acceptance:** a stale or failing pipeline is visible (counts + last-success age) without reading logs.

### Phase 10 — Tests, docs, runbooks
- Test matrix (§ below). Docs: **NEW** `docs/evidence-capture-settlement.md` (architecture + operations) and **NEW/EDIT** `docs/migration-runbook.md` entry for the evidence migration + rehearsal + rollback. Update `docs/product-sprint-plan.md` with a Sprint 23B entry on completion.

---

## 4. Acceptance criteria (sprint-level)

1. A cron-triggered capture run writes real `EvidenceSnapshot` rows for **published daily-list predictions**, keyed on the confirmed numeric fixture id, within the pre-kickoff window — and re-running it writes **nothing new**.
2. A cron-triggered settlement run writes terminal `ValidationRecord`s (`won/lost` + non-scored states) after fixture completion — and re-running it is a no-op; genuine corrections append exactly one new revision.
3. Evidence History, `latest`, `validation`, and `diagnostics` API routes and the fixture-page history section render populated, correct data with **no contract changes**.
4. NDJSON writes go to the `EVIDENCE_ARCHIVE_DIR` shared directory and survive a release swap; **no evidence path depends on `process.cwd()` in production**.
5. The PostgreSQL migration rehearses clean; the Postgres adapter passes the store-contract suite; the archive still defaults to NDJSON (hybrid) with cutover behind a single reversible env flip.
6. No Acca capture is introduced. Contracts (`types/evidence/*`, `lib/archive/evidence/store.ts`) are unchanged unless a concrete incompatibility is demonstrated (none found so far).
7. Both cron routes enforce cron access + rate limit + advisory-lock serialization and fail closed (skipped) when their feature flag is off.

---

## 5. Test matrix

| Area | Test | Type | Key assertion |
|---|---|---|---|
| Shared dir | `EVIDENCE_ARCHIVE_DIR` honored; falls back safely; path independent of cwd | unit | writes land in configured dir |
| Source discovery | daily list → normalized predictions; Accas excluded | unit | deterministic; daily-list only |
| Identity | `numericFixtureId` + `captureWindowKey` stable across runs | unit | same coordinates → same id |
| Capture — happy | in-window prediction → one snapshot | unit | `appended:true` once |
| Capture — idempotency | re-run same window | unit | second run `duplicate`/skip, no new row |
| Capture — window gate | outside `[kickoff−lead, kickoff)` | unit | no capture |
| Capture — invalid input | `createEvidenceSnapshot` rejects | unit | counted `invalid`, no throw |
| Capture — immutable | same id, different hash | unit | `immutable_violation`, escalated |
| Settlement — won/lost | finished result | unit | correct `state`/`reasonCode`/`settledAt` |
| Settlement — postponed | `isMatchPostponed` | unit | `postponed` + `fixture_postponed` |
| Settlement — void/cancelled/abandoned | status mapping (per Blocker #2) | unit | correct non-scored state |
| Settlement — idempotency | re-run unchanged | unit | no new revision |
| Settlement — correction | outcome changes | unit | one new revision, `supersedesRevisionId` set |
| Cron capture route | access/rate-limit/flag-off/lock | integration | 401/429/skipped/200 paths |
| Cron settlement route | same | integration | same |
| Runner | `runEvidenceCaptureJob`/`runPredictionSettlementJob` result counts | unit | counts + status mapping |
| PG adapter | full `EvidenceArchiveStore` contract | integration (disposable pg) | parity with file/memory |
| PG conflict | duplicate vs immutable-violation via `ON CONFLICT` | integration | matches append rules |
| Migration | rehearsal applies clean; idempotent (`IF NOT EXISTS`) | rehearsal | no error, constraints present |
| API/UI compat | routes + history view with real data | integration | populated, typed payloads |
| Accuracy/ROI/calibration readiness | non-scored states excluded; odds/prob present | unit | data reachable & correct |

Regression: full `tests/evidenceArchive.test.ts` and the existing jobs/cron suites must stay green.

---

## 6. Environment variables

| Var | New? | Purpose | Default |
|---|---|---|---|
| `EVIDENCE_ARCHIVE_DIR` | **new** | Persistent shared dir for NDJSON archive (never release-local) | shared default (`/opt/rankwagers/shared/evidence-archive`), dev-only cwd fallback |
| `EVIDENCE_ARCHIVE_ADAPTER` | existing (extended) | `memory` \| `file` \| **`postgres`** | `file` (NDJSON) |
| `EVIDENCE_DATABASE_URL` | **new** | Postgres connection for the evidence adapter | unset (adapter inactive) |
| `EVIDENCE_CAPTURE_ENABLED` | **new** | Master flag for capture cron/job | `false` |
| `EVIDENCE_SETTLEMENT_ENABLED` | **new** | Master flag for settlement cron/job | `false` |
| `EVIDENCE_CAPTURE_LEAD_MINUTES` | **new** | Pre-kickoff capture window lead | e.g. `60` |
| `EVIDENCE_CAPTURE_MAX_FIXTURES` | **new** | Per-run safety cap | e.g. `500` |
| `CRON_SECRET` / `ENABLE_CRON` | existing | Cron auth/enable (reused) | as configured |
| `JOB_LOCK_ADAPTER` + `SNAPSHOT_/ATTRIBUTION_/ODDS_HISTORY_DATABASE_URL` | existing | Advisory-lock backend (reused) | as configured |

All new vars documented in `.env.example` (commented, additive).

---

## 7. Risks & safeguards

| Risk | Safeguard |
|---|---|
| **Wrong fixture id** (matchId vs string fixtureId) silently orphans evidence from the fixture page | Single choke-point `identity.numericFixtureId`; Blocker #1 confirmed before Phase 3; integration test asserts history renders on the fixture URL |
| **Idempotency drift** — capturedAt from `Date.now()` accretes duplicate snapshots | Quantized `capturedAt` via `captureWindowKey` + pre-check on latest snapshot; deterministic id makes re-runs dedupe |
| **Release-local data loss** | Phase 1 shared-dir fix ships first; no prod path uses `process.cwd()` |
| **Concurrent writers interleave** (NDJSON `appendFile` non-transactional, documented in file.ts) | Advisory-lock serialization in runner; Postgres `UNIQUE (fixture_id, sequence)` as the durable backstop |
| **Settlement miscounts non-scored as losses** | Explicit `outcomes.ts` mapping; downstream exclusion per `validation.ts`; dedicated tests |
| **Premature Postgres cutover** | Hybrid: default NDJSON; cutover only after migration + runtime verification; single reversible env flip |
| **Cron abuse / double-fire** | `cronAccess` + rate limit + lock; flags fail closed |
| **Scope creep into Accas / contract redesign** | Source is daily-list only; contracts untouched; this doc gates any change on a demonstrated incompatibility |

---

## 8. Recommended implementation order

1. **Phase 0** config + `.env.example` (flags off).
2. **Phase 1** shared-dir NDJSON fix (data-safety first).
3. **Phase 2** source discovery + identity + market mapping.
4. **Phase 3** capture (idempotent) + tests.
5. **Phase 4** settlement + outcome mapping + tests.
6. **Phase 5** job types + runner + two cron routes.
7. **Phase 9** diagnostics/health (small, enables safe rollout).
8. **Phase 6** Postgres migration + adapter + service branch (still defaulting to NDJSON).
9. **Phase 7 + 8** accuracy/ROI/calibration readiness + API/UI compatibility verification.
10. **Phase 10** tests sweep, docs, runbooks.

Rollout: ship 1–2 first (safe, no behavior change) → enable capture on staging with flags → verify NDJSON data + history UI → enable settlement → rehearse + apply migration → run Postgres adapter in shadow/verify → flip `EVIDENCE_ARCHIVE_ADAPTER=postgres`.

---

## 9. Deployment & rollback sequence

**Deploy**
1. Merge Phases 0–1; deploy. Set `EVIDENCE_ARCHIVE_DIR` to the shared path. No behavior change (flags off).
2. Deploy Phases 2–5 + 9. Keep `EVIDENCE_CAPTURE_ENABLED`/`EVIDENCE_SETTLEMENT_ENABLED` **off**.
3. On staging: enable capture flag; run the capture cron over a known date; verify snapshots in `EVIDENCE_ARCHIVE_DIR` + fixture history UI.
4. Enable settlement flag; run settlement cron after fixtures finish; verify validations + non-scored handling.
5. `npm run ops:backup` → `npm run ops:migrate-rehearse` → apply `20260728_create_evidence_archive.sql` per runbook.
6. Deploy Postgres adapter; run in shadow (adapter available, still `file` default); verify contract parity.
7. Flip `EVIDENCE_ARCHIVE_ADAPTER=postgres`; monitor diagnostics + metrics for one full capture→settlement cycle.

**Rollback**
- **Flags:** set `EVIDENCE_CAPTURE_ENABLED`/`EVIDENCE_SETTLEMENT_ENABLED=false` — pipeline stops immediately; archive/UI unaffected (append-only data remains valid).
- **Adapter:** set `EVIDENCE_ARCHIVE_ADAPTER=file` — instantly reverts to NDJSON (still populated during hybrid). No data mutation.
- **Cron routes:** remove the two deploy schedule entries.
- **Migration:** forward-only; documented reverse path is `DROP TABLE evidence_validations; DROP TABLE evidence_snapshots;` (additive tables, nothing else depends on them). NDJSON remains the source of truth until cutover is confirmed.
- **Code:** Phases are independent; revert Phase 6 without touching 1–5.

---

## 10. Unresolved blockers & ambiguities

1. **[BLOCKING] Authoritative numeric fixture id.** `EvidenceSnapshot.fixtureId` is a positive integer; the daily-list side exposes `matchId: number` (and a *string* `fixtureId`). Confirm that `matchId` (FootyStats match id) is the id the **fixture history page and existing archive** key on. If the fixture page uses a different numeric id, capture must map to that instead. *Recommended assumption: `matchId`.* Must be confirmed before Phase 3.
2. **[DECISION] Non-scored settlement coverage.** `listSettleState` emits only `won/lost/pending/postponed`. `void`, `cancelled`, `abandoned` require additional detection from `FootyMatchRow.status`. Decide: implement full mapping now, or ship `postponed`-only initially and defer the rest (contract already supports all). *Recommended: implement the full `outcomes.ts` mapping now, since the states already exist in the contract.*
3. **[DECISION] Market/selection granularity.** Daily-list settlement is per-`MatchListKind` "tab"; snapshots carry `supportedMarkets` keyed by `(marketKey, selectionKey)`. Confirm the canonical `MatchListKind ↔ (marketKey, selectionKey)` mapping (`markets.ts`) — specifically whether each daily-list prediction maps to exactly one primary market/selection.
4. **[CONFIRM] Cron scheduling location.** The external scheduler config that registers `evidence-prepare`/`odds-refresh` (under `deploy/*`) was not opened during planning; confirm the exact file to add the two new schedules.
5. **[MINOR] Signals/odds provenance for capture.** Confirm which fields on `QualifiedFixture`/`ComboSelection` populate `signals[]` and `bestOddsSnapshot` at capture time (odds may be absent → `bestOddsSnapshot: null`, which the contract already permits).

None of these require redesigning Sprint 23. #1 is the only hard blocker for starting Phase 3; #2–#3 are product/taxonomy confirmations that can be resolved at the top of their phases.

---

## 11. Files inspected during planning

`lib/archive/evidence/{store,service,index,schema,file}.ts`, `lib/evidence/{snapshot,identifiers}.ts`, `types/evidence/validation.ts`, `lib/jobs/{cronHandler,types,runner,locks}.ts`, `app/api/internal/cron/evidence-prepare/route.ts`, `lib/acca-publication/adapters/postgres.ts`, `lib/acca-publication/store.ts`, `lib/snapshots/refresh.ts` (head), `lib/combo/{candidates,types}.ts`, `lib/footystats/{listSettle,dailyArchive}.ts` (+ exports of `predictionWin`, `types`), `lib/research/qualifiedFixture.ts` (ref), `db/migrations/20260728_create_published_accas.sql`, `.env.example`. Directory-level surveys of `lib/archive/evidence`, `lib/evidence`, `types/evidence`, `app/api/evidence`, `app/api/internal/cron`, `db/migrations`, `lib/combo`, `lib/snapshots`.

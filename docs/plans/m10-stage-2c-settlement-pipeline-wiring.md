# M10 Stage 2C — Settlement Pipeline Wiring (Implementation Record)

**Document type:** Implementation-stage record (Stage 2C of M10).
**Date:** 2026-07-30
**Status:** Stage 2C implemented, **default-off / dormant at the route**. **M10 is NOT complete.**
**Governing spec:** `docs/architecture/m10-live-candidate-pipeline-specification.md` (Rev A1).
**Governing plan:** `docs/plans/m10-stage-2c-settlement-integration-plan.md` (STAGE 2C ARCHITECTURE READY).
**Predecessors:** Stage 2A archive-state (approved), Stage 2B capture wiring (`m10-stage-2b-closure.md` — CLOSED). Stage 2C is the **first-settlement-only settlement mirror** of Stage 2B.

---

## 1. Implemented Scope

The chartered settlement pipeline, wired test-first:

```
Strict Settlement Archive State (Stage 2A: snapshots + validations, one bounded read each)
   → Stage 1 Settlement Provider (buildSettlementCandidates)
      → SettlementCandidate[]
         → M8 Settlement Batch Runner (runPredictionSettlementJob → runSettlementBatch → settleLatestSnapshotForFixture)
```

Delivered:
1. **Strict whole-archive validation reader** — `readAllValidationsStrict(env?)` (`lib/archive/evidence/file.ts`), the settlement-axis mirror of `readAllSnapshotsStrict`, reusing the existing private `readNdjson`.
2. **Concrete read port** — `createFileSettlementReadPort(env?)` satisfying the Stage-2A `SettlementArchiveReadPort` from `readAllSnapshotsStrict` + `readAllValidationsStrict`, both from the same evidence dir.
3. **Settlement producer** — `produceSettlementRequests(deps, config)`: loads completed rows + builds settlement archive state (concurrently, one bounded read each), runs the Stage-1 provider, returns the existing `SettlementProviderResult`.
4. **Runner seam** — optional `provideCandidates?: () => Promise<readonly SettlementCandidate[]>` on `runPredictionSettlementJob`, invoked **inside** the held `job:prediction_settlement` durable lock.
5. **Tests** — `tests/evidenceSettlementPipeline.test.ts` (26).
6. **This record.**

---

## 2. Explicitly Excluded Scope

Confirmed absent (route dormant, no leakage, no M8 change):

- **Correction discovery** — no `currentValidationHeads` consumption, no `correctionCause` production, no correction policy, no reinterpretation of an existing head. (§7 firewall.)
- **Live activation** — the cron route is unchanged; nothing composes `provideCandidates` in production; the completed-rows source loader is an injected dormant seam (no live default — BQ-1).
- **Deadline enforcement (INV-D)**, **diagnostics aggregation**, **replay/concurrency machinery** — all deferred.
- **Capture-path change** — `capture-pipeline.ts` and `runEvidenceCaptureJob` untouched.
- **Cron / flag / scheduler / config / schema / migration / deployment change** — none.
- The existing **unlock-throw false-500 (H-1)** is NOT addressed here — carried forward to Stage 2E.

---

## 3. File-Level Change Set

**Created:**
- `lib/evidence-capture/candidates/settlement-pipeline.ts` — `createFileSettlementReadPort`, `produceSettlementRequests`, `SettlementPipelineDeps`/`SettlementPipelineConfig`. Server-only; **not** re-exported from the client-safe `candidates/index.ts` barrel.
- `tests/evidenceSettlementPipeline.test.ts` — 26 tests.
- `docs/plans/m10-stage-2c-settlement-pipeline-wiring.md` — this record.

**Modified (additive, behaviour-preserving):**
- `lib/archive/evidence/file.ts` — added `readAllValidationsStrict(env?)` (reuses `readNdjson`; no interface change, no change to existing exports/store).
- `lib/jobs/runner.ts` — added optional `provideCandidates?` to `runPredictionSettlementJob`, invoked inside `runWithLock`; `candidates ?? []` fallback preserved.

**No other files changed.** Not modified: `lib/evidence-capture/settlement.ts` (M8), `lib/evidence-capture/jobs/settlement-run.ts`, the Stage-1 provider / eligibility / archive-state modules, `types/evidence/*`, `ValidationRecord`, archive schemas, the cron route (`app/api/internal/cron/prediction-settlement/route.ts` — verified unchanged), flags, config, locks, scheduler, environment, database migrations, deployment.

---

## 4. Call Chain

```
runPredictionSettlementJob(options?)                                   runner.ts
  ├─ isSettlementEnabled(env) === false ─► flagSkippedJob (409, NO lock, NO discovery)
  └─ runWithLock("prediction_settlement", fn)        (fn runs only after the lock is held)
       ├─ deps = options.deps ?? { getEvidenceArchiveStore() }
       ├─ candidates =                                                 (NEW seam, INSIDE lock)
       │     options.provideCandidates ? await options.provideCandidates()   ← INV-L
       │                                : (options.candidates ?? [])          ← M9 static / empty
       └─ runSettlementBatch(deps, candidates)                        (frozen C3/C4 → M8)

provideCandidates is composed by the caller from the producer:
  produceSettlementRequests(deps, config)              settlement-pipeline.ts
    ├─ readPort = deps.readPort ?? createFileSettlementReadPort()
    │     └─ { readAllSnapshots: () => readAllSnapshotsStrict(env)
    │        readAllValidations: () => readAllValidationsStrict(env) }
    ├─ Promise.all([ deps.loadCompletedRows(date), buildSettlementArchiveState(readPort) ])
    └─ buildSettlementCandidates({ completedRows, evaluationInstant, archiveState, config, deps })
           → SettlementProviderResult { candidates: SettlementCandidate[], diagnostics }
```

`correctionCause` is never set; `currentValidationHeads` is never read.

---

## 5. Strict Read-Port Design

- **`readAllValidationsStrict`** reuses `readNdjson<ValidationRecord>(evidenceArchivePaths(env).validations)`: ENOENT ⇒ `[]`; malformed line / EACCES/EPERM / EIO/EBUSY / any other errno ⇒ **throw**. Like the store's own `listValidations`, it does not re-verify each record hash — same-id/different-hash and ambiguous-`(validationId, revision)` conflicts are surfaced one layer up by the Stage-2A normalizer's `ArchiveStateConflictError`.
- **Module-level export, not an interface method** — mirrors the Stage-2B decision; no memory adapter / test double breaks.
- **`createFileSettlementReadPort`** composes both readers from the same `evidenceArchivePaths(env)` (both files under one evidence dir). Simpler than capture: settlement never touches the separate `odds-archive/` dir, so the capture eager/lazy path asymmetry (2B NB-2) does not arise.
- **Single bounded read per store (PB-1):** `buildSettlementArchiveState` calls each reader once (`Promise.all`); no per-fixture `listSnapshots`/`listValidations` loop, no O(F²).
- **Not fail-soft:** reads come directly from `file.ts`, never `service.ts`/`getEvidenceArchiveStore()` (whose `archive_unavailable` empty view would mask a corrupt archive as "nothing settled"). A throw propagates → run `failed`.

---

## 6. Lock-Boundary Proof

- **Discovery inside the lock (INV-L).** `provideCandidates()` is awaited inside the `fn` passed to `runWithLock("prediction_settlement", …)`, which runs only after `tryAcquireJobLock` returns a held lock. Proven: *runner: lock unavailable → skipped, producer never called* (pre-acquire `job:prediction_settlement` → job `skipped`/`lock_unavailable`, `calls === 0`).
- **Flag-skip precedes lock + discovery.** `isSettlementEnabled` short-circuits to `flagSkippedJob` before `runWithLock`. Proven: *disabled settlement flag → skipped, producer never called*.
- **Distinct lock key.** `job:prediction_settlement`, never shares capture's `job:evidence_capture`; durable, prod fail-closed; no memory fallback.
- **Callback invoked exactly once, threaded to the batch.** Proven: *provideCandidates invoked once inside the lock, threaded to the batch* (`calls === 1`, batch counts reflect it).
- **Rejection ⇒ `failed`, never empty success.** Proven: *rejecting provideCandidates → failed* (`status:"failed"`, `errorCode:"unhandled"`; lock released in `finally`).
- **No cursor/cache/offset.** Progress (`settledFixtureIds`) is recomputed from the archive each pass; the port is constructed fresh per call. INV-A preserved.
- **Both-input precedence pinned.** When both `candidates` and `provideCandidates` are supplied, `provideCandidates` wins and the static array is ignored. Proven: *both static candidates AND provideCandidates → provideCandidates wins* (provider path ran, static ignored). Documented at the runner seam.

---

## 7. First-Settlement-Only Firewall

Two independent structural guarantees make a false correction non-representable:

1. **Provider exclusion.** The Stage-1 provider rejects any fixture in `settledFixtureIds` as `already_settled` (`eligibility.ts`), so an already-settled fixture is **never emitted as a candidate** — even if its source outcome changed. Proven: *already-settled fixture → 0 candidates*.
2. **Cause-absent hard stop.** The producer never sets `correctionCause`; if a changed-outcome candidate ever reached M8, `head.state !== outcome.state` with `correctionCause === undefined` returns `invalid_input` and **writes nothing** (`settlement.ts`). Proven end-to-end: *false-correction impossibility — causeless changed outcome → M8 invalid_input, no append*.

Additional firewall facts (tested): `correctionCause` is absent on every produced candidate (*captured terminal fixture → correctionCause absent*, *BF-S1 terminals → correctionCause undefined*); `currentValidationHeads` is not consumed (static source scan: *settlement-pipeline.ts CODE contains no correctionCause and no currentValidationHeads*). M8 remains the authoritative settlement writer and idempotency backstop — no correction logic, no `ValidationRecord`/identity/revision/lineage rule was changed.

---

## 8. Determinism

- The producer reads **no clock**: `evaluationInstant` is injected (drives the provider's `nowSec`); `completionInstant` defaults to the deterministic source-derived kickoff instant (provisional, activation-gated — BQ-2) and may be overridden by an injected deterministic `deriveCompletionInstant`. No `Date.now`, no `Math.random`.
- Identity is discovery-time-independent: settlement identity/revision are derived downstream by frozen M8; the producer supplies only `fixtureId` + the completed row + deterministic instants.
- Order-independent: proven by *deterministic — shuffled completed rows → deep-equal candidate output* (identical archive + rows + instant + config ⇒ byte-equivalent candidate array).

---

## 9. Failure Behaviour

- **Strict-read throw (malformed/IO/conflict)** → `buildSettlementArchiveState` rejects → `produceSettlementRequests` rejects → runner `failed`. Never masked as empty. Proven: *strict validations read throw propagates*, *ArchiveStateConflictError propagates*, and the port-level *malformed / EISDIR → throw* tests.
- **Source-loader rejection** → producer rejects → runner `failed`. Proven: *source-loader rejection propagates*.
- **Provider/producer rejection** → runner `failed` (never an empty successful zero-settlement). Proven: *rejecting provideCandidates → failed*.
- **M8 faults** (write_failed / immutable_violation / invalid_input) remain accounted by the existing `runSettlementBatch` result and the runner's `hardFailed` mapping — unchanged.
- **Committed first settlements are idempotent on retry** — a re-fire re-derives `settledFixtureIds` and the provider excludes the fixture (`already_settled`); no duplicate revision, no correction. Proven: *first settle appends 1 record; retry no duplicate/no correction*.

---

## 10. Tests Added

`tests/evidenceSettlementPipeline.test.ts` — **26 tests** (memory lock backend; injected evaluation instant; no wall clock):

- **Concrete port (6):** missing snapshot + validation files → `[]`; malformed snapshot → throw; malformed validation → throw; snapshot immutable conflict → `buildSettlementArchiveState` throws; validation immutable conflict → throws; non-ENOENT (EISDIR) → throw.
- **Producer (10):** captured terminal → 1 candidate, `correctionCause` absent; read bounds (snap 1 / val 1 / source 1); already-settled → 0; non-terminal (live) → 0; uncaptured → 0; BF-S1 terminals (postponed/cancelled/abandoned) → eligible; strict validations throw → reject; source-loader reject → reject; conflict → reject; determinism (shuffled → deep-equal).
- **Runner seam (6):** invoked once inside the lock + threaded; static path back-compat; rejecting → `failed`; disabled flag → `skipped` no call; lock unavailable → `skipped` no call; both-input precedence pinned (`provideCandidates` wins).
- **Real integration (2):** real producer → provider → 2A builder → memory M8 — first settle appends 1 record, retry no duplicate/no correction; false-correction impossibility (causeless changed outcome → M8 `invalid_input`, no append).
- **Scope guards (2):** no `correctionCause`/`currentValidationHeads` in pipeline code; cron route remains the bare one-line M9 delegate.

---

## 11. Validation Results

| Check | Command | Result |
|---|---|---|
| Stage-2C pipeline | `… --test tests/evidenceSettlementPipeline.test.ts` | **26 pass / 0 fail / 0 skip** |
| Stage-2A archive-state | `… --test tests/evidenceArchiveStateBuilders.test.ts` | **25 / 0 / 0** |
| Stage-1 provider (settlement incl.) | `… --test tests/evidenceCandidateProvider.test.ts` | **48 / 0 / 0** |
| M8 settlement | `… --test tests/evidenceSettlement.test.ts` | **34 / 0 / 0** |
| M9 activation | `… --test tests/m9Activation.test.ts` | **18 / 0 / 0** |
| M9 concurrency / lock | `… --test tests/m9Concurrency.test.ts` | **11 / 0 / 0** |
| Stage-2B capture pipeline | `… --test tests/evidenceCapturePipeline.test.ts` | **9 / 0 / 0** |
| Full suite | `npm test` | **1795 pass / 0 fail / 0 skip** (was 1769; +26) |
| Typecheck | `npm run typecheck` | **clean — exit 0** |
| Lint | `npm run lint` | **clean — no ESLint warnings or errors** |

---

## 12. Carry-Forward to Stage 2D (Operational Controls)

Mirrors the capture-path Stage-2D obligations, now also for settlement:
- INV-D effective deadline ≤ 45 s + mid-batch remaining-time guard (settlement path).
- Default 100 / hard 150 ceilings observed at the call site (provider already fail-safe via `normalizeBatchLimit`).
- Bounded source classification (unbounded `completedRows` compute).
- Producer-stage diagnostics aggregation (the provider's `CandidateDiagnostics` are returned but not merged into `resultCounts`/metrics) + specific failure codes (a rejecting producer surfaces the generic `unhandled`).
- Backlog / oldest-pending observability.
- The concrete **live completed-rows source loader** (BQ-1) — likely a thin filter over `readDailyArchive(date)` for terminal rows — remains an injected dormant seam; wiring it is a live-activation task.

## 13. Carry-Forward to Stage 2E (Safety & Verification / Activation Gates)

- **Unlock-throw false-500 (H-1)** — not addressed here; land the swallow/log at Stage 2E.
- Multi-worker overlap verification (409-not-500, loser does no discovery) for the settlement job.
- Crash/replay matrix; route-wiring tests; representative-depth + RSS/event-loop benchmarks; large-archive capacity gate; fsync/quarantine — all settlement-path analogues of the capture gates.
- **Correction propagation** (the deferred future stage): consume `currentValidationHeads`, detect `head.state ≠ new outcome`, derive a typed `correctionCause` — explicitly out of Stage 2C.

---

## 14. Stage Status

# STAGE 2C IMPLEMENTED — DORMANT FIRST-SETTLEMENT WIRING

The settlement pipeline is wired, reusable, and green, but fires no live candidates in production: the cron route is unchanged and the completed-rows source loader is an injected dormant seam. First-settlement only; corrections and `currentValidationHeads` consumption are deferred; deadline/diagnostics/activation are out of scope. **M10 is NOT complete.**

---

### Statement

Implementation record. No M8, settlement-run, frozen evidence type, `ValidationRecord` contract, archive schema, feature flag, cron route, scheduler, environment, database migration, or deployment was modified. The runtime deltas are two additive functions (`readAllValidationsStrict`, the runner seam), one new server-only pipeline module, and one new test file.

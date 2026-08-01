# M10 Stage 2C — Settlement Pipeline Wiring (Architecture & Integration Plan)

**Document type:** Architecture & integration plan (Stage 2C of M10). **REVIEW & PLANNING ONLY — no runtime code, test, M8, runner, route, flag, config, archive, database, or deployment was modified.** The only file created is this document.
**Date:** 2026-07-30
**Milestone:** Sprint 23B — M10 (Live Candidate Pipeline), **Stage 2C — Settlement Pipeline Wiring**.
**Governing spec:** `docs/architecture/m10-live-candidate-pipeline-specification.md` (Rev A1).
**Predecessors:** Stage 1 settlement provider (approved), Stage 2A archive-state (approved), Stage 2B capture wiring (`m10-stage-2b-capture-pipeline-wiring.md`, `m10-stage-2b-code-integration-review.md` — CODE INTEGRATION APPROVED). Stage 2C is the **settlement mirror** of Stage 2B.

**Code inspected (file:line):** `lib/evidence-capture/candidates/settlement-provider.ts`; `lib/evidence-capture/candidates/eligibility.ts:169-235` (`classifySettlementRow`); `lib/evidence-capture/candidates/archive-state/{types,builders,normalize,index}.ts` (`SettlementArchiveReadPort`, `ValidationReader`, `buildSettlementArchiveState`, `SettlementArchiveState`, `ValidationHead`, `currentValidationHeads`); `lib/evidence-capture/candidates/types.ts`; `lib/evidence-capture/settlement.ts` (M8 `settleSnapshot`/`settleLatestSnapshotForFixture`/`CorrectionCause`/`determineCorrectionReason`); `lib/evidence-capture/jobs/settlement-run.ts` (`runSettlementBatch`, `SettlementCandidate`, C3/C4); `lib/jobs/runner.ts:330-352` (`runPredictionSettlementJob`); `lib/archive/evidence/file.ts` (`readNdjson`, `readAllSnapshotsStrict`, `evidenceArchivePaths.validations`); `lib/evidence-capture/config.ts`; `tests/evidenceSettlement.test.ts`, `tests/m9Activation.test.ts`, `tests/m9Concurrency.test.ts`.

---

## 1. Executive Summary

Stage 2C wires the settlement producer into the M9 settlement runner, **structurally identical to the approved Stage 2B capture wiring** but on the settlement axis:

```
Strict settlement archive read (snapshots + validations, single bounded read each)
  → buildSettlementArchiveState  (Stage 2A, unchanged)
  → buildSettlementCandidates    (Stage 1 provider, unchanged)
  → SettlementCandidate[]
  → runSettlementBatch → settleLatestSnapshotForFixture (frozen M8)
```

The wiring is invoked **inside the held durable lock** via a new optional `provideCandidates` seam on `runPredictionSettlementJob`, exactly mirroring `runEvidenceCaptureJob`. The route stays **unchanged and dormant** (M9 empty-safe pass).

**The single genuinely-new concern — corrections — is resolved by scoping them OUT.** Stage 2C is **first-settle only**: the Stage-1 provider already rejects any fixture in `settledFixtureIds` (`already_settled`, `eligibility.ts:181`), so an already-settled fixture is **never emitted as a candidate**, and Stage 2C **hardcodes `correctionCause` absent**. M8's correction path is therefore structurally unreachable, and any changed-outcome fixture that could ever slip through fails **closed** to `invalid_input` (no write) rather than producing a false correction (`settlement.ts:299-308`). Genuine correction propagation (which would consume `currentValidationHeads` to detect `head.state ≠ new outcome` and set a typed cause) is explicitly deferred to a later stage.

**Only two small runtime deltas are required:** (1) add a module-level `readAllValidationsStrict(env?)` to `lib/archive/evidence/file.ts` (one-line mirror of `readAllSnapshotsStrict`, reusing `readNdjson`); (2) add the optional `provideCandidates` seam to `runPredictionSettlementJob`. Plus one new server-only pipeline module and one new test file. **No M8 change, no store-interface change, no new archive field, no cursor, no deadline, no diagnostics aggregation.**

**Verdict: STAGE 2C ARCHITECTURE READY.** Coding may begin. The one open item (the concrete live *completed-rows* source loader) has a safe default — leave it a required injected seam, dormant — requiring no external decision.

---

## 2. Existing Settlement Substrate

Verified present, frozen, and dormant:

| Layer | Symbol | State | Role |
|---|---|---|---|
| Stage-1 provider | `buildSettlementCandidates(input)` (`settlement-provider.ts:75`) | BUILT, pure | classify → dedup(per-fixture) → order → cap → `SettlementCandidate[]` + diagnostics |
| Classifier | `classifySettlementRow(row, ctx)` (`eligibility.ts:169`) | BUILT, pure | reuses `resolveMatchLifecycle`; rejects `already_settled`/`missing_prediction_identity`/`fixture_not_complete`/…; BF-S1 terminals eligible |
| Archive-state | `buildSettlementArchiveState(port)` (`archive-state/builders.ts:53`) | BUILT (Stage 2A), pure | one bounded read of snapshots + validations → `{capturedFixtureIds, settledFixtureIds, currentValidationHeads?}` |
| Read-port type | `SettlementArchiveReadPort = SnapshotReader & ValidationReader` (`archive-state/types.ts:50`) | BUILT | `readAllSnapshots()` + `readAllValidations()` |
| M9 batch runner | `runSettlementBatch(deps, candidates)` (`settlement-run.ts:124`) | BUILT, dormant | enforces C3 (fixture correspondence) + C4 (score sanity), calls frozen M8, folds summary into counts |
| Frozen M8 core | `settleLatestSnapshotForFixture` / `settleSnapshot` (`settlement.ts:364,191`) | FROZEN | read-decide-append revision-aware settlement; `no_change`/first-settle/correction all internal |
| Runner job | `runPredictionSettlementJob(options?)` (`runner.ts:330`) | BUILT, dormant | flag gate (C2) → durable lock (C1) → `runSettlementBatch(deps, candidates ?? [])` |
| Adapter reader | `readAllSnapshotsStrict(env)` (`file.ts:147`) | BUILT (Stage 2B) | strict whole-archive snapshots read |
| Adapter reader | `readAllValidationsStrict(env)` | **MISSING** | strict whole-archive validations read — **the only adapter gap** |

**Crucial M8 property (the reason Stage 2C is safe and small):** `settleSnapshot` reads the fixture's validations from the store itself (`store.listValidations` → `currentValidationRevisions` → `current.get(vid)` = per-market head, `settlement.ts:230-267`) and decides, per market:
- `!head` → **first settle** (`createValidationRecord`) — needs no `correctionCause`;
- `head.state === outcome.state` → **`no_change`**, no append (absorbs duplicate / unchanged-result re-fires);
- `head.state !== outcome.state` → **correction**, which **requires an explicit `correctionCause`** or fails closed to `invalid_input` (`settlement.ts:299-308`).

So M8 owns the head derivation and the no_change/correction decision. The provider's `currentValidationHeads` is **not** what M8 consumes; it is the reserved MC-1 enrichment for a *future* correction-detecting producer.

---

## 3. Proposed Call Chain

New server-only module `lib/evidence-capture/candidates/settlement-pipeline.ts` (sibling to `capture-pipeline.ts`):

```
runPredictionSettlementJob(options?)                                   runner.ts:330
  ├─ isSettlementEnabled(env) === false ─► flagSkippedJob (409, NO lock, NO discovery)
  └─ runWithLock("prediction_settlement", fn)         (fn runs only after lock is held)
       ├─ deps = options.deps ?? { getEvidenceArchiveStore() }
       ├─ candidates =                                                 (NEW seam, INSIDE lock)
       │     options.provideCandidates ? await options.provideCandidates()
       │                                : (options.candidates ?? [])   ← M9 static / empty pass
       └─ runSettlementBatch(deps, candidates)                        (frozen C3/C4 → M8)

provideCandidates is composed by the caller from the producer:
  produceSettlementRequests(deps, config)              settlement-pipeline.ts (NEW)
    ├─ loadCompletedRows(date)                          ← REQUIRED injected seam (live source deferred)
    ├─ readPort = deps.readPort ?? createFileSettlementReadPort(env)   (NEW factory fn)
    │     └─ { readAllSnapshots:  () => readAllSnapshotsStrict(env)
    │        readAllValidations: () => readAllValidationsStrict(env) }  ← NEW reader
    ├─ Promise.all([ loadCompletedRows(date), buildSettlementArchiveState(readPort) ])
    └─ buildSettlementCandidates({ completedRows, evaluationInstant, archiveState, config, deps })
           → SettlementProviderResult { candidates: SettlementCandidate[], diagnostics }
```

`correctionCause` is **never set** on any produced `SettlementCandidate` (first-settle only). `currentValidationHeads` is **not consumed**.

---

## 4. Lock Boundary

Identical guarantee to Stage 2B, verified against `runner.ts`:

- **Discovery inside the lock (INV-L).** `provideCandidates()` is awaited inside the `fn` passed to `runWithLock("prediction_settlement", …)`; `fn` runs only after `tryAcquireJobLock` returns a held lock (`runner.ts:74-99`). Lock-fail ⇒ `skipped`, `fn` never invoked.
- **Flag-skip precedes lock + discovery.** `isSettlementEnabled(env)` short-circuits to `flagSkippedJob` before `runWithLock` (`runner.ts:336-338`).
- **Distinct lock key.** `job:prediction_settlement` — never shares capture's `job:evidence_capture` (C1). Both are durable (prod fail-closed on `EVIDENCE_DATABASE_URL`).
- **Producer rejection ⇒ `failed`, never empty success.** A rejected `provideCandidates()` throws inside `fn` → caught by `runWithLock` → `failed`/`unhandled`, lock released in `finally`. A corrupt strict read therefore never becomes a silent "no work" pass.
- **No cursor/cache/offset.** Progress (`settledFixtureIds`) is recomputed from the archive each pass; the port is constructed fresh per `produceSettlementRequests` call. INV-A preserved.

---

## 5. Strict Read-Port Design

### 5.1 Adapter delta (the only file.ts change)
Add, symmetric to `readAllSnapshotsStrict`:

```
export async function readAllValidationsStrict(
  env: NodeJS.ProcessEnv = process.env
): Promise<ValidationRecord[]> {
  return readNdjson<ValidationRecord>(evidenceArchivePaths(env).validations);
}
```

- Reuses the **existing** private `readNdjson` (ENOENT⇒`[]`; malformed/EACCES/EPERM/EIO/other⇒throw). **No new parser, no duplicate read path.**
- Module-level export (like `readAllSnapshotsStrict`) — **not** added to the `EvidenceArchiveStore` interface, so no memory adapter / test double breaks (matches the Stage-2B decision).
- `evidenceArchivePaths(env).validations` already exists (`file.ts:68`).

### 5.2 Concrete port
```
export function createFileSettlementReadPort(
  env: NodeJS.ProcessEnv = process.env
): SettlementArchiveReadPort {
  return {
    readAllSnapshots:  () => readAllSnapshotsStrict(env),
    readAllValidations: () => readAllValidationsStrict(env),
  };
}
```

- **Single bounded read per store (PB-1):** `buildSettlementArchiveState` calls each reader once (`builders.ts:56-58`, `Promise.all`).
- **Same archive dir, no divergence:** both readers resolve via the *same* `evidenceArchivePaths(env)` (both files under one evidence dir). **Simpler and safer than capture** — settlement touches only the evidence archive, never the separate `odds-archive/` dir, so the eager/lazy path asymmetry flagged for capture (2B NB-2) does **not** arise here. Both paths are resolved lazily at read time from the same `env`.
- **Not wrapped by fail-soft service helpers:** reads come directly from `file.ts`, never `getEvidenceArchiveStore()`/`service.ts` (whose fail-soft `archive_unavailable` empty view must be bypassed). A throw propagates.
- **Fail-closed depth:** `readNdjson` throws on malformed JSON / IO but does **not** re-verify each record's content hash (same as M8's own `listValidations` read). Same-id/different-hash conflicts and ambiguous `(validationId, revision)` are caught one layer up by Stage 2A's normalizer (`normalize.ts` `assertNoHashConflict` + revision-ambiguity guard → `ArchiveStateConflictError`). This matches the frozen substrate's existing behaviour — **not a new risk**, documented for the failure test (FS-4).

---

## 6. Settlement State and Correction Semantics

### 6.1 Is `buildSettlementArchiveState` sufficient unchanged? — **YES.**
The Stage-1 provider consumes only `capturedFixtureIds` and `settledFixtureIds` (`settlement-provider.ts:102-103`; validity guard `archiveStateOk` checks only those two, `settlement-provider.ts:46-53`). `buildSettlementArchiveState` already produces both plus the optional `currentValidationHeads`. **No change to Stage 2A.**

### 6.2 How `currentValidationHeads` is consumed — **it is NOT (Stage 2C).**
It stays computed-but-unconsumed. Consuming it requires correction logic (detect `head.state ≠ new source outcome`, derive a typed cause), which is out of scope. It remains the reserved MC-1 enrichment for the future correction stage. Zero consumers now = backward-compatible (matches Stage 2A review).

### 6.3 Distinguishing the six settlement states
Stage 2C's contract is **first-settle only**; the distinctions fall out of the provider + frozen M8 with **no new logic**:

| State | Where distinguished | Outcome in Stage 2C |
|---|---|---|
| **pending** (captured, not terminal) | provider `classifySettlementRow` → `fixture_not_complete` (deferrable); or M8 `outcome.kind === "pending"` | no candidate / no write; re-fired next pass |
| **already settled** | provider: `settledFixtureIds.has(fixtureId)` → `already_settled` (`eligibility.ts:181`) | **no candidate** — never reaches M8 |
| **duplicate validation** | frozen M8 store idempotency `(revisionId, contentHash)` → `no_change` | absorbed inside M8; counted `noChange` |
| **unchanged source result** | frozen M8: `head.state === outcome.state` → `no_change` (`settlement.ts:288`) | no append (only reachable on the same-pass first settle; already-settled fixtures are pre-filtered) |
| **source result changed** (genuine correction) | frozen M8: `head.state !== outcome.state` + no cause → `invalid_input` | **cannot be produced** — provider excludes settledFixtureIds; if it ever slipped through, M8 fails **closed** to `invalid_input`, never a wrong correction |
| **corrupt archive state** | Stage 2A `ArchiveStateConflictError` (read) or provider `archiveStateOk`=false → all rows `corrupt_archive_state` | run `failed` / no candidates — fail-closed |

### 6.4 How `correctionCause` is derived — **it is NOT derived (always absent).**
Every produced `SettlementCandidate` leaves `correctionCause` `undefined`. Derivation (mapping a detected head-vs-outcome transition to `result_reinterpreted`/`source_lineage_changed` via `determineCorrectionReason`) belongs to the deferred correction stage.

### 6.5 How false `correctionCause` is prevented — **two independent structural guarantees.**
1. **Provider exclusion:** already-settled fixtures are rejected `already_settled`, so no correction candidate is ever emitted.
2. **Cause-absent hard stop:** because Stage 2C never sets a cause, M8's correction branch (`head.state !== outcome.state`) with `correctionCause === undefined` returns `invalid_input` and **writes nothing** (`settlement.ts:301-303`). A wrong/settled outcome can never be silently overwritten.

Net: **no false correction is representable in Stage 2C.** This must be pinned by tests SC-5/SC-6 (§10).

---

## 7. M8 Compatibility

**Frozen — Stage 2C touches none of these:** `settleSnapshot`, `settleLatestSnapshotForFixture`, `SettleSnapshotInput`, `SettlementResult`/`SettlementSummary`/`MarketSettlement`, `CorrectionCause`, `determineCorrectionReason`, `resolveValidationOutcome` (`outcomes.ts`), the validation builders/identity (`createValidationRecord`/`reviseValidationRecord`/`validationId`/`currentValidationRevisions`), `resolveMatchLifecycle`, the `EvidenceArchiveStore` interface, `runSettlementBatch` and its C3/C4 guards, the `SettlementCandidate` shape, and all validation identity/revision/append-only/hash semantics.

**Preserved invariants:** existing validation identity; revision semantics (`MAX(revision)` head, append-only revisions, `supersedesRevisionId` chain); correction semantics (typed-cause-required, unreachable here); append-only archive (no update/delete path exists); no archive-format change; no new persistent state; no wall-clock identity (`nowSec`/`completionInstant` deterministic from the injected eval instant + source `kickoff`); no settlement of non-terminal fixtures (classifier defers all non-terminal lifecycles).

---

## 8. Proposed File-Level Change Set

| # | File | Change | Constraint |
|---|---|---|---|
| 1 | `lib/archive/evidence/file.ts` | **Modify (additive):** add module-level `readAllValidationsStrict(env?)` reusing `readNdjson`. | No interface change; no behaviour change to existing exports/store. |
| 2 | `lib/evidence-capture/candidates/settlement-pipeline.ts` | **Create (server-only):** `createFileSettlementReadPort(env?)`, `produceSettlementRequests(deps, config)`, `SettlementPipelineDeps` (`loadCompletedRows` required injected seam; optional `readPort`), `SettlementPipelineConfig` (`date`, `evaluationInstant`, optional `provider` config, `sourceOptions`). | Not re-exported from the client-safe `candidates/index.ts` barrel (server-only isolation). No `correctionCause`, no `currentValidationHeads` consumption. |
| 3 | `lib/jobs/runner.ts` | **Modify (additive):** add `provideCandidates?: () => Promise<readonly SettlementCandidate[]>` to `runPredictionSettlementJob` options; change `options?.candidates ?? []` to the `provideCandidates ? await() : (candidates ?? [])` ternary inside `runWithLock`. | Absent ⇒ unchanged M9 empty pass; capture path untouched. |
| 4 | `tests/evidenceSettlementPipeline.test.ts` | **Create:** unit tests mirroring `evidenceCapturePipeline.test.ts` (see §10). | New file only; no existing test modified. |
| 5 | `docs/plans/m10-stage-2c-settlement-integration-plan.md` | **This document.** | Doc-only. |

**Explicitly NOT changed:** M8 (`settlement.ts`, `outcomes.ts`), `settlement-run.ts`, the Stage-1 provider/eligibility/archive-state modules, the cron route (`app/api/internal/cron/prediction-settlement/route.ts` stays the one-line M9 delegate), flags/config, locks, `types/evidence/*`, memory adapters, and the odds archive.

---

## 9. Rejected Alternatives

- **Consuming `currentValidationHeads` to settle corrections now.** Rejected: adds correction detection + cause derivation = out of scope; first-settle is the narrowest safe slice and loses no data (first settlement is never dropped; corrections defer cleanly since the archive is append-only and re-derivable).
- **Adding `correctionCause` from the provider.** Rejected: the provider cannot safely infer a cause; a wrong cause corrupts the revision chain. M8's fail-closed `invalid_input` is the correct guard.
- **Adding `readAllValidations` to the `EvidenceArchiveStore` interface.** Rejected: would force every implementer (memory adapter, test doubles) to change; module-level `readAllValidationsStrict` (the Stage-2B precedent) is minimal and adapter-neutral.
- **A shared generic `producePipeline<T>` abstraction across capture + settlement.** Rejected (decision #11/#12): the two differ in source loader, port composition, and provider; a generic factory would be a premature abstraction. Keep `settlement-pipeline.ts` a small parallel sibling of `capture-pipeline.ts`, matching the existing `capture-run.ts`/`settlement-run.ts` and `capture-provider.ts`/`settlement-provider.ts` sibling convention.
- **Reading validations via the fail-soft `service.ts`/`getEvidenceArchiveStore()`.** Rejected: its `archive_unavailable` empty view would mask a corrupt archive as "nothing settled" — a false-pending trap. Read strict from `file.ts`.
- **A settlement deadline / diagnostics aggregation / route wiring / live source now.** Rejected: all explicitly out of Stage 2C; deferred to later stages.
- **New abstractions that must not be introduced:** no port factory class / DI container, no cursor/checkpoint, no correction engine, no generic pipeline, no store-interface change, no new archive field, no Postgres, no replay machinery.

---

## 10. Test-First Implementation Sequence

New suite `tests/evidenceSettlementPipeline.test.ts` (fakes: injected `loadCompletedRows`, fake `SettlementArchiveReadPort`, memory evidence store). Author **before** wiring, mirroring `evidenceCapturePipeline.test.ts`:

**Producer (`produceSettlementRequests`):**
- SP-1 captured + terminal-finished(valid scores), not settled → 1 `SettlementCandidate` (correct `fixtureId`/`completionInstant`/`nowSec`; `correctionCause` **undefined**).
- SP-2 fixture in `settledFixtureIds` → 0 candidates, `already_settled` counted.
- SP-3 captured but non-terminal (live/scheduled) → 0 candidates, `fixture_not_complete`.
- SP-4 not in `capturedFixtureIds` → 0 candidates, `missing_prediction_identity`.
- SP-5 BF-S1 terminals (postponed/cancelled/abandoned) with null scores → eligible (regression guard).
- SP-6 strict read throw (validations reader) propagates → **rejects** (fail-closed, never empty).
- SP-7 `ArchiveStateConflictError` (same revisionId, divergent hash on disk) surfaces → rejects.
- SP-8 determinism: shuffled `completedRows` → byte-identical candidate array.

**Runner seam (`runPredictionSettlementJob`):**
- SR-1 `provideCandidates` invoked once **inside the lock**, threaded to `runSettlementBatch` (spy count = 1; result counts reflect the batch).
- SR-2 static `candidates` path still works (M9 backward-compat, no provider).
- SR-3 rejecting `provideCandidates` → run `failed` (not an empty success).
- SR-4 disabled settlement flag → `skipped`, producer never called (`calls === 0`).

**Correction-safety (the new-surface guarantees):**
- SC-5 an already-settled fixture whose source outcome *changed* is **not** emitted (provider exclusion) — no candidate, no write.
- SC-6 a `SettlementCandidate` with `correctionCause` undefined against a changed-state head → M8 returns `invalid_input`, **zero appends** (false-correction impossibility, proven end-to-end with a seeded memory store holding a terminal head).

**Regression anchors (must stay green):** `tests/evidenceSettlement.test.ts`, `tests/m9Activation.test.ts`, `tests/m9Concurrency.test.ts`, `tests/evidenceArchiveStateBuilders.test.ts`, `tests/evidenceCandidateProvider.test.ts`, `tests/evidenceCapturePipeline.test.ts`, plus full `npm test` (baseline **1769** + new), typecheck exit 0, lint clean.

**Implementation order (strict):**
1. Author `tests/evidenceSettlementPipeline.test.ts` (SP/SR/SC) against not-yet-written symbols.
2. Add `readAllValidationsStrict` to `file.ts`; unit-check strict parity (reuse existing adapter suite pattern).
3. Create `settlement-pipeline.ts` (`createFileSettlementReadPort` + `produceSettlementRequests`); green SP-*.
4. Add the `provideCandidates` seam to `runPredictionSettlementJob`; green SR-*/SC-*.
5. Run full suite + typecheck + lint; confirm route unchanged and dormant.
6. Write the Stage-2C closure record; do **not** touch the route/flags.

---

## 11. Blocking Questions

- **BQ-1 (resolvable with a safe default) — the live completed-rows source.** Unlike capture (which had `loadPublishedDailyPredictions` ready), there is **no existing clean loader** returning finished-fixture `FootyMatchRow[]` for settlement (`grep` found row *producers* in `live-feed`/`dailyArchive`/`listSettle`, but no `loadCompletedRows(date)`). **Safe resolution:** leave `loadCompletedRows` a **required injected seam with no live default**, keeping Stage 2C dormant — the direct analog of Stage 2B leaving `deriveCaptureInput` injected. Identifying/validating the concrete finished-rows loader (likely a thin wrapper over `readDailyArchive(date)` filtered to terminal rows) is a later live-activation task, not a Stage 2C blocker. No external decision needed to proceed.
- **BQ-2 (documentation only) — completion-instant precision.** The provider defaults `completionInstant` to the fixture kickoff (deterministic, idempotent — `settlement-provider.ts:55-63`); a precise terminal instant may be injected later via `deps.deriveCompletionInstant`. Must stay deterministic and frozen once activated. No Stage 2C action.

Neither blocks coding; both have documented safe defaults.

---

## 12. Implementation Readiness Verdict

# STAGE 2C ARCHITECTURE READY

The narrowest safe Stage 2C is a **first-settle-only settlement mirror of the approved Stage 2B capture wiring**: strict archive state (snapshots + validations, one bounded read each, fail-closed) → Stage-1 settlement provider → `SettlementCandidate[]` → frozen M8 batch, invoked **inside the durable `prediction_settlement` lock** via an optional `provideCandidates` seam, with the route left **dormant**. It requires exactly two additive runtime deltas (`readAllValidationsStrict`, the runner seam), one new server-only pipeline module, and one new test file. It consumes `buildSettlementArchiveState` unchanged, **does not consume `currentValidationHeads`**, **never sets `correctionCause`**, and makes a false correction structurally impossible (provider excludes `settledFixtureIds`; M8 fails closed on a causeless state change). Every architectural constraint — archive-as-sole-checkpoint, discovery-inside-lock, strict fail-closed reads, one bounded read per archive, no cursor/cache, deterministic ordering, frozen identity/revision/correction semantics, append-only, no format change, no wall-clock identity, no non-terminal settlement — is preserved. No M8, runner-core, route, flag, config, archive, database, or deployment change is proposed.

- **Verdict:** STAGE 2C ARCHITECTURE READY.
- **Blockers:** none. BQ-1 (live completed-rows loader) and BQ-2 (completion-instant precision) both have documented safe defaults and are deferred live-activation items, not coding blockers.
- **Required implementation sequence:** §10 — tests first (SP/SR/SC), then `readAllValidationsStrict`, then `settlement-pipeline.ts`, then the runner seam; full suite + typecheck + lint green; route untouched.
- **Proposed files:** modify `lib/archive/evidence/file.ts` + `lib/jobs/runner.ts`; create `lib/evidence-capture/candidates/settlement-pipeline.ts` + `tests/evidenceSettlementPipeline.test.ts` (+ a later closure doc). No other files.
- **Stage 2C coding may begin: YES** (dormant at the route; live source + corrections deferred).
- **Files modified by this task:** only `docs/plans/m10-stage-2c-settlement-integration-plan.md`.

**Confirmed:** this task created only the plan document. No runtime code, no tests, no M8, no runner, no cron routes, no flags, no configuration, no archives, no database, and no deployment were modified.

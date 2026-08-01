# M10 Stage 2C — Implementation Review (Settlement Pipeline Wiring)

**Reviewer:** Primary Independent Implementation Reviewer (Stage 2C)
**Date:** 2026-07-30
**Milestone:** Sprint 23B — M10 (Live Candidate Pipeline), **Stage 2C — Settlement Pipeline Wiring**.
**Type:** Read-only implementation review. **No runtime code, test, contract, route, flag, configuration, archive, database, environment, or deployment was modified.** The only file created is this document.

**Docs read:** `docs/architecture/m10-live-candidate-pipeline-specification.md`; `docs/plans/m10-stage-2c-settlement-integration-plan.md` (the approved architecture plan); the Stage-2C production-safety, performance, test-plan, and migration-compatibility reviews; the Stage-2B closure/code-integration record. (Some sibling Stage-2C review docs named in the brief were not present in the tree; the integration plan + spec were the authoritative inputs and were read completely.)

**Code inspected (file:line):** `lib/evidence-capture/candidates/settlement-pipeline.ts`; `lib/jobs/runner.ts:322-371` (`runPredictionSettlementJob`); `lib/archive/evidence/file.ts:143-168` (`readAllSnapshotsStrict`/`readAllValidationsStrict`/`readNdjson`); `lib/evidence-capture/candidates/archive-state/{builders,normalize,types}.ts`; `lib/evidence-capture/candidates/settlement-provider.ts`; `lib/evidence-capture/jobs/settlement-run.ts`; `lib/evidence-capture/settlement.ts` (M8); `lib/evidence-capture/candidates/index.ts` (barrel); `app/api/internal/cron/prediction-settlement/route.ts`; `tests/evidenceSettlementPipeline.test.ts`.

---

## 1. Executive Summary

# STAGE 2C IMPLEMENTATION APPROVED

Stage 2C implements **exactly and only** the approved narrowest-safe slice: a first-settlement-only settlement producer that is the structural mirror of the approved Stage 2B capture wiring.

```
createFileSettlementReadPort → buildSettlementArchiveState (Stage 2A, unchanged)
  → buildSettlementCandidates (Stage 1, unchanged) → SettlementCandidate[]
  → runSettlementBatch → settleLatestSnapshotForFixture (frozen M8)
```

The producer (`produceSettlementRequests`) is invoked **inside the held durable `prediction_settlement` lock** via a new optional `provideCandidates` seam on `runPredictionSettlementJob`. Discovery is fail-closed (strict reads throw, never empty), deterministic (no `Date.now`/`Math.random`/wall clock), and single-bounded-read per archive. The **first-settlement firewall** is honoured in code, tests, and structurally: `currentValidationHeads` is never consumed, `correctionCause` is never produced, already-settled fixtures are excluded by the Stage-1 provider, and a causeless changed outcome fails **closed** to M8 `invalid_input` (no write). Two additive runtime deltas only — `readAllValidationsStrict` (one-line reader mirror) and the runner seam — with **no M8 change, no `ValidationRecord` change, no store-interface change, no new archive field, no migration, and the route left dormant**.

**Validation:** Stage-2C **26/26**; targeted groups (2C+2A+Stage-1 provider+M8+M9 runner+2B) **171/171**; full suite **1795/1795** (+26 over the 1769 baseline); typecheck exit 0; lint clean. No blocking findings; four non-blocking observations, all consistent with the approved Stage-2B posture.

---

## 2. Scope Compliance

Verified Stage 2C contains **only** the target chain and none of the excluded work:

| Required scope | Verdict | Evidence |
|---|---|---|
| Strict settlement archive state → Stage-1 provider → `SettlementCandidate[]` → M8 batch | **PASS** | `settlement-pipeline.ts:101-121` composes exactly this. |
| No correction discovery | **PASS** | `currentValidationHeads` never referenced in code; scope test (`test:542`) greps comment-stripped source and asserts absent. |
| No deadline (INV-D) enforcement | **PASS** | No deadline code in the module. |
| No diagnostics aggregation | **PASS** | Returns `SettlementProviderResult` verbatim; runner takes only the candidate array. |
| No activation / route wiring / scheduler change | **PASS** | Route is the unchanged one-line `runPredictionSettlementJob()` delegate (`test:554` asserts it; verified `route.ts`). |
| No new archive field / schema evolution / migration | **PASS** | `readAllValidationsStrict` reads the existing `validations.ndjson`; `ValidationRecord` untouched. |
| No Postgres / generalized replay / unrelated M8 refactor | **PASS** | None present. |

New module is **server-only** and **absent from the client-safe `candidates/index.ts` barrel** (grep-confirmed) — only the test imports it directly. No accidental public-surface expansion.

---

## 3. Lock Boundary

**Discovery executes inside the durable lock (INV-L): PASS.**

- `provideCandidates()` is awaited inside the `fn` passed to `runWithLock("prediction_settlement", …)` (`runner.ts:349-357`); `fn` runs only after `tryAcquireJobLock` returns a held lock. Distinct key `job:prediction_settlement` (C1), never shares capture's lock.
- **Flag-skip precedes lock+discovery:** `isSettlementEnabled(env)` short-circuits before `runWithLock` (`runner.ts:346-348`); `test:405` proves `calls === 0` when disabled.
- **Lock-unavailable ⇒ no discovery:** `test:421` pre-acquires the lock, then asserts the job is `skipped`/`lock_unavailable` with the producer never called (`calls === 0`).
- **Producer rejection ⇒ `failed`, never empty success:** a rejected `provideCandidates()` throws inside `fn` → `runWithLock` catch → `failed`/`unhandled`, lock released in `finally`. `test:391` confirms.
- **Precedence pinned:** `provideCandidates ? await() : (candidates ?? [])` — producer wins deterministically when both are supplied (`runner.ts:354`, doc "Precedence (pinned)"), and `test:444` pins it (static C3-mismatch path is ignored). This tightens the Stage-2B silent-precedence non-blocking note into an explicit, tested contract.
- **Bare runner empty-safe:** neither option supplied ⇒ `[]` (M9 behaviour); `test:379` (static path) green, and the untouched cron route fires the bare job.
- **No cursor/cache/offset:** progress (`settledFixtureIds`) is recomputed from the archive each pass; the port is constructed fresh per `produceSettlementRequests` call. INV-A preserved.

---

## 4. Strict Read Review

**Fail-closed strict validation reads: PASS.**

- `readAllValidationsStrict(env) = readNdjson<ValidationRecord>(evidenceArchivePaths(env).validations)` (`file.ts:165-168`) — a one-line mirror of `readAllSnapshotsStrict`, reusing the **existing** private `readNdjson`: ENOENT ⇒ `[]`; malformed line / EACCES/EPERM / EIO/EBUSY / other errno ⇒ **throw**. **No new parser, no duplicate read path.** Module-level export (not a store-interface change) — no adapter/double breakage.
- `createFileSettlementReadPort` composes both readers from the **same** `evidenceArchivePaths(env)` (`file.ts` resolves one evidence dir for both files) — **no cross-archive divergence and no eager/lazy path asymmetry** (settlement never touches the odds dir; strictly safer than the capture port, whose 2B NB-2 asymmetry does not arise here).
- Reads come **directly from `file.ts`**, never `service.ts`/`getEvidenceArchiveStore()` — the fail-soft `archive_unavailable` empty view is correctly bypassed, so a corrupt archive can never masquerade as "nothing settled."
- **One bounded read per archive (PB-1):** `buildSettlementArchiveState` calls each reader once via `Promise.all` (`builders.ts:56-58`); `test:229` asserts `snap===1`, `val===1`, `source===1`. No per-fixture scan.
- **Depth caveat (documented, non-blocking):** `readNdjson` throws on malformed JSON/IO but does not re-verify each record's content hash; same-id/different-hash conflicts are caught one layer up by Stage 2A's `ArchiveStateConflictError` (`test:185`, `test:323`). This matches M8's own `listValidations` read and the frozen substrate — not a new risk. Port throw propagation proven end-to-end (`test:298` validations throw, `test:308` source-loader reject, both reject rather than emit `[]`).

---

## 5. Pipeline Correctness

**Stage 2A builders reused unchanged: PASS** — `settlement-pipeline.ts:40` imports `buildSettlementArchiveState` from `./archive-state`; no normalization is re-implemented, and `builders.ts`/`normalize.ts` are untouched (approved Stage 2A code).

**Producer composition: PASS.** `produceSettlementRequests` runs `loadCompletedRows(date)` and `buildSettlementArchiveState(readPort)` concurrently, then `buildSettlementCandidates({ completedRows, evaluationInstant, archiveState, config, deps })`, returning the provider result verbatim. It sets no `correctionCause`, consumes no `currentValidationHeads`, and defers already-settled exclusion to the provider.

**State distinctions (all provider/M8-owned, no new logic): PASS.**
- captured terminal, unsettled ⇒ 1 candidate, `correctionCause` absent (`test:215`, `in`-operator asserted absent).
- already-settled ⇒ 0 candidates, `already_settled` (`test:247`).
- captured non-terminal (live) ⇒ 0, `fixture_not_complete` (`test:267`).
- uncaptured ⇒ 0, `missing_prediction_identity` (`test:277`).
- BF-S1 lifecycle terminals (postponed/cancelled/abandoned, null scores) ⇒ eligible (`test:286`) — regression guard intact.
- Real integration (`test:465`): producer→provider→2A builder→M8 first-settle appends exactly 1 revision; retry ⇒ provider emits nothing ⇒ no duplicate, no correction revision.

**Completed-rows source is a dormant injected seam (`loadCompletedRows`, no live default): PASS/expected** — BQ-1 from the plan; correctly documented, keeping Stage 2C dormant even if the route were wired.

---

## 6. Determinism

**PASS.** `grep` over `settlement-pipeline.ts` and `settlement-provider.ts` finds **no** `Date.now`, `Math.random`, or argless `new Date()`. Time enters only as the injected `evaluationInstant` (→ `nowSec = Math.floor(Date.parse(evalInstant)/1000)`) and the source-derived `completionInstant` (default `new Date(Date.parse(row.kickoff)).toISOString()` — deterministic on a numeric arg, not a wall clock). Output is order-independent: `test:338` shuffles both completed rows and archive records and asserts `deepEqual` candidate output. No wall-clock influence on identity, ordering, or `completionInstant`.

---

## 7. M8 Compatibility

**PASS — M8 untouched, `ValidationRecord` untouched.**

- `settlement.ts` (`settleSnapshot`/`settleLatestSnapshotForFixture`/`CorrectionCause`/`determineCorrectionReason`), `settlement-run.ts` (`runSettlementBatch`, C3/C4 guards, `SettlementCandidate` shape), the validation builders/identity, and the `EvidenceArchiveStore` interface are all unmodified. Stage 2C consumes them as-is.
- **False-correction impossibility proven twice:** (1) provider excludes `settledFixtureIds` so no correction candidate is emitted (`test:247`); (2) `test:510` drives M8 directly with a changed outcome and no cause → `summary.invalidInput > 0`, **zero appends** — a wrong outcome can never silently overwrite a settled head.
- Idempotency backstop remains M8's: unchanged re-fire ⇒ `no_change`; byte-identical rebuild absorbed by `(revisionId, contentHash)`. Append-only preserved; no update/delete path introduced.

---

## 8. Test Review

`tests/evidenceSettlementPipeline.test.ts` — **26 tests, all green**, and they exercise **real integration**, not just mocks:

- **Concrete port over a real temp NDJSON dir** (`tmpArchive` + `mkdtempSync`): ENOENT⇒`[]`, malformed snapshot/validation⇒throw, immutable-conflict⇒`ArchiveStateConflictError`, EISDIR⇒throw (`test:139-209`). This closes the Stage-2B NB-5 gap (2B's concrete port was fake-only) — Stage 2C round-trips the *real* file reader.
- **Producer** over fake/real ports: eligibility distinctions, fail-closed propagation (validations throw, source reject, conflict), determinism (`test:215-350`).
- **Runner seam** with the **memory lock backend**: in-lock invocation, static back-compat, rejection⇒failed, flag-skip, **lock-contention⇒skipped-no-discovery**, both-provided precedence (`test:361-461`).
- **Real end-to-end** producer→provider→2A→M8 with a memory store: first-settle appends 1, retry no-duplicate/no-correction (`test:465`); false-correction impossibility (`test:510`).
- **Scope guards**: source-level assertion that the module code contains neither `correctionCause` nor `currentValidationHeads` (comments stripped), and that the cron route stays the dormant one-line delegate (`test:542`, `test:554`).

Coverage is thorough and matches the approved test plan (unit + integration + failure + scope). The comment-stripping scope guard is a genuine (not cosmetic) firewall check.

---

## 9. Blocking Findings

**None.** No runtime wiring escapes the lock; strict reads are fail-closed; M8/`ValidationRecord`/store-interface/archive-format are unchanged; determinism holds; the firewall (no `currentValidationHeads`, no `correctionCause`, already-settled excluded) is enforced structurally and tested; the route is dormant; the bare runner is empty-safe. The BLOCK conditions are not met.

---

## 10. Non-blocking Findings

- **NB-1 — `loadCompletedRows` has no live default (dormant seam).** By design (plan BQ-1); Stage 2C cannot fire live until the concrete finished-rows loader is identified and wired in a later activation stage. Correctly documented; not a defect.
- **NB-2 — Provider diagnostics dropped at the seam.** `provideCandidates: () => Promise<readonly SettlementCandidate[]>` returns only the array, so the provider's `CandidateDiagnostics` (already_settled / fixture_not_complete / deferred-by-cap counts) are discarded when wired through the runner. Explicitly out of Stage-2C scope (no diagnostics aggregation); it is the first thing the diagnostics stage must reconnect. Consistent with Stage-2B NB-4.
- **NB-3 — Generic `unhandled` failure code.** A rejecting producer surfaces as `errorCode:"unhandled"` rather than a distinguishable settlement discovery code (route still maps `failed`→500, so alerting works). Consistent with Stage-2B; cosmetic.
- **NB-4 — Read-layer does not re-verify validation content hashes.** `readNdjson` catches malformed/IO/duplicate-conflict; a single tampered record with a unique `revisionId` would pass the read (caught only on a same-`revisionId`/different-hash conflict). This exactly matches M8's own `listValidations` read and is covered for the conflict case by Stage 2A's guard — a property of the frozen substrate, not introduced here. Documented in the plan.

None gates this merge; NB-1/NB-2 gate the eventual live activation, not the dormant wiring.

---

## 11. Verdict

# STAGE 2C IMPLEMENTATION APPROVED

Stage 2C correctly implements only `Strict Settlement Archive State → Stage-1 Settlement Provider → SettlementCandidate[] → M8 Settlement Batch Runner`. Discovery runs inside the durable `prediction_settlement` lock; strict validation reads are fail-closed; Stage 2A builders are reused unchanged; each archive is read once with no per-fixture scan; output is deterministic with no wall clock; `currentValidationHeads` is never consumed and `correctionCause` is never produced; already-settled fixtures are excluded and false corrections are structurally impossible (proven); the route remains dormant and the bare runner empty-safe; and M8, `ValidationRecord`, the store interfaces, and the archive format are untouched with no migration. Validation is green on every axis.

- **Verdict:** STAGE 2C IMPLEMENTATION APPROVED.
- **Blocking findings:** none.
- **Non-blocking findings:** NB-1…NB-4 (§10) — all consistent with the approved Stage-2B posture; NB-1/NB-2 gate live activation, not this dormant merge.
- **Runtime remediation required:** No.

### Validation results (re-run this pass, 2026-07-30, read-only)

| Check | Command | Result |
|---|---|---|
| Stage-2C pipeline | `… --test tests/evidenceSettlementPipeline.test.ts` | **26 pass / 0 fail** |
| Targeted groups (2C + 2A + Stage-1 provider + M8 + M9 runner + 2B) | `… --test <7 suites>` | **171 pass / 0 fail** |
| Full suite | `npm test` | **1795 pass / 0 fail / 0 skip** (baseline 1769 + 26) |
| Typecheck | `npm run typecheck` | **clean (exit 0)** |
| Lint | `npm run lint` | **clean** |

**Confirmed:** this review created only `docs/plans/m10-stage-2c-implementation-review.md`. **No runtime code, no tests, no configuration, and no deployment were modified.**

# M10 Stage 2C — Settlement Pipeline Wiring — Test Plan

**Document type:** Test-planning deliverable (planning only). **No test or runtime code was written or modified.** The only file created is this document.
**Date:** 2026-07-30
**Author role:** Test Architect, Sprint 23B / M10 Stage 2C.
**Governing:** `docs/architecture/m10-live-candidate-pipeline-specification.md` (Rev A1); Stage 2A (`m10-stage-2a-archive-normalization.md` + `…-implementation-review.md`, APPROVED, `currentValidationHeads`/MC-1); Stage 2B (`m10-stage-2b-capture-pipeline-wiring.md` + `…-test-coverage-review.md`, the proven wiring template + its A-1/A-2 conditions); the Stage-2 master verification plan (`m10-stage-2-test-verification-plan.md`); Phase 2.7 DoD.
**Code read to ground the plan:** `lib/evidence-capture/settlement.ts` (`settleLatestSnapshotForFixture`, `settleSnapshot`, `CorrectionCause`, `determineCorrectionReason`), `lib/evidence-capture/outcomes.ts`, `lib/evidence-capture/jobs/settlement-run.ts` (`runSettlementBatch`, C3/C4, `SettlementCandidate`), `lib/evidence-capture/candidates/settlement-provider.ts` + `eligibility.ts` (`buildSettlementCandidates`, `classifySettlementRow`), `lib/evidence-capture/candidates/archive-state/{builders,normalize,types}.ts` (`buildSettlementArchiveState`, `normalizeSettlementArchiveState`, `SettlementArchiveReadPort`, `currentValidationHeads`, `ValidationHead`, `ArchiveStateConflictError`), `lib/jobs/runner.ts` (`runPredictionSettlementJob`, `runWithLock`), `lib/jobs/locks.ts`, `lib/archive/evidence/file.ts` (`readAllSnapshotsStrict`, `readNdjson`), `lib/evidence-capture/odds-archive/file.ts` (`readAllOddsRecordsStrict` — the reader shape 2C mirrors), and the suites in §2.

---

## 1. Scope

### 1.1 What Stage 2C wires
The settlement analog of Stage 2B, connecting four already-built pieces into one reusable, injectable producer invoked **inside the held durable lock**:

```
Settlement Archive State (Stage 2A, strict single read of snapshots + validations)
   → Stage 1 Provider (buildSettlementCandidates, correction-aware)
      → SettlementCandidate[]
         → M8 Settlement Runner (runPredictionSettlementJob → runSettlementBatch → settleLatestSnapshotForFixture)
```

### 1.2 Modules Stage 2C is expected to add (verified absent today) — the test targets
| Module / change | Status | Mirrors |
|---|---|---|
| `readAllValidationsStrict(env?)` in `lib/archive/evidence/file.ts` (whole-archive strict read of `validations.ndjson` via `readNdjson`) | **MISSING** | `readAllSnapshotsStrict` / `readAllOddsRecordsStrict` |
| `createFileSettlementReadPort(env?)` — concrete `SettlementArchiveReadPort` = `{ readAllSnapshots: readAllSnapshotsStrict, readAllValidations: readAllValidationsStrict }` | **MISSING** | `createFileCaptureReadPort` (2B) |
| `produceSettlementCandidates(deps, config)` in `lib/evidence-capture/candidates/settlement-pipeline.ts` (loads completed rows + `buildSettlementArchiveState` concurrently → `buildSettlementCandidates`) | **MISSING** | `produceCaptureRequests` (2B) |
| `runPredictionSettlementJob` `provideCandidates?: () => Promise<readonly SettlementCandidate[]>` seam, invoked **inside `runWithLock`** (INV-L) | **MISSING** (runner has capture seam only) | `runEvidenceCaptureJob` seam (2B) |
| **Correction wiring** — extend the Stage 1 settlement classifier context to consume `currentValidationHeads` and emit `correctionCause` on a genuine outcome change | **MISSING** (ctx today = `capturedFixtureIds`/`settledFixtureIds` only) | new to 2C |

### 1.3 Explicitly IN Stage 2C
First-settlement append; already-settled skip; **genuine corrections** (changed outcome → one new revision with a typed `correctionCause`); the strict settlement read port; the runner seam under the lock; flag-off / lock-unavailable / rejection fail-closed behaviour; determinism/replay of candidate output; frozen-contract preservation.

### 1.4 Explicitly OUT (deferred — do not gate 2C on these, §8)
- **2D:** INV-D deadline clamp/guard for settlement; producer-stage diagnostics/metric aggregation + reconciliation identities.
- **2E:** full multi-worker/overlap concurrency matrix; benchmark at the settlement ceiling vs representative archive depth; activation (flags-on, real completed-rows source) end-to-end; the DB-backed `pg_advisory_unlock`-throw→not-500 carry-forward (H-1/L-2).

### 1.5 Key advantage over 2B
Settlement needs **no** live M4→M5 derivation. Unlike 2B (whose mint was blocked by the deferred derivation, so it never wrote a snapshot end-to-end), Stage 2C **can and must** drive the wired path to a real `ValidationRecord` append against memory stores with a fake completed-rows loader + seeded snapshots. The end-to-end first-settle, correction, and retry-no-dup assertions are fully realizable now.

---

## 2. Requirements Matrix

Each requested test → the concrete capability it asserts, the frozen substrate it rides, and its tier. Test file: **`tests/evidenceSettlementPipeline.test.ts`** (new).

### 2.1 Unit (all mandatory 2C)
| ID | Requirement | Asserts against | Substrate |
|---|---|---|---|
| U-1 | strict settlement read port | `createFileSettlementReadPort` over a temp NDJSON dir: ENOENT→[], malformed/EACCES/EIO→throw *through the port*, for **both** snapshots and validations | `readAllSnapshotsStrict`, new `readAllValidationsStrict`, `readNdjson` |
| U-2 | settlement archive-state builder use | `produceSettlementCandidates` calls `buildSettlementArchiveState(port)` exactly once; one read per store | `buildSettlementArchiveState` (2A counting-port pattern) |
| U-3 | terminal lifecycle filtering | postponed/cancelled/abandoned → eligible terminal candidate; live/half_time/scheduled/suspended → deferred `fixture_not_complete`; unavailable → `unsupported_outcome_state` | `classifySettlementRow` / `resolveMatchLifecycle` |
| U-4 | pending classification | captured, non-terminal / missing score → not a candidate (no write intent) | `classifySettlementRow`, C4 `hasValidCompletedScores` |
| U-5 | already-settled classification | fixture in `settledFixtureIds` with unchanged head → `already_settled`, no candidate | `SettlementArchiveState.settledFixtureIds` |
| U-6 | current validation head selection | from `currentValidationHeads`, the head chosen per `(fixture, market)` is `MAX(revision)`; state read from that head | `normalizeSettlementArchiveState`, `ValidationHead` |
| U-7 | duplicate collapse | duplicate validation lines (same `revisionId`+hash) collapse to one head; duplicate completed rows (same `matchId`) → one candidate | `normalizeSettlementArchiveState`, provider dedup |
| U-8 | conflicting revisions | same `revisionId` + different hash, or two `revisionId`s at one `(id,revision)` → `ArchiveStateConflictError` (fail-closed, no candidate) | `normalizeSettlementArchiveState` |
| U-9 | unchanged result | observed outcome == current head state → **no correction candidate** (would be M8 `no_change`) | head-state compare (new correction logic) |
| U-10 | genuine correction | observed outcome != current head state → correction candidate emitted with a `correctionCause` set | new correction logic + `currentValidationHeads` |
| U-11 | correctionCause mapping | `result_reinterpreted`→`settlement_correction`; `source_lineage_changed`→`data_correction`; unknown→null (fail-closed) | `determineCorrectionReason` |
| U-12 | deterministic ordering | settlement order = `completionInstant` asc, tie-break `fixtureId` asc; shuffled input → identical output | `compareSettlementCandidates` |
| U-13 | static candidate/callback precedence | when both `candidates` and `provideCandidates` are supplied to the runner, `provideCandidates` wins deterministically (static ignored) | `runPredictionSettlementJob` seam (mirror runner.ts:304) |

### 2.2 Integration (mandatory 2C unless flagged)
| ID | Requirement | Asserts |
|---|---|---|
| I-1 | producer callback inside held lock | discovery runs under `runWithLock`; **ordering probe** proves no source/archive read before the lock is held (closes the 2B A-2 gap for settlement) |
| I-2 | callback not invoked when flag off | `EVIDENCE_SETTLEMENT_ENABLED` off → `skipped`/`settlement_disabled`, `provideCandidates` call count **0**, no lock, no read |
| I-3 | callback not invoked when lock unavailable | a held `job:prediction_settlement` → second run `skipped`/`lock_unavailable`, `provideCandidates` **never called**, no double-settle (minimal INV-L; full matrix → 2E) |
| I-4 | callback rejection becomes failed job | rejecting `provideCandidates` → `status:"failed"`, `errorCode:"unhandled"`, lock released in `finally` |
| I-5 | Stage 1 provider → M8 candidate chain | `produceSettlementCandidates` output flows verbatim into `runSettlementBatch` (no field translation); C3/C4 still gate |
| I-6 | first settlement append | seeded snapshot + completed row → exactly one `ValidationRecord` per supported market appended; `status:"succeeded"` |
| I-7 | retry no duplicate | re-fire identical → M8 `no_change`, zero new revisions |
| I-8 | changed source result creates correction revision | seeded settled-won, source now lost (+ a change → `correctionCause`) → exactly one new revision; earlier revision byte-identical |
| I-9 | unchanged source result creates no correction | seeded settled, source unchanged → no candidate / M8 `no_change`, `correctionCause` never set |
| I-10 | bare cron remains dormant | no `candidates` and no `provideCandidates` → empty-safe `succeeded` zero-count (M9 baseline) |
| I-11 | capture path remains unchanged | `runEvidenceCaptureJob` + `produceCaptureRequests` behaviour identical (regression: `evidenceCapturePipeline` 9/9 stays green) |
| I-12 | no route activation | `app/api/internal/cron/prediction-settlement/route.ts` still calls `runPredictionSettlementJob()` with no producer → M9 empty pass; route file unchanged |
| I-13 | no archive format change | appended `ValidationRecord` carries exactly the frozen key set (mirrors `evidenceSettlement` test 49); no new field |

### 2.3 Failure
| ID | Requirement | Asserts | Tier |
|---|---|---|---|
| F-1 | malformed validation archive | corrupt `validations.ndjson` line → strict read throws → build rejects → run `failed`, **never empty/false-pending, no false correction** | mandatory 2C |
| F-2 | malformed snapshot archive | corrupt `snapshots.ndjson` line → same fail-closed | mandatory 2C |
| F-3 | EACCES/EIO | permission/IO errno on either file → throw *through the settlement port* (not empty) | mandatory 2C |
| F-4 | immutable conflict | `ArchiveStateConflictError` (same id, divergent hash) surfaces → run `failed`, never collapsed; and store-level `immutable_violation` on append → run `failed`+`immutable_violation`, never downgraded | mandatory 2C |
| F-5 | source result failure | rejecting completed-rows loader → `produceSettlementCandidates` rejects → run `failed` (symmetric to F-1) | mandatory 2C |
| F-6 | fixture/result identity mismatch | `row.matchId != fixtureId` → C3 `fixtureMismatch` before any store touch; never settles a foreign result | mandatory 2C |
| F-7 | process crash and retry | interrupt after N of M candidates → N committed; re-fire re-derives from archive, completes remainder, **no duplicate revision** | mandatory 2C |
| F-8 | overlapping workers (minimal) | two concurrent single-node fires → one settles, other `skipped`/409, no double-settle (full cross-process matrix → 2E) | mandatory 2C (minimal) |
| F-9 | unlock failure carry-forward | a successful settle is not misreported (H-1/L-2): planned as a **note now**, DB-backed 500-suppression test → **2E** | deferred 2E (documented) |

### 2.4 Replay / determinism (all mandatory 2C)
| ID | Requirement | Asserts |
|---|---|---|
| R-1 | byte-equivalent candidate output | same `(seeded completed rows, seeded archive state, evaluationInstant)` → `JSON.stringify(candidates)` identical across two calls; shuffled input → identical |
| R-2 | evaluation instant does not alter validation identity | two runs with **different `evaluationInstant`** but same source/archive → identical `completionInstant` and identical resulting `validationId`/`revisionId`/`contentHash` (guards the `defaultCompletionInstant` fallback against leaking `evalInstant` into the record) |
| R-3 | process restart recomputes from archive | fresh store + provider + port instances (no in-memory carryover) → identical pending/candidate set (INV-A) |
| R-4 | correction replay does not mint an extra revision | after a correction is appended, re-fire with the same changed source → M8 `no_change`, no second correction |
| R-5 | no cursor or process-local checkpoint | after any run, no cursor/offset/checkpoint artifact; a second fresh process reproduces the same selection (grep-guard + behavioural) |

---

## 3. Fixtures and Test Doubles

Shared helper (non-`.test.ts`, e.g. `tests/_m10stage2cFixtures.ts`), deterministic, **injected fake clock — no wall-clock**.

| Double | Produces | Notes |
|---|---|---|
| `completedRow(overrides)` | `FootyMatchRow` | variants: finished-scored (won/lost), postponed, cancelled, abandoned, live, half_time, suspended, missing-score, `matchId≠fixtureId` (F-6) |
| `stubCompletedRows(list)` | `SettlementPipelineDeps["loadCompletedRows"]` | fake settlement source; `throwOnce` variant for F-5 |
| `memorySettlementPort({snapshots, validations})` | `SettlementArchiveReadPort` | whole-archive doubles for unit; `throwOn:"snapshots"|"validations"` for F-1/F-2/F-3; conflict variant (same id, diff hash) for F-4 |
| `fileSettlementPort(tempDir)` | concrete `createFileSettlementReadPort` over real NDJSON | U-1 / F-1..F-3 round-trip incl. malformed line |
| `seedSnapshot(fixtureId, capturedAt, markets)` | archived `EvidenceSnapshot` | there must be something to settle |
| `seedValidation(fixtureId, market, state, revision)` | `ValidationRecord` head | for already-settled (U-5/I-9) and correction (U-10/I-8) states; enables `currentValidationHeads` |
| `seedStore(...)` | memory `EvidenceArchiveStore` | I-6..I-9 real end-to-end appends via `settleLatestSnapshotForFixture` |
| `lockContention("job:prediction_settlement")` | pre-acquire via `tryAcquireJobLock` | I-3 / F-8 (`resetMemoryJobLocks` teardown; `JOB_LOCK_ADAPTER=memory`) |
| `mockPgPool({throwOnUnlock})` | pool double | F-9 (deferred to 2E) |
| `orderingProbe` | records the sequence of (lock-acquired, source-read, archive-read, callback) events | I-1 in-lock ordering proof |

**Fidelity rules (learned from the 2B review):**
- **Exercise the concrete port at least once** (U-1 / F-1..F-3) — do not prove strict propagation only through a hand-thrown fake (the 2B MF-1 gap).
- **Drive at least one real end-to-end append** (I-6/I-8) through `settleLatestSnapshotForFixture` against a memory store — settlement has no derivation blocker, so the 2B MF-2 limitation does not apply; there is no excuse for an assembly-only test.
- **Compose the real producer as the callback** in at least one runner test (`provideCandidates: () => produceSettlementCandidates(...)`) so the strict-throw→reject→`failed` chain is proven end-to-end (closes the 2B MF-3 gap).
- Determinism: no `Date.now`/`Math.random`; `evaluationInstant`/`nowSec` injected; static determinism guard extended to `settlement-pipeline.ts`.

---

## 4. Unit Suite

Pure/near-pure, offline, injected clock, repeat-run determinism (`deepEqual` twice). Implements U-1…U-13 (§2.1). Notes:

- **U-1 strict port:** assert both readers independently — a malformed *validations* line must throw even when snapshots are clean, and vice-versa; ENOENT on either → that reader returns `[]` (fresh archive is safe).
- **U-6 head selection / U-9 unchanged / U-10 correction:** these three exercise the **new** correction logic that consumes `currentValidationHeads`. They pin: head = `MAX(revision)`; unchanged state → no candidate; changed state → candidate with `correctionCause`. The *value* of `correctionCause` is asserted per the pinned policy (§9 condition C-1).
- **U-11 correctionCause mapping:** assert `determineCorrectionReason` directly (already covered by `evidenceSettlement` test 25–26, but re-assert at the producer boundary so a producer that emits an out-of-vocabulary cause is caught).
- **U-13 precedence:** the runner seam must define a deterministic precedence; assert it (recommend `provideCandidates` wins, matching the capture seam) so behaviour is pinned, not incidental.

---

## 5. Integration Suite

Wired runner + seeded memory stores + fake completed-rows loader; `JOB_LOCK_ADAPTER=memory`; flags on **in-test only**. Implements I-1…I-13 (§2.2). Notes:

- **I-1 in-lock ordering:** use `orderingProbe` (or a spy that asserts `tryAcquireJobLock` resolved-held before the loader/port fire). This is the settlement version of the 2B coverage-review condition A-2 — **do not** ship 2C with only a "callback called once" assertion.
- **I-3 lock-unavailable / I-8 correction / I-6 first-append:** these are the load-bearing integration proofs. I-6 and I-8 must assert the actual archive contents after the run (one record; earlier revision byte-identical), not just `resultCounts`.
- **I-11 capture-path-unchanged:** run the existing capture pipeline in the same suite (or rely on `evidenceCapturePipeline` staying green) to prove the shared runner change did not regress capture — the runner now hosts two seams.
- **I-12/I-13 scope preservation:** assert the route file is unchanged (M9 empty pass) and the frozen `ValidationRecord` key set is intact.

---

## 6. Failure Suite

Injection; every case preserves "no false result, no immutable-data corruption." Implements F-1…F-8 (§2.3); F-9 documented-deferred. Notes:

- **F-1/F-2/F-3** must go **through the concrete `createFileSettlementReadPort`** (temp dir with a corrupt/permission-denied file), not a hand-thrown fake — this is the strict-propagation proof the 2B suite lacked at the port grain.
- **F-4** covers both grains: build-time `ArchiveStateConflictError` (divergent-hash validation head) *and* append-time `immutable_violation` from `settleSnapshot` (mirrors `evidenceSettlement` test 24/24b) → run `failed`, never downgraded.
- **F-6** is the settlement no-false-result keystone: a mismatched `matchId` is rejected by C3 before any store read/write — assert zero writes.
- **F-7** crash/retry: idempotency keystone — N committed, re-fire completes the rest, **no duplicate revision** (rides M8 revision idempotency).
- **F-8** minimal overlap only (single-node held lock → second skipped). The full multi-worker/cross-process matrix is **2E** — explicitly not a 2C gate.

---

## 7. Correction and Replay Suite

The correction path (U-9/U-10/U-11, I-8/I-9) plus replay/determinism (R-1…R-5, §2.4).

- **Correction semantics (rides frozen M8, proven by `evidenceSettlement` 17–23, 34–36):** a changed authoritative outcome → exactly one correction revision; the earlier revision stays byte-identical; a missing/invalid `correctionCause` on a change → fail-closed `invalid_input` (no write). Stage 2C's new burden is only **detecting** the change from `currentValidationHeads` and **choosing** the cause (§9 C-1) — the append semantics are already frozen and tested.
- **R-2 (identity vs eval instant)** is the sharpest determinism guard: `completionInstant` must be a deterministic source-derived value (kickoff-anchored), so two fires at different `evaluationInstant` produce a byte-identical record → M8 `no_change`. If `defaultCompletionInstant` ever falls back to `evaluationInstant`, this test fails and exposes the leak — make it explicit.
- **R-4 (correction replay)** guards the correction path against oscillation: once corrected, re-firing the same changed source is `no_change`, not a second correction.
- **R-5 (no cursor)** re-asserts INV-A for the settlement path (grep-guard + a fresh-process reproduction).

---

## 8. Deferred Stage 2D / 2E Tests (NOT counted against 2C)

| Deferred to | Tests |
|---|---|
| **2D — deadline / diagnostics** | INV-D effective-deadline clamp (≤45 s) + remaining-ms guard for settlement; `deferred_by_deadline` counting; producer-stage diagnostics/metric merge (`discovered/eligible/selected/deferred/processed/backlog`) + reconciliation identities; no-entity-id-label cardinality |
| **2E — concurrency / benchmark / activation** | full multi-worker/overlap matrix (cross-process, durable-lock prod fail-closed for settlement); benchmark at the settlement ceiling (≤150) vs representative accumulated archive depth < 45 s; activation (flags-on, real completed-rows source) end-to-end; **F-9** DB-backed `pg_advisory_unlock`-throw → run still `succeeded` (H-1/L-2 carry-forward) |

Per the review discipline established in 2B, **Stage 2C must not be failed for the absence of these** — they are intentionally later sub-stages.

---

## 9. Binary Acceptance Gate

Stage 2C is test-complete when **all** hold (binary, no partial credit):

- **G-1 (Unit):** U-1…U-13 green, deterministic on repeat.
- **G-2 (Integration):** I-1…I-13 green, including the **in-lock ordering probe (I-1)**, **lock-unavailable no-invoke (I-3)**, and a **real end-to-end append (I-6) + correction (I-8)**.
- **G-3 (Failure):** F-1…F-8 green, with F-1..F-3 exercised **through the concrete port** and F-6 proving zero writes on mismatch.
- **G-4 (Replay):** R-1…R-5 green, including **R-2 (eval-instant does not alter identity)** and **R-4 (correction replay = no extra revision)**.
- **G-5 (Regression):** full `npm test` green at `baseline + new`, 0 fail / 0 skip; explicit anchors stay green — `evidenceSettlement` (34), `evidenceArchiveStateBuilders` (25), `evidenceCandidateProvider` (48), `evidenceCapturePipeline` (9, capture unchanged), `m9Activation` (18), `m9Concurrency` (11), `evidenceInputIdentity` (10, incl. "settlement leaves inputContentHash unaffected" test 50).
- **G-6 (Static):** typecheck exit 0; lint clean; **no frozen contract modified** (diff gate over `types/evidence/*`, store interfaces, `settlement.ts`/`outcomes.ts`, identity/hash/revision formulas, archive formats); determinism guard (no `Date.now`/`Math.random`) extended to `settlement-pipeline.ts`.

The current pre-2C baseline to re-establish: full suite **1769/1769** (post-2B), typecheck exit 0, lint clean. Every mandatory test above maps to a capability that already exists in the frozen substrate (M8 append/correction, 2A `currentValidationHeads`, M9 lock) or is a thin symmetric addition of the proven 2B template (strict reader, concrete port, runner seam).

---

## 10. Verdict

### STAGE 2C TEST PLAN CONDITIONALLY READY

The plan is complete and implementation-ready for the unit, integration, failure, and replay suites, and every mandatory test maps to a real, already-tested capability: the M8 first-settle/correction/idempotency substrate (34 green tests), the Stage 2A settlement archive-state builder with the `currentValidationHeads` (MC-1) enrichment that exists *specifically* to enable corrections, the M9 durable lock, and the proven Stage 2B wiring template (strict reader → concrete port → runner `provideCandidates` seam). Settlement's lack of a live-derivation blocker means the plan can — and the gate requires it to — prove a **real end-to-end `ValidationRecord` append and correction**, closing the assembly-only limitation 2B carried.

**One condition** gates a clean "READY":

- **C-1 (correction-cause policy) — the single unresolved decision.** The correction sub-plan (U-9/U-10/U-11, I-8, R-4) requires two things that do not exist yet and one product decision: (a) extend the Stage 1 settlement classifier context to consume `currentValidationHeads` (today it carries only `capturedFixtureIds`/`settledFixtureIds`); (b) **pin the `CorrectionCause` selection policy** — the architecture (locked-discovery §12) flagged choosing `result_reinterpreted`(→`settlement_correction`) vs `source_lineage_changed`(→`data_correction`) as a genuine data-lineage decision, not mechanical wiring. Recommended default to pin: a same-lineage authoritative-result change (e.g. a corrected score, postponed→completed) is `result_reinterpreted`; `source_lineage_changed` is reserved for a replaced retained basis. Until this policy is pinned, the correction tests' asserted cause values are provisional. **All non-correction unit/integration/failure/replay tests are unconditionally READY.**

If the project instead elects to **defer corrections** (first-settle-only Stage 2C, corrections to a later stage — the original locked-discovery posture), then U-9/U-10, I-8/I-9, and R-4 move to that later stage and the remainder is **STAGE 2C TEST PLAN READY** as-is.

---

**Confirmation:** the only file created by this task is `docs/plans/m10-stage-2c-test-plan.md`. No test was written or modified; no runtime code was modified. All cited types, functions, fields, file paths, and test counts were read from the current repository.

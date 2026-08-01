# M10 Stage 2C — Settlement Pipeline Wiring — Closure Record

**Document type:** Formal milestone closure (documentation-only). **No runtime code, test, route, flag, configuration, archive, database, scheduler, environment, or deployment was modified.** The only file created is this document.
**Milestone:** Sprint 23B — M10 (Live Candidate Pipeline), **Stage 2C — Settlement Pipeline Wiring**.
**Date:** 2026-07-30
**Governing spec:** `docs/architecture/m10-live-candidate-pipeline-specification.md` (Rev A1).

**Reviews reconciled (five independent implementation reviews + pre-implementation corpus):**
- `m10-stage-2c-implementation-review.md` — Implementation correctness → **APPROVED**, no blocker, no runtime remediation.
- `m10-stage-2c-implementation-production-review.md` — Production-safety / failure-mode → **CONDITIONALLY PASSED**, no blocker.
- `m10-stage-2c-implementation-performance-review.md` — Performance / scalability → **CONDITIONALLY PASSED**, no blocker (single-read 1/1/1 instrumented).
- `m10-stage-2c-test-coverage-review.md` — Test & coverage → **APPROVED**, no blocker (18/18 items; closes the 2B mock-fidelity gaps).
- `m10-stage-2c-implementation-migration-review.md` — Migration / frozen-contract → **MIGRATION COMPATIBLE**, no schema change, no migration.
- Pre-implementation inputs also read: `m10-stage-2c-settlement-integration-plan.md`, `m10-stage-2c-production-safety-review.md`, `m10-stage-2c-performance-review.md`, `m10-stage-2c-test-plan.md`, `m10-stage-2c-migration-compatibility-review.md`, `m10-stage-2c-settlement-pipeline-wiring.md` (impl record), `m10-stage-2b-closure.md`.

---

## 1. Closure Summary

Stage 2C wires the **first-settlement-only** settlement producer into the M9 settlement runner — the structural mirror of the closed Stage 2B capture wiring, on the settlement axis:

```
Strict Settlement Archive State (Stage 2A: snapshots + validations, one bounded read each)
  → Stage 1 Settlement Provider (buildSettlementCandidates)
     → SettlementCandidate[]
        → M8 Settlement Batch Runner (runPredictionSettlementJob → runSettlementBatch → settleLatestSnapshotForFixture)
```

The change-set is **four files** (1 created, 3 modified additively): `settlement-pipeline.ts` (new server-only module), `readAllValidationsStrict` (new module-level strict reader), the `provideCandidates` seam on `runPredictionSettlementJob`, and the new test file. The producer runs **inside the held durable `job:prediction_settlement` lock** (INV-L); strict reads are fail-closed; each archive is read once (no O(F²) discovery); the M9 empty-safe default and flag short-circuit are preserved; the cron route is **unchanged and dormant**. The completed-rows source loader is a required injected seam with **no live default** (BQ-1).

The single genuinely-new concern — **corrections** — is scoped out and made structurally non-representable: `currentValidationHeads` is never consumed, `correctionCause` is never produced, already-settled fixtures are excluded by the Stage-1 provider, and a causeless changed outcome fails **closed** to M8 `invalid_input` (no write). M8, `ValidationRecord`, the store interfaces, and the archive format are untouched; no schema change, no migration.

**Five-way reviewer consensus: no Stage 2C blocker, no runtime remediation required, safe to merge and close.** Every "CONDITIONALLY" qualifier is conditioned only on later-stage activation gates, none on a Stage-2C defect. Validation is green on every axis (full suite **1795/1795**, typecheck exit 0, lint clean).

**Final status:**

# STAGE 2C COMPLETE — DORMANT FIRST-SETTLEMENT WIRING

This closure explicitly does **not** claim M10 complete, production-activation readiness, a live settlement source, complete correction support, deadline enforcement, complete diagnostics, or capacity readiness.

---

## 2. Implemented Scope

Verified present and correct across all five reviews:

1. **Strict whole-archive validation reader** — `readAllValidationsStrict(env?)` (`lib/archive/evidence/file.ts`), a one-line mirror of `readAllSnapshotsStrict`, reusing the existing private `readNdjson` (ENOENT ⇒ `[]`; malformed / EACCES/EPERM / EIO/EBUSY / other errno ⇒ throw). Module-level export — the `EvidenceArchiveStore` interface is **not** widened.
2. **Concrete read port** — `createFileSettlementReadPort(env?)` satisfying the Stage-2A `SettlementArchiveReadPort` from `readAllSnapshotsStrict` + `readAllValidationsStrict`, both resolved from the same `evidenceArchivePaths(env)` (one evidence dir; no odds-dir asymmetry).
3. **Settlement producer** — `produceSettlementRequests(deps, config)`: loads completed rows + `buildSettlementArchiveState` (concurrently, one bounded read each), runs the Stage-1 provider, returns the existing `SettlementProviderResult` verbatim.
4. **Runner seam** — optional `provideCandidates?: () => Promise<readonly SettlementCandidate[]>` on `runPredictionSettlementJob`, invoked **inside** `runWithLock("prediction_settlement", …)`; precedence pinned (producer wins when both supplied); `candidates ?? []` fallback preserved.
5. **Tests** — `tests/evidenceSettlementPipeline.test.ts` (26).
6. **Implementation record** — `m10-stage-2c-settlement-pipeline-wiring.md`.

---

## 3. Explicitly Excluded Scope

Confirmed absent (route dormant, firewalled, no M8 change):

- **Correction discovery** — no `currentValidationHeads` consumption, no `correctionCause` production, no correction policy, no reinterpretation of an existing head (§6 firewall).
- **Live activation** — cron route unchanged; nothing composes `provideCandidates` in production; completed-rows loader is an injected dormant seam (no live default).
- **Deadline enforcement (INV-D)**, **diagnostics aggregation**, **replay/concurrency machinery** — deferred.
- **Capture-path change** — `capture-pipeline.ts` and `runEvidenceCaptureJob` untouched.
- **Schema / migration / new archive field / store-interface widening / Postgres** — none.
- **Cron / flag / scheduler / config / environment / deployment** — none.
- The **H-1 unlock-throw false-500** is NOT addressed here — carried forward to Stage 2E.

---

## 4. Independent Review Reconciliation

| Review | Verdict | Blocker? | Runtime remediation? | Basis (independently re-verified this pass) |
|---|---|---|---|---|
| Implementation | APPROVED | No | No | Only-the-chain scope; INV-L in-lock; fail-closed strict reads; Stage-2A reused; firewall structural+tested; M8/`ValidationRecord`/route untouched. |
| Production safety | CONDITIONALLY PASSED | No | No | All 20 failure modes → safe no-op/deferred/failed/retryable; no non-atomic pair (validations-only); false correction non-representable (proven). |
| Performance | CONDITIONALLY PASSED | No | No | Instrumented **1/1/1** (snap/val/source) single read; no per-fixture discovery scan; no regression; dominant cost is frozen M8, benchmark deferred. |
| Test coverage | APPROVED | No | No | 18/18 coverage items; closes 2B MF-1/MF-2/MF-3 + adds INV-L lock-gating proof; M8 verified untouched. |
| Migration / contract | COMPATIBLE | No | No | Four-file additive diff (mtime-confirmed); zero frozen-contract change; no schema/migration; append-only preserved; adapter-neutral port. |

**Reconciliation (not a copy of verdicts):**
- **Unanimous on the load-bearing invariants** — INV-L (discovery in-lock, proven by the lock-unavailable no-invoke test), fail-closed strict reads (proven end-to-end), single-bounded-read reuse (instrumented 1/1/1), the first-settlement firewall (source-scanned + M8 causeless-change backstop tested), frozen M8/`ValidationRecord`/format unchanged (mtime-confirmed). Each is demonstrated by **code + test**, not comment.
- **The three "CONDITIONALLY" qualifiers do not overlap on any Stage-2C defect.** They point exclusively at later-stage gates (INV-D deadline + the frozen M8 O(F²) benchmark, producer diagnostics/error-code granularity, live completed-rows loader, single-writer config, H-1, corruption sweep, Stage-3 corrections). None is a runtime defect in the dormant slice.
- **Reconciled improvement over Stage 2B:** the 2B "silent both-provided precedence" non-blocking note is **resolved** here — precedence is pinned in code (`provideCandidates` wins), documented at the seam, and pinned by a dedicated test. The 2B mock-fidelity gaps (concrete port fake-only; no real end-to-end append; no real-producer-as-callback) and the 2B missing in-lock ordering test are **all closed** by the 2C suite.
- **One observability nuance surfaced (production-safety CF-2, non-blocking):** the runner's `hardFailed` rule flips a run to `failed` only on `writeFailed`/`immutableViolation` — `invalidInput`/`fixtureMismatch`/`invalidScore` are counted (no false settlement is ever written) but do **not** alert via the 500 path. This is inherited M9/2B behaviour, not a Stage-2C regression; recorded under Stage 2D (diagnostics / specific codes).
- **No dissent on closure:** all five reviewers independently state no blocker and no runtime remediation; four say "may close YES" (or the equivalent APPROVED/COMPATIBLE), and the production-safety CONDITIONALLY PASSED explicitly says "Stage 2C may close."

---

## 5. Invariant Evidence

| Invariant / condition | Evidence (code + test) | Status |
|---|---|---|
| **Strict settlement archive reads implemented** | `readAllValidationsStrict` = `readNdjson(evidenceArchivePaths(env).validations)`; ENOENT→[], else throw. Tests: malformed/EISDIR → throw; ENOENT → []. | **Met** |
| **`readAllSnapshotsStrict` used once per discovery** | `buildSettlementArchiveState` calls it once (`Promise.all`); instrumented `snap===1`; test `read bounds`. | **Met** |
| **`readAllValidationsStrict` used once per discovery** | Same builder; instrumented `val===1`; test `read bounds`. | **Met** |
| **Stage 2A archive-state builder reused unchanged** | `settlement-pipeline.ts` imports `buildSettlementArchiveState` from `./archive-state`; `builders.ts`/`normalize.ts` untouched; 2A suite 25/25. | **Met** |
| **Stage 1 settlement provider reused** | `buildSettlementCandidates` called verbatim; provider suite 48/48. | **Met** |
| **Producer callback inside the durable settlement lock** | Awaited inside `runWithLock("prediction_settlement", …)`; test *lock unavailable → skipped, producer never called* (`calls===0`). | **Met** |
| **Feature-flag skip before discovery** | `isSettlementEnabled` short-circuits before `runWithLock`; test *disabled flag → skipped, producer never called*. | **Met** |
| **Lock-unavailable path skips discovery** | Pre-acquire `job:prediction_settlement` → `skipped`/`lock_unavailable`, `calls===0`. | **Met** |
| **Callback rejection fails closed** | Rejecting producer → `runWithLock` catch → `failed`/`unhandled`; test asserts. | **Met** |
| **Bare settlement runner empty-safe** | Neither option → `candidates ?? []`; test *static candidates path still works*; M9 suites green. | **Met** |
| **Route dormant & unchanged** | `prediction-settlement/route.ts` = bare `runPredictionSettlementJob()`; scope test asserts no `provideCandidates`. | **Met** |
| **No live completed-row loader exists** | `loadCompletedRows` required injected seam, no default (BQ-1). | **Met** |
| **Already-settled fixtures excluded** | Provider `already_settled` on `settledFixtureIds`; test → 0 candidates. | **Met** |
| **`currentValidationHeads` not consumed** | Comment-stripped source scan asserts absent; provider reads only captured/settled sets. | **Met** |
| **`correctionCause` never produced** | Source scan asserts absent; candidate literal omits it. | **Met** |
| **No correction candidate emitted** | Provider exclusion + M8 causeless-change `invalid_input` (both tested). | **Met** |
| **M8 settlement/revision logic untouched** | `settlement.ts`/`settlement-run.ts`/`outcomes.ts` byte-unchanged; scan finds no 2C markers; M8 suite 34/34. | **Met** |
| **`ValidationRecord` & frozen contracts untouched** | `types/evidence/*`, store interfaces, identity/hash formulas byte-unchanged; typecheck exit 0. | **Met** |
| **Archive format unchanged / no schema / no migration** | Reader reuses `readNdjson`; no new field; mtime-confirmed additive diff. | **Met** |
| **Deterministic output preserved** | No `Date.now`/`Math.random`; injected `evaluationInstant`; `completionInstant` = source kickoff; shuffled-input deep-equal test. | **Met** |
| **Full validation green** | See §7. | **Met** |

---

## 6. First-Settlement-Only Firewall

Three independent, verified layers make a false correction non-representable:

1. **Producer exclusion.** The Stage-1 provider rejects any fixture in `settledFixtureIds` as `already_settled`, so an already-settled fixture is never emitted — even if its source outcome changed. Proven: *already-settled fixture → 0 candidates*.
2. **Cause-absent hard stop.** The producer never sets `correctionCause`; if a changed-outcome candidate reached M8, `head.state !== outcome.state` with `correctionCause === undefined` → `invalid_input`, **no write**. Proven end-to-end: *false-correction impossibility — causeless changed outcome → M8 invalid_input, no append*.
3. **Source-level scan.** A comment-stripped source scan asserts `settlement-pipeline.ts` code contains neither `correctionCause` nor `currentValidationHeads`.

Additional: `correctionCause` absent on every produced candidate (*captured terminal → correctionCause absent*, *BF-S1 terminals → undefined*); M8 remains the authoritative settlement writer + idempotency backstop; no `ValidationRecord`/identity/revision/lineage rule changed. Under the single-writer lock, `decideValidationAppend`'s revision-chain guarantees at most one rev(N+1) even if corrections were later enabled — no forked/duplicate revision is possible.

---

## 7. Validation Results

Re-run this pass (2026-07-30); exact commands and totals:

| Check | Command | Result |
|---|---|---|
| Stage-2C pipeline | `node --require ./scripts/mock-server-only.cjs --import tsx --test tests/evidenceSettlementPipeline.test.ts` | **26 pass / 0 fail / 0 skip** |
| Stage-2A archive-state | `… --test tests/evidenceArchiveStateBuilders.test.ts` | **25 / 0 / 0** |
| Stage-1 settlement provider | `… --test tests/evidenceCandidateProvider.test.ts` | **48 / 0 / 0** |
| M8 settlement | `… --test tests/evidenceSettlement.test.ts` | **34 / 0 / 0** |
| M9 activation (C1–C7) | `… --test tests/m9Activation.test.ts` | **18 / 0 / 0** |
| M9 concurrency / lock | `… --test tests/m9Concurrency.test.ts` | **11 / 0 / 0** |
| Stage-2B capture pipeline | `… --test tests/evidenceCapturePipeline.test.ts` | **9 / 0 / 0** |
| Full suite | `npm test` | **1795 pass / 0 fail / 0 skip** |
| Typecheck | `npm run typecheck` (`tsc --noEmit -p tsconfig.typecheck.json`) | **clean — exit 0** |
| Lint | `npm run lint` (`next lint`) | **clean — no ESLint warnings or errors** |

Baseline continuity: Stage 2B closed at 1769/1769; Stage 2C adds +26 → **1795/1795**. No flakiness observed.

---

## 8. Stage 2C Optional Cleanup

*Optional; none blocks closure.*

| # | Item | Source | Note |
|---|---|---|---|
| CL-1 | Provider diagnostics dropped at the producer seam (`provideCandidates` returns only the array; `CandidateDiagnostics` discarded). | impl NB-2; safety CF-2 | Observation now; reconnection is Stage 2D (D-5). |
| CL-2 | Generic `errorCode:"unhandled"` for a producer rejection (route still maps `failed`→500). | impl NB-3; safety CF-2 | Specific codes are Stage 2D (D-6). |
| CL-3 | Optional explicit EACCES/EPERM coverage *through the concrete port* (currently covered on `readNdjson` directly + EISDIR/malformed through the port). | test-coverage N-1 | Low value (same errno branch). |
| CL-4 | Explicit two-`evaluationInstant` determinism test (single-instant `completionInstant`=kickoff is already asserted). | test-coverage N-2 | Nails replay-determinism. |
| CL-5 | Explicit no-cursor / process-restart guard (INV-A holds by construction; port built fresh per call). | test-coverage N-3 | Robustness nice-to-have. |
| CL-6 | Document both-static-and-producer precedence. | task list | **Already resolved in 2C** — precedence pinned in code + doc + a dedicated test (producer wins). No further work. |
| CL-7 | Optional record-level hash re-verification discussion (reader does not re-verify each `contentHash`; matches M8's own `listValidations`; conflicts caught by Stage-2A `ArchiveStateConflictError`). | impl NB-4; perf N-1 | Discussion only; a property of the frozen substrate. |
| CL-8 | `currentValidationHeads` projection is built+retained by the normalizer though the firewall never reads it (needed for `settledFixtureIds` anyway). | perf N-1 | Optional: skip the head projection while corrections are unwired. |

---

## 9. Stage 2D Carry-forward (Operational Controls)

| # | Item | Source |
|---|---|---|
| D-1 | Effective deadline INV-D ≤ 45 s (never the 300 s `runDeadlineMs`) for the settlement path. | safety CF-1; perf gate 2 |
| D-2 | Mid-batch remaining-time guard (start no candidate without budget; `deferred_by_deadline`). | safety CF-1; perf |
| D-3 | Default candidate ceiling 100 — already fail-safe in the provider (`normalizeBatchLimit`); Stage 2D wires the configured value + observes deferrals. | perf §5 |
| D-4 | Hard maximum candidate ceiling 150 — already clamped by the provider; confirm at the call site. | perf §5 |
| D-5 | Diagnostics aggregation (merge `CandidateDiagnostics` into `resultCounts`/metrics; reconciliation identities; no entity id as a label). | safety CF-2; impl NB-2 |
| D-6 | Specific producer / read / provider failure codes (replace generic `unhandled`; decide whether `invalidInput`/`fixtureMismatch`/`invalidScore` should alert). | safety CF-2; impl NB-3 |
| D-7 | Backlog-size observability. | spec §10 |
| D-8 | Oldest-pending-age observability. | spec §10 |
| D-9 | Live completed-row source loader (BQ-1) — concrete finished-fixture loader (likely a thin filter over `readDailyArchive(date)`). | safety CF-3; impl NB-1 |
| D-10 | Source-loader isolation & accounting — the live loader must not throw uncaught mid-run; map faults to defer/count. | safety CF-3 |

---

## 10. Stage 2E Activation & Production Gates

| # | Gate | Source |
|---|---|---|
| E-1 | Representative-depth whole-route settlement benchmark < 45 s. | perf gate 1; safety CF-1 |
| E-2 | Settlement-specific M8 read-amplification benchmark (frozen `F·(2+2T) ≈ 1000` scans/run, O(F²) in depth). | perf §2 |
| E-3 | Event-loop delay benchmark (synchronous parse ~4–6 s/100 k). | perf §4 |
| E-4 | Peak RSS benchmark (concurrent snapshot+validation materialization, GB-scale on deep archive). | perf §3 |
| E-5 | Archive-depth ceiling below the snapshot (~357 k) **and** validation (~524 k) `MAX_STRING_LENGTH` walls. | perf §5 |
| E-6 | Overlap / multi-worker verification (409-not-500, loser does no discovery). | safety §17; test-coverage 2E |
| E-7 | Crash / retry verification matrix. | safety §14 |
| E-8 | Route activation tests (auth/rate-limit/status-map unchanged; flag-off no discovery; reads only after the lock). | test-coverage 2E |
| E-9 | H-1 unlock-throw false-500 remediation (swallow/log). | safety CF-5 |
| E-10 | Single-writer production configuration gate (`EVIDENCE_DATABASE_URL` present+reachable, `NODE_ENV=production`). | safety CF-4 |
| E-11 | fsync / scheduled `verifyValidationChain`+`verifyEvidenceChain` sweep / line-level quarantine strategy. | safety CF-6 |
| E-12 | Production activation checklist. | spec / M9 closure |

---

## 11. Later Correction-Stage Carry-forward

| # | Item | Source |
|---|---|---|
| X-1 | Consume `currentValidationHeads` (the reserved MC-1 enrichment). | safety CF-7; migration §6 |
| X-2 | Genuine correction detection (`head.state ≠ new outcome` per `(fixture, market)`). | plan §6.2 |
| X-3 | `correctionCause` policy (only when the head genuinely changed). | plan §6.4 |
| X-4 | Distinguish `settlement_correction` from `data_correction` (via `result_reinterpreted` / `source_lineage_changed`). | M8 `determineCorrectionReason` |
| X-5 | Correction replay / idempotency tests. | test-plan (deferred) |
| X-6 | Correction observability. | spec §10 |
| X-7 | Correction revision-burst benchmark. | perf (deferred) |

---

## 12. Future Adapter and Migration Concerns

*Out of M10; forward obligations of the eventual reversible Postgres cutover. Non-format-changing.*

| # | Concern | Source |
|---|---|---|
| FA-1 | Shared `EVIDENCE_ARCHIVE_ADAPTER`-keyed read-port resolver across capture + settlement. | migration CS-4; 2B SC-1 |
| FA-2 | Capture and settlement read/write adapter consistency (both `createFile*ReadPort` are file-specific and do not consult the adapter env; M8's under-lock head re-read backstops correctness even under a mismatch — inefficient, never a forged revision). | migration CS-4 |
| FA-3 | Future Postgres implementation of the typed read ports (`readAllSnapshots`/`readAllValidations` → indexed `SELECT`, current head = `DISTINCT ON (id) ORDER BY revision DESC`; no contract change). | migration §6 |
| FA-4 | Prevent file/Postgres read-write divergence (inject a matching read port at cutover). | migration CS-4 |
| FA-5 | Freeze/version the hashed `completionInstant → settledAt` derivation before activation (deterministic today; a cross-version change is a replay divergence, not a stored rewrite). | migration CS-1 |

---

## 13. Final Closure Decision

**STAGE 2C COMPLETE — DORMANT FIRST-SETTLEMENT WIRING.**

The evidence supports every closure condition (§5): strict settlement archive reads implemented and each used once per discovery; Stage-2A builder + Stage-1 provider reused unchanged; producer inside the durable lock; flag-skip and lock-unavailable both skip discovery; callback rejection fails closed; bare runner empty-safe; route dormant and unchanged; no live loader; already-settled excluded; `currentValidationHeads` not consumed; `correctionCause` never produced; no correction candidate emitted; M8/`ValidationRecord`/frozen contracts/archive format untouched; no schema change, no migration; deterministic output; full validation green.

- **No implementation blocker remains** — five independent reviews concur.
- **No runtime remediation required** — the dormant slice merges as-is.
- **All five reviews reconciled** (not copied); the sole cross-review nuance (partial completeness of `settledFixtureIds` vs a newer captured-but-unsettled snapshot for the same fixture) is a **completeness gap deferred to the correction stage, never an incorrect settlement** — not a blocker.
- **Route dormant · corrections excluded · schema & contracts frozen** — all verified.

**Stage 2C closed: YES**
**Stage 2D preparation authorized: YES**
**Stage 2D implementation authorized: NO — preparation reviews required first**

This closure makes **no** claim of M10 completion, production-activation readiness, a live settlement source, complete correction support, deadline enforcement, complete diagnostics, or capacity readiness.

---

## 14. Next Authorized Milestone

**M10 Stage 2D — Operational Controls.**

Stage 2D adds the operational controls that gate a *useful* live run (across both the capture and settlement paths): the INV-D effective deadline (≤ 45 s) + mid-batch remaining-time guard, call-site ceiling wiring/observation (default 100 / hard 150, already provider-fail-safe), producer diagnostics aggregation + specific failure codes, backlog / oldest-pending observability, and the live completed-rows source loader with fault isolation (§9, D-1…D-10).

**Stage 2D implementation MUST NOT begin** until its own preparation reviews — architecture, safety, performance, test, and migration — are authored and reconciled, exactly as Stage 2C was prepared before implementation. The Stage 2E activation gates (§10), the later correction stage (§11), and the future adapter/migration concerns (§12) remain prerequisites to any *live* activation and are not unlocked by this closure.

---

### Statement

Documentation-only closure. The single file created is this document. **No runtime code, no test, no route, no feature flag, no configuration, no archive, no database, no scheduler, no environment, and no deployment was modified.** All cited results (targeted suites, full suite 1795/1795, typecheck exit 0, lint clean) were re-run against the current repository this pass; the five reviewer verdicts were read in full and reconciled rather than copied.

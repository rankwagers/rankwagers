# M10 Stage 2B — Capture Pipeline Wiring — Independent Test & Coverage Review

**Review type:** Test & verification review only. **No test or implementation file was modified.** The only file created is this document.
**Date:** 2026-07-30
**Reviewer:** Independent Test & Verification Reviewer, Sprint 23B / M10 Stage 2B.
**Under review:** `lib/evidence-capture/candidates/capture-pipeline.ts`, the additive `readAllSnapshotsStrict` (`lib/archive/evidence/file.ts`) / `readAllOddsRecordsStrict` (`lib/evidence-capture/odds-archive/file.ts`), the `provideCandidates` runner seam (`lib/jobs/runner.ts:288-321`), and `tests/evidenceCapturePipeline.test.ts` (9 tests).
**Read:** `docs/plans/m10-stage-2b-test-plan.md`, `docs/plans/m10-stage-2b-capture-pipeline-wiring.md`, `docs/plans/m10-stage-2a-implementation-review.md`, `docs/architecture/m10-live-candidate-pipeline-specification.md` (Rev A1).
**Method:** every Stage 2B source + test file read line by line; each of the nine tests mapped to the requirement it purports to prove; every adjacent suite that carries a Stage 2B property transitively identified in source; all suites, typecheck, and lint **re-run this pass** (not trusted from the wiring record).

---

## 0. Executive Verdict

### TEST COVERAGE CONDITIONALLY APPROVED

The nine Stage 2B tests are green and honest; the full suite is **1769/1769** (0 fail, 0 skip), typecheck exit 0, lint clean. The wired capture path (**archive-state → Stage 1 provider → `CaptureRequest[]` → M9 runner**) is exercised with real Stage 1/2A logic, and the load-bearing safety properties Stage 2B owns — fail-closed strict-read propagation, `provideCandidates`-rejection→`failed`, flag-skip-before-discovery, and M9 empty-safe backward compatibility — are each directly proven.

It is **not** clean-APPROVED because **two of the nine named requirements are not proven by the nine tests directly**, only by construction + transitive coverage:

- **Requirement 1 (strict read port construction):** the concrete `createFileCaptureReadPort` is **never exercised by any test** — all nine tests inject fake ports. Its two underlying readers are covered elsewhere (`readNdjson` in `evidenceArchiveFileAdapter`; odds strict read in `oddsArchive`/the 2A builders), but the port composition itself (path join to `<evidenceDir>/odds-archive`, delegation) is untested.
- **Requirement 7 (callback invocation *inside the held lock*):** the runner test proves the callback is **called once and threaded**, but **no test proves the lock is held at call time or detects a pre-lock invocation**. The property holds by construction (the callback body is inside `runWithLock`'s `fn`, `runner.ts:298-306`) and is substantiated by the M9 test that a held capture lock forces a concurrent run to skip (`m9Activation.test.ts:106`) — but Stage 2B adds no ordering/contention assertion of its own.

Neither gap is evidence of a defect, and neither is a deferred-stage concern being wrongly counted against Stage 2B (§5). Both are **regression-detection gaps within Stage 2B's own scope** and are the two conditions for a clean approval (§7 A-1, A-2). No blocking gap exists (§6).

---

## 1. Requirements Traceability

### 1.1 The nine mandated requirements → proving test(s)

| # | Requirement | Proven by the 9 tests? | Trace / basis |
|---|---|---|---|
| 1 | **strict read port construction** | **PARTIAL — not directly** | `createFileCaptureReadPort` unexercised (all tests use fake ports). Underlying readers covered transitively: `readAllSnapshotsStrict`→`readNdjson` (`evidenceArchiveFileAdapter.test.ts`), `readAllOddsRecordsStrict` (delegated from the odds store, `oddsArchive.test.ts`). |
| 2 | **one read per archive** | **YES (transitive, strong)** | `produceCaptureRequests` calls `buildCaptureArchiveState(port)` once (`capture-pipeline.ts:124`); the builder's single-read-per-store is asserted by the counting port in `evidenceArchiveStateBuilders.test.ts:328-345` (`calls.snap===1`, `calls.odds===1`). |
| 3 | **archive-state production** | **YES** | pipeline test "complete pair → already_captured" (`:100`) and "snapshot-only → partial heal" (`:123`) drive `buildCaptureArchiveState` end-to-end; 2A suite covers all six/five states + conflict. |
| 4 | **source loading** | **YES (wiring) / injected fake** | pipeline tests wire `loadSource` (fake `[pred()]`) into the provider; the real `loadPublishedDailyPredictions` default is not exercised here (covered by `evidenceCaptureSource.test.ts`). Acceptable — the wiring, not the loader, is Stage 2B's unit. |
| 5 | **provider classification** | **YES (real logic)** | the pipeline calls the *real* Stage 1 `buildCaptureCandidates`; already_captured / partial-heal / admitted paths each asserted (`:91,:119,:140`). |
| 6 | **CaptureRequest creation** | **YES** | test 1 asserts `admitted`, `fixtureId`, `modelInput.fixtureId`, and `capturedAt = kickoff − lead` (`:91-97`); leadMinutes default (`:144`). |
| 7 | **callback invocation inside the held lock** | **PARTIAL — invocation yes, in-lock ordering no** | `provideCandidates` called-once + threaded (`:182-200`). In-lock placement holds by construction (`runner.ts:298-306`) + M9 lock-skip proof (`m9Activation.test.ts:106`), but **no Stage 2B test asserts the lock is held / detects pre-lock invocation**. |
| 8 | **callback rejection becomes failed job** | **YES** | rejecting `provideCandidates` → `status:"failed"`, `errorCode:"unhandled"` (`:216-230`); lock released in `runWithLock`'s `finally`. |
| 9 | **empty-safe backward compatibility** | **YES** | static `candidates` path → `succeeded`, `considered:1` (`:202-214`); the truly-empty bare pass is the unchanged M9 baseline (`runner.ts:306` `?? []`). |

**Score: 7 proven (2 transitively), 2 partial (R1, R7).**

### 1.2 Special-attention checklist → status

| Item | Status | Where |
|---|---|---|
| discovery inside the lock, not merely called by a locked fn | **NOT PROVEN (condition A-2)** | structural only (`runner.ts:298-306`) |
| test ordering that detects pre-lock invocation | **ABSENT (condition A-2)** | — |
| strict-reader malformed NDJSON propagation | covered transitively | `evidenceArchiveFileAdapter.test.ts` (`readNdjson`), `readAllOddsRecordsStrict` code path |
| EACCES / EIO propagation | covered transitively | `evidenceArchiveFileAdapter.test.ts` (`readNdjson` errno branches) |
| snapshot hash conflict | covered | `evidenceArchiveStateBuilders.test.ts:140` (throws), `:366` through builder |
| odds hash conflict | covered | `evidenceArchiveStateBuilders.test.ts:151`; `readAllOddsRecordsStrict` conflict-throw path |
| source load failure | **NOT tested (recommended B-3)** | `loadSource` rejection path in `Promise.all` unasserted |
| derivation failure | covered at Stage 1 | `evidenceCandidateProvider.test.ts` "derivation rejection counted, not emitted" |
| fixture/window mismatch | covered at Stage 1 | `evidenceCandidateProvider.test.ts` `source_correspondence_failure` |
| complete pair skip | **covered** | pipeline `:100-121` |
| partial pair heal | **covered** | pipeline `:123-142` |
| orphan-odds observability-only | covered at 2A grain; **not at pipeline (recommended B-5)** | `evidenceArchiveStateBuilders.test.ts:114` |
| deterministic repeated production | **NOT tested at pipeline (recommended B-6)** | provider determinism at Stage 1 only |
| static candidates path compatibility | **covered** | pipeline `:202` |
| both static + provideCandidates supplied | **NOT tested (recommended B-4)** | precedence `provideCandidates` wins (`runner.ts:304`) undocumented-by-test |
| no callback when flag off | **covered** | pipeline `:232-245` (`calls===0`) |
| no callback when lock not acquired | **NOT tested (condition A-2)** | contention case absent |
| callback called exactly once | **covered** | pipeline `:196` (`calls===1`) |
| no route activation | scope-preserved by inspection | route unchanged (`app/api/internal/cron/evidence-capture/route.ts`) |
| no settlement invocation | scope-preserved by inspection | `runPredictionSettlementJob` untouched (`runner.ts:330`) |

### 1.3 Spec Gate mapping (spec §12)

Stage 2B is a partial slice; it does not attempt the full Gate A/B. Proven now: **A6-partial** (ceiling via provider, transitively), **B3** (empty/again-safe), the INV-L *structural* placement, and PB-1. **Not yet** (correctly deferred, §5): A2/A4 replay, A9/B5 deadline, B1 end-to-end mint under live derivation, B6 multi-worker overlap, B7 crash/replay.

---

## 2. Existing Coverage

**Stage 2B suite (`tests/evidenceCapturePipeline.test.ts`, 9 tests):**
- Producer (5): empty archive → 1 admitted `CaptureRequest` with correct `capturedAt`; complete pair → `already_captured`/0; snapshot-only → healing candidate; `leadMinutes` default; **strict-read throw propagates (fail-closed, never empty)** — via a *fake* throwing port.
- Runner seam (4): `provideCandidates` called once + threaded; static `candidates` M9 path intact; rejecting producer → `failed`; disabled flag → `skipped`/`capture_disabled` with producer never called.

**Adjacent suites carrying Stage 2B properties transitively (re-run, all green):**
- `evidenceArchiveStateBuilders.test.ts` (25) — single-bounded-read (counting ports), strict-read-throw propagation, snapshot/odds **hash-conflict throws** (`ArchiveStateConflictError`), order-independence. Directly backs requirements 2, 3 and the conflict items.
- `evidenceCandidateProvider.test.ts` (48) — the real classifier the pipeline calls: derivation rejection, fixture/window mismatch, ordering determinism, cap fail-safe, terminal-lifecycle. Backs requirement 5.
- `evidenceArchiveFileAdapter.test.ts` (9) — `readNdjson` ENOENT→[], EACCES/EPERM/EIO/EBUSY/malformed→throw: the real behaviour behind `readAllSnapshotsStrict`.
- `oddsArchive.test.ts` (15) — odds store `readAll` (now delegating to `readAllOddsRecordsStrict`) incl. conflict/idempotency.
- `m9Activation.test.ts` (18) / `m9Concurrency.test.ts` (11) — `runWithLock` acquires the lock before `fn`, releases in `finally`, and a **held lock forces a concurrent run to skip** (`m9Activation.test.ts:106`) — the structural anchor for requirement 7. `evidenceCaptureMint.test.ts` (14) — M6 idempotent mint the runner ultimately drives.

**Net:** the behavioural surface of Stage 2B is well covered when the transitive suites are counted; the *concrete port* (R1) and an *in-lock ordering assertion* (R7) are the two surfaces with no direct test at any grain.

---

## 3. Mock Fidelity

The nine tests are appropriately unit-scoped, but three mock choices bound what they can prove:

- **MF-1 — Concrete port replaced by fakes (touches R1).** Every producer test injects `emptyPort`/`seededPort`/`partialPort`/`throwingPort`; `createFileCaptureReadPort` and the real strict readers are never in the call path. Consequence: the "strict-read throw propagates" test (`:154`) proves `produceCaptureRequests` **forwards** a rejection, but **not** that the real reader on a real corrupt/EACCES/EIO/hash-conflict file actually rejects through the port. (The readers themselves are covered elsewhere; the *composition* is not.)
- **MF-2 — Derivation stub returns empty markets; producer↔M6 mint never joined.** `okDerive` returns `modelInput.markets: []`, so the emitted `CaptureRequest` would fail M6's mandatory-odds (zero markets = failed capture, C5) if actually minted. The runner tests sidestep this by injecting `admitted:false` `stubRequest` (→ `not_admitted`, no mint). Consequence: **no test drives the wired path to an actual snapshot + mandatory-odds mint via the producer.** This is an inherent consequence of the deliberately-deferred live M4→M5 derivation (§5), not a masked defect — but it means "the pipeline mints" is asserted nowhere yet.
- **MF-3 — Rejection test throws in the callback, not through the real producer.** Test 8 throws a synthetic string inside `provideCandidates`; it does not compose `() => produceCaptureRequests(...)` as the callback, so the real strict-throw→producer-reject→runner-`failed` chain is proven only as two disjoint halves (test 5 + test 8), never end-to-end.

Fidelity verdict: **acceptable for a wiring stage**, with MF-1 the one worth closing now (a single concrete-port test over a temp NDJSON dir), and MF-2 explicitly a §5 deferred-stage item.

---

## 4. Missing Stage 2B Tests (in-scope regression gaps)

These are Stage 2B's own scope (not deferred stages):

- **M-1 (condition) — In-lock ordering / pre-lock-invocation detection.** No test proves discovery runs *under* the held lock or would fail if it moved before the lock. Minimal proof: hold `job:evidence_capture` from another acquirer and assert the second run is `skipped`/`lock_unavailable` **and `provideCandidates` is never called** (the "no callback when lock not acquired" checklist item). This is the direct verification of INV-L — Stage 2B's headline invariant — using the M9 lock that already exists.
- **M-2 (condition) — Concrete port construction (R1).** No test constructs `createFileCaptureReadPort` or drives it against a real (temp-dir) NDJSON archive: ENOENT→empty, malformed→throw, EACCES/EIO→throw, snapshot/odds hash-conflict→throw *through the port*. Closes MF-1 and the untested `<evidenceDir>/odds-archive` path composition.
- **M-3 (recommended) — Source-load failure.** A rejecting `loadSource` must reject `produceCaptureRequests` (→ runner `failed`), symmetric to the archive-read-throw test; currently unasserted.
- **M-4 (recommended) — Both `candidates` and `provideCandidates` supplied.** Assert the deterministic precedence (`provideCandidates` wins; static `candidates` ignored — `runner.ts:304`), so the behaviour is pinned rather than incidental.
- **M-5 (recommended) — Orphan-odds observability-only at pipeline grain (CF-4).** Assert an `orphanOddsWindowKeys` window is treated as "capture proceeds" (not skipped/healed) through the pipeline, not only at the 2A normalizer.
- **M-6 (recommended) — Deterministic repeated production.** Call `produceCaptureRequests` twice with identical inputs → byte-identical `candidates` (pipeline-grain determinism; provider-grain is covered at Stage 1).

---

## 5. Deferred Later-Stage Tests (explicitly NOT counted against Stage 2B)

The wiring record §1/§7 and the test plan scope these out; per the review's instruction they are **not** coverage failures here:

- **Live async M4→M5 derivation + real producer→M6 mint end-to-end (spec B1)** — blocked on the deferred live-derivation seam (MF-2). Owner: the live-derivation stage.
- **INV-D deadline clamp/guard + benchmark (spec A9/B5)** — explicitly deferred (Stage 2D).
- **Replay / determinism over live output (spec A4)** — deferred.
- **Multi-worker / overlap concurrency machinery (spec B6/B7)** — deferred (the durable lock exists; full overlap suite is later). *Note:* M-1 above is **not** this — M-1 is the minimal single-run INV-L ordering proof using the existing lock, which is in Stage 2B scope.
- **Producer-stage diagnostics/metric aggregation (spec §10, A11 reconciliation)** — deferred.
- **Settlement wiring** — separate stage.

---

## 6. Blocking Coverage Gaps

**None.** No untested Stage 2B behaviour is both plausibly wrong and unguarded: the archive-state, classifier, fail-closed propagation, flag-skip, rejection→failed, and backward-compat properties are each proven; the two partial requirements (R1, R7) hold by construction and are covered transitively (M9 lock-skip; file-adapter/2A strict-read + conflict suites). The concrete-port path-composition risk (MF-1) degrades, at worst, to a silent ENOENT→empty read whose only consequence is an idempotent re-mint attempt (M6 `already_exists`) — not corruption or a false result. Nothing meets the blocking bar.

---

## 7. Recommended Additions

**Conditions for clean APPROVED (both are Stage 2B in-scope, low effort):**
- **A-1 = M-2** — one concrete-`createFileCaptureReadPort` test over a temp NDJSON dir (ENOENT→empty; malformed / EACCES / EIO / snapshot-hash-conflict / odds-hash-conflict → throw *through the port*).
- **A-2 = M-1** — one in-lock ordering test: held `job:evidence_capture` → concurrent run `skipped`/`lock_unavailable` **and** `provideCandidates` never invoked (detects any future pre-lock discovery).

**Non-blocking (raise coverage, defensible to defer to the next Stage 2 sub-stage):**
- **B-3 = M-3** source-load-failure → reject/`failed`.
- **B-4 = M-4** both-inputs precedence pin.
- **B-5 = M-5** orphan-odds pipeline-grain observability-only.
- **B-6 = M-6** deterministic repeated production at pipeline grain.
- **B-7** compose the real `produceCaptureRequests` as `provideCandidates` in one runner test so the strict-throw→reject→`failed` chain is proven end-to-end (closes MF-3), even ahead of live derivation.

---

## 8. Validation Results (re-run this pass)

| Check | Command | Result |
|---|---|---|
| **Stage 2B targeted** | `node --test tests/evidenceCapturePipeline.test.ts` | **9 pass / 0 fail / 0 skip** |
| **Stage 2A** | `… tests/evidenceArchiveStateBuilders.test.ts` | **25 pass / 0 fail / 0 skip** |
| **Stage 1 provider** | `… tests/evidenceCandidateProvider.test.ts` | **48 pass / 0 fail / 0 skip** |
| **M6 capture mint** | `… tests/evidenceCaptureMint.test.ts` | **14 pass / 0 fail / 0 skip** |
| **M9 runner/activation** | `… tests/m9Activation.test.ts` | **18 pass / 0 fail / 0 skip** |
| **M9 concurrency/lock** | `… tests/m9Concurrency.test.ts` | **11 pass / 0 fail / 0 skip** |
| **Full suite** | `npm test` (`tests/*.test.ts`) | **1769 pass / 0 fail / 0 skip** (1..1769) |
| **Typecheck** | `npm run typecheck` (`tsc --noEmit -p tsconfig.typecheck.json`) | **clean — exit 0** |
| **Lint** | `npm run lint` (`next lint`) | **clean — no ESLint warnings or errors** |

Consistent with the wiring record's claimed **1769/1769** (was 1760 at Stage 2A; +9 Stage 2B). No suite was flaky across the runs.

---

## 9. Verdict

### TEST COVERAGE CONDITIONALLY APPROVED

The Stage 2B capture-pipeline wiring is green (9/9), the full suite is **1769/1769**, typecheck exit 0, lint clean, and the wiring's safety-critical behaviour — strict-read fail-closed propagation, `provideCandidates`-rejection→`failed`, flag-skip-before-discovery, empty-safe M9 backward compatibility, and archive-state/classifier production over real Stage 1/2A logic — is directly proven. No frozen contract, identity, hash, or archive format is touched; the change is additive (two exported strict readers + one optional runner seam).

Approval is **conditional** because two of the nine mandated requirements are proven only by construction + transitive coverage, not by a direct Stage 2B test: **(1) strict read port construction** (the concrete `createFileCaptureReadPort` is unexercised) and **(7) callback invocation *inside the held lock*** (invocation is proven; in-lock ordering / pre-lock-invocation detection is not). Both are Stage 2B-scope regression-detection gaps — not deferred-stage work and not evidence of a defect — closed by the two small tests in §7 (A-1, A-2). Deferred deadline/replay/concurrency/live-derivation suites (§5) are correctly out of scope and are **not** held against this stage.

---

## Final Response Summary

- **Verdict:** **TEST COVERAGE CONDITIONALLY APPROVED.**
- **Blocking missing tests:** **none.**
- **Non-blocking missing tests (conditions for clean approval, both Stage 2B in-scope):**
  1. **Concrete `createFileCaptureReadPort` test** over a temp NDJSON dir — ENOENT→empty; malformed / EACCES / EIO / snapshot-hash-conflict / odds-hash-conflict → throw *through the port* (requirement 1 / MF-1).
  2. **In-lock ordering test** — held `job:evidence_capture` → concurrent run `skipped` **and** `provideCandidates` never called (requirement 7 / INV-L / "no callback when lock not acquired").
  - Further non-blocking: source-load-failure→`failed`; both-inputs precedence; orphan-odds pipeline-grain; deterministic repeated production; real-producer-as-callback end-to-end (§7 B-3…B-7).
- **Exact validation results:** Stage 2B **9/9**; Stage 2A **25/25**; Stage 1 provider **48/48**; M6 **14/14**; M9 activation **18/18**; M9 concurrency **11/11**; **full suite 1769/1769** (0 fail, 0 skip); typecheck **exit 0**; lint **clean**.
- **Deferred (not counted against Stage 2B):** live M4→M5 derivation + end-to-end mint, INV-D deadline, replay, multi-worker overlap, producer diagnostics aggregation, settlement wiring.
- **Files modified:** exactly one created — `docs/plans/m10-stage-2b-test-coverage-review.md`. **No test or implementation file was modified; review-only confirmed.**

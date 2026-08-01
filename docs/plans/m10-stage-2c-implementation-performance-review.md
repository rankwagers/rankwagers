# M10 Stage 2C — Settlement Pipeline Wiring — Implementation Performance Review

**Document type:** Performance & scalability review (review-only). No runtime code, test, contract, feature flag, cron route, runner, schedule, environment, database, archive, config, or existing document was modified. The **only** file created is this document.
**Date:** 2026-07-30
**Reviewer:** Performance Reviewer, Sprint 23B / M10 Stage 2C.
**Under review (built, verified this pass):** `lib/evidence-capture/candidates/settlement-pipeline.ts`; the new strict reader `readAllValidationsStrict` (`lib/archive/evidence/file.ts:165-169`); the reused `readAllSnapshotsStrict` (`file.ts:147-151`); the Stage-2A settlement builder/normalizer (`archive-state/builders.ts:53-61`, `normalize.ts:136-212`); the runner settlement seam (`lib/jobs/runner.ts:349-371`); `tests/evidenceSettlementPipeline.test.ts`.
**Method:** every `file:line` read this pass; a **bounded scratch benchmark** ran the *actual* `produceSettlementRequests` + `createFileSettlementReadPort` over synthetic temp NDJSON (deleted; **no repo fixture, no runtime/test change**). Numbers are **[measured-2C]** (this pass), **[measured-2B]** (shared snapshot read, prior pass), or **[derived]**.

**VERDICT: PERFORMANCE REVIEW CONDITIONALLY PASSED** — the wiring is correct, regression-free, and single-read as designed (verified 1/1/1 by instrumentation); the conditions are pre-activation gates (INV-D deadline, whole-route benchmark, validation string wall), not defects. See §7–§8.

---

## Verification checklist (all confirmed)

| Item | Result | Evidence |
|---|---|---|
| `readAllSnapshotsStrict` called **once**/run | ✅ | **[measured-2C]** `calls.snap=1`; test `:242`; `builders.ts:56-59` |
| `readAllValidationsStrict` called **once**/run | ✅ | **[measured-2C]** `calls.val=1`; test `:243`; `builders.ts:56-59` |
| `buildSettlementArchiveState` called **once**/run | ✅ | `settlement-pipeline.ts:109` (single call); internally 2 reads via one `Promise.all` |
| **one** provider classification | ✅ | `buildSettlementCandidates` invoked once (`:112`); one pass over `completedRows` |
| **no per-fixture archive scans** in discovery | ✅ | provider consumes pre-built Sets (`settlement-provider.ts:100-104`); per-fixture `listValidations`/`latestSnapshot` exist **only** in frozen M8 |
| no duplicate parsing | ✅ | each file `readNdjson`-parsed once/run; `readAllValidationsStrict` does **not** re-verify hashes (unlike odds) — `file.ts:161` |
| deterministic ordering | ✅ | total comparators `(completionInstant asc, fixtureId asc)`, input-order-independent (`ordering.ts`; normalizer sorts heads by `validationId`, `normalize.ts:201-205`) |
| source loaded once | ✅ | **[measured-2C]** `calls.src=1`; `settlement-pipeline.ts:108` |
| first-settlement firewall | ✅ | `currentValidationHeads` never consumed; `correctionCause` never set (`settlement-pipeline.ts:18-24`) |
| Stage 2C test suite | ✅ **26/26 pass** | `tests/evidenceSettlementPipeline.test.ts` (read-only run this pass) |

---

## 1. Complexity

Path: **strict reads → `buildSettlementArchiveState` → source (completed rows) → Stage-1 provider → M8 batch.** Variables: **A** = archive rows (snapshots `A_s`, validations `A_v`); **F** = selected ≤ ceiling; **T** ≤ M terminal-and-changed markets/fixture that append; **V** = validation revisions; **M** markets; **C** = corrections.

| Stage | Time | Anchor |
|---|---|---|
| source load (completed rows) | injected; O(D) rows + 1 read | `settlement-pipeline.ts:108` (dormant seam) |
| **archive-state read (2C)** | **O(A_s + A_v)** — **2** strict reads, concurrent, once/run | `builders.ts:56-60` |
| normalize (+ head resolution) | O(A_s) + O(A_v) + head-resolve O(V) + per-fixture head sort O(Σ h_f log h_f) | `normalize.ts:136-212` |
| provider classify | **1 pass**, O(D) (`resolveMatchLifecycle` + Set.has/row) | `settlement-provider.ts:110-126` |
| dedup + order + cap | O(D log D) + O(E log E) + O(F) | `settlement-provider.ts:128-146` |
| **M8 downstream (frozen)** | **O(F·(2 + 2T)·A)** | `settlement.ts:230,326,371` + adapter `appendValidation` (2 scans) |

**Discovery subtotal (2C's own work):** `O(A_s + A_v) + O(D log D)`, linear, once/run. **Whole-run:** dominated by frozen M8 `O(F·A)`. **Corrections:** firewalled → **C = 0** in 2C (no `correctionCause`, `currentValidationHeads` unused).

---

## 2. Read Amplification

| Read | Count/run | Note |
|---|---|---|
| snapshots (`readAllSnapshotsStrict`) | **1** | shared with capture (reused, not duplicated) |
| validations (`readAllValidationsStrict`) | **1** | new strict reader, reuses `readNdjson`, no per-record hash re-verify |
| **discovery total** | **2**, concurrent, once/run — even at 0 eligible | **[measured-2C]** snap=1 val=1 |

**One normalized state reused:** `buildSettlementArchiveState` → one `SettlementArchiveState` consumed by all rows; no per-fixture re-derivation. **No per-fixture full scan in discovery** (verified).

**M8 downstream amplification (frozen, unchanged):** per selected fixture, `latestSnapshot` (1) + `listValidations` (1) + per terminal-changed market `appendValidation` = `Promise.all([validationsFor, snapshotsFor])` (2) → **F·(2 + 2T) reads/run**. At F=100, T≈4 → **~1000 reads/run → M8 is ~500× the 2-read discovery cost and remains the dominant archive-scan cost** (no odds hash tax → ~half capture's per-read CPU). Discovery pre-filters `already_settled` → M8 skips them (net-positive).

---

## 3. Memory

**[measured-2C]** (real `produceSettlementRequests`, ~1 KB validation lines):

| N (snap = val) | files | produce (read+normalize+classify) | peak RSS |
|---|---|---|---|
| 10 k | 1 MB + 9 MB | 296 ms | 108 → 129 MB |
| 100 k | 10 MB + 94 MB | 4 108 ms | 163 → **391 MB** |

With realistic ~1.5 KB snapshots the snapshot read adds **[measured-2B]** ~4.8 s / +235 MB at 100 k. Per whole-file read: raw string + `split` substrings + parsed array ≈ **4–5× file** transient; snapshots ∥ validations run concurrently (`Promise.all`) → **both materializations coexist** → peak RSS ≈ snapshot-side + validation-side simultaneously (GB-scale on a deep archive). `currentValidationHeads` is **built and retained** (O(#heads)) even though the first-settle firewall never reads it (§ correction-state).

---

## 4. Event Loop

Discovery is a **synchronous** `split`+`JSON.parse` reduce. **[measured-2C]** ~4.1 s of event-loop-blocking work at a 94 MB validations archive (10 MB snapshots); **[derived]** ~5–6 s with realistic full-size snapshots + validations — **every run** on the single `instances:1` fork, stalling user latency. M8 then does F·(2+2T) such scans → the whole route is M8-dominated and exceeds the 60 s route budget at non-trivial depth long before discovery does. Stage 2C intentionally has **no INV-D deadline** (module doc `:13`) — that enforcement is a pre-activation gate (§8).

---

## 5. Capacity

- **Ceiling: settlement default 100, hard cap 150**, symmetric with capture; `normalizeBatchLimit` clamps `[1,150]` fail-safe to 100 (`limits.ts:10-27`); overflow deferred+counted, never dropped.
- **[measured-M9]** M8 ~85–97 ms/fixture (lighter than capture) → 150 settlements fit the ≤45 s deadline at a **shallow** archive. The cap bounds F, **not** accumulated depth A — deep archive forces fewer than the ceiling (metered `deferred_by_deadline` once INV-D lands).
- **>512 MB string wall — affects settlement on TWO files:** snapshots (~1.5 KB/line) unreadable at **~357 k**, validations (~1 KB/line) at **~524 k** (**[measured-2C]** confirmed). Since V grows ~M× faster than snapshots, the **validations wall can bind first** in a mature archive — a fail-closed hard stop (safe; no false settle) until retention/Postgres.
- **Dormant:** `loadCompletedRows` is an injected seam with **no live default**; the cron route still runs the M9 empty pass → **no production capacity consumed today**.

---

## 6. Benchmark Results

Scratch bench over the **actual** built pipeline (temp data, deleted):
- **Call bounds:** `produceSettlementRequests` → `readAllSnapshots ×1`, `readAllValidations ×1`, `loadCompletedRows ×1`, `buildSettlementCandidates ×1` (one classification). ✅ single-read confirmed independently of the test suite.
- **Cost:** 10 k → 296 ms / 129 MB; 100 k → 4 108 ms / 391 MB (validations-dominated at 94 MB).
- **Wall:** `MAX_STRING_LENGTH` = 536 870 888 (~512 MB) → snapshots ~357 k, validations ~524 k records.
- **Suite:** `tests/evidenceSettlementPipeline.test.ts` **26/26 pass** (read-only run).

---

## 7. Blocking Findings

**None.** Discovery is single-read (1/1/1 verified), one normalized state reused, no per-fixture scan, no duplicate parsing, deterministic, fail-closed; the reused `readAllSnapshotsStrict` and the byte-identical extraction of the validations read introduce no store regression; the first-settlement firewall correctly prevents any correction/`invalid_input` path. The dominant M8 `F·(2+2T)` cost is pre-existing/frozen and bounded by the ceiling; the validation string wall is a documented file-adapter limit, not a 2C defect.

**Non-blocking notes:**
- **N-1 — correction-state built but unused.** `normalizeSettlementArchiveState` builds+retains `currentValidationHeads` (O(V) + O(#heads) memory) that the first-settle firewall never consumes. Head resolution is required for `settledFixtureIds` anyway, so only the `headsByFixture` projection+sort+retention is "wasted" — modest, and it is the Stage-3 correction enabler. Optional: skip the projection while corrections are unwired.
- **N-2 — streaming read** would remove the ~5 s/100 k synchronous block and dodge both string walls on the discovery path (M8's frozen reads remain).
- **N-3 — exported whole-archive readers** (`readAllSnapshotsStrict`/`readAllValidationsStrict`) are O(A); keep the "call once/run; never per-fixture" contract in JSDoc (present) to prevent a future O(F²) loop.

---

## 8. Verdict

### PERFORMANCE REVIEW CONDITIONALLY PASSED

Stage 2C wires the settlement producer correctly and efficiently: **`readAllSnapshotsStrict`, `readAllValidationsStrict`, `buildSettlementArchiveState`, and the provider classification are each invoked exactly once per run** (verified by instrumentation `snap=1 val=1 src=1` and by the suite's own read-bound test), with **no per-fixture archive scan in discovery, no duplicate parsing, deterministic ordering, and fail-closed reads**. It correctly **reuses** the shared snapshot reader and adds only the one missing `readAllValidationsStrict` (no premature abstraction), and the first-settlement firewall keeps `currentValidationHeads`/`correctionCause` out of the path. There is **no performance regression** (M9 empty-pass baseline and flag short-circuit preserved; producer dormant — `loadCompletedRows` has no live default). **[measured-2C]** discovery is 10 k → ~0.3 s / 129 MB and 100 k → ~4.1 s / 391 MB, and the **validations file adds a second >512 MB string wall (~524 k records)** beside the shared snapshots wall (~357 k), both fail-closed.

It is **CONDITIONALLY** passed because the dominant **frozen M8 `F·(2+2T) ≈ 1000` scans/run** is depth-unbounded and **not measured end-to-end here**, and Stage 2C deliberately omits INV-D deadline enforcement and the live source loader. Pre-activation gates: (1) whole-route Gate-B5-settlement benchmark < 45 s at representative depth; (2) INV-D deadline clamp (≤45 s, never 300 s `runDeadlineMs`) + mid-batch guard; (3) depth ceiling + warn per file below the ~357 k/~524 k walls; (4) recommended streaming discovery read. No frozen contract, identity, hash, revision, ordering, or replay semantic is affected.

**Confirmation:** the only file created is `docs/plans/m10-stage-2c-implementation-performance-review.md`. **No runtime or test file was modified**; the bounded benchmark ran against built code over a temporary scratch directory (deleted; no repo fixture added).

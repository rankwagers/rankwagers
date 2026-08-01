# M10 Stage 2E — Slice 2 (Measurement Layer & Route-Entry Timing) — Independent Test Strategy Review

**Review type:** Read-only test-strategy review. **No runtime, route, cron, job, flag, test, schema, migration, deployment, or benchmark code was created or modified.** The only file created is this document. (Test suites were *executed* read-only to confirm green + the regression floor.)
**Date:** 2026-07-30
**Reviewer:** Independent Test Strategy Reviewer, Sprint 23B / M10 Stage 2E, Slice 2.
**Under review:** `tests/m10Slice2Measurement.test.ts` (13 tests); the runtime F-C anchor seam in `lib/jobs/runner.ts`; the new bench modules `scripts/bench/m10/{cells,cli,fixtures,measure,phases}.ts` + extended `types.ts`/`report.ts`; record `m10-stage-2e-impl-slice-2-measurement-layer.md`.
**Method:** every test read line by line and cross-checked against the modules it exercises; the runtime change verified additive/dormant; coupling scanned bidirectionally; suites re-run (Slice-2 ×3 for flakiness, plus anchors + full suite).

---

## 1. Verdict

### APPROVED

Slice 2's tests are **sufficient for its scope, deterministic, well-isolated, and execution-gated to the CLI**, and the **regression suite is unchanged and green (1837/1837)**. All 15 required points and every CONFIRM item are covered by a concrete assertion; the F-C route-entry anchor is proven both *charged* (with anchor → deferred) and *reproduced* (without anchor → proceeds), using injected fake clocks with no wall-clock value thresholds; isolation guards run before any cell (no artifacts on refusal); fixtures are synthetic/temp-only; and benchmark execution remains impossible except via the explicit CLI/`runCells`. Three non-blocking findings are recorded as carry-forward — none affects the verdict.

---

## 2. Test Findings

| # | Finding | Class |
|---|---|---|
| **F-1** | **Capture-path anchor untested.** `deadlineAnchorMs` was added to *both* `runEvidenceCaptureJob` (`runner.ts:420`) and `runPredictionSettlementJob` (`:523`), but only the **settlement** path is exercised. Covered by the shared `producerDeadlineBudget(…, anchorMs)` mechanism + regression, and capture writes are gated on the unbuilt M4→M5 derivation — but a direct capture-anchor assertion is absent (the recurring capture-asymmetry theme). | Carry-forward (non-blocking) |
| **F-2** | **Raw `.raw.csv` content not independently asserted.** The percentile-from-raw test recomputes p95/median against `artifact.result.samples` (the JSON-embedded samples), which correctly proves M-G; but the new `<cell>.raw.csv` — described as the "percentile source of truth" — is not itself read/parsed/asserted for parity with the JSON samples. | Carry-forward (non-blocking) |
| **F-3** | **Import-safety test spawns a real subprocess** (`execFileSync node --import tsx -e import(cli.ts)`) with **no timeout**. Toolchain-coupled and heavier than an in-process check; it would *hang* rather than fail-fast if the import blocked. Not flaky in practice (proven stable ×3), but a small robustness nit. | Carry-forward (non-blocking) |

No BLOCKER and no CONDITIONALLY-blocking finding. `process.env.JOB_LOCK_ADAPTER="memory"` is set at module top (standard pattern, mirrors `m9Activation`), scoped to the test process — not a production leak; the settlement flag lives only on the per-job injected env, never `process.env`.

---

## 3. Coverage

Every CONFIRM item maps to a concrete, verified assertion:

| CONFIRM item | Test evidence |
|---|---|
| route-entry tests | `route_entry_to_runner` recorded first, strictly before `discovery` and `source_load < discovery` (`:131`) |
| deadline composition tests | with-anchor charges source+discovery → `deferredByDeadline>0`, `settled=0` (`:101`); without-anchor → `deferred=0`, `settled>0` (`:111`); `EFFECTIVE=45000` derived from `resolveEffectiveJobDeadlineMs(300000,{15000})` |
| phase timing tests | finite/non-negative durations; `summedRanMs ≤ total + ε` (non-overlap); explicit skips carry a reason with 0 duration (`:131`) |
| import safety tests | spawned child imports the CLI → `IMPORTED_OK`, no `"measurement complete"`/`"warm samples"` (`:182`) |
| CLI-only execution | import populates registry (3 cells) but nothing runs; artifacts appear only after `runCells` (`:201`) |
| isolation guard tests | live flag refused pre-cell (`:226`); prod DB URL refused (`:244`); guards run first → `json/` never created on refusal |
| synthetic fixture tests | frozen-builder snapshots (`fixtureId≥700000`, real `contentHash`), finished rows, temp dir under `os.tmpdir()` (`:286`) |
| artifact path tests | every `r.artifacts` path `startsWith(outputDir+sep)` across all 3 cells (`:268`) |
| production path refusal | `assertIsolatedDir` throws on `/opt/rankwagers/shared/evidence-archive` and `cwd/data` (`:260`) |
| benchmark isolation | guards + forced memory lock + temp fixtures + output-dir-only artifacts (record §3, tests above) |
| regression suite unchanged | **full suite 1837/1837** (= 1824 floor + 13); anchors green (settlement 34, m9Act 18, m9Conc 11, settlement-pipeline 26, operational 29) |

Additionally covered: the additive param is **dormant** — a disabled settlement job still `skipped` even with `deadlineAnchorMs` supplied (`:118`); the deadline-gap cell reports `deadlineOutcome:"deferred"` + `success:true` end-to-end (`:309`).

**Sufficiency:** yes, for Slice-2's declared scope (route-entry timing + measurement layer, settlement path). Strict-reader, canary, full-write, lock-contention, and production-depth cells are explicitly deferred to later slices and correctly absent. The one in-scope symmetry gap (F-1 capture anchor) is minor and shares tested code.

---

## 4. Determinism

**Strong.** No wall-clock *value* is asserted anywhere:
- The deadline tests use an injected fake clock (`now = () => t`; `t` jumps past the budget *during* `provideCandidates`) — the deferral outcome is a deterministic function of the injected clock, not real time.
- The phase-split test asserts only **structural** properties (ordering, finiteness, non-negativity, `sum ≤ total`, explicit skips) — never a duration threshold — so real monotonic timing cannot make it flake.
- The percentile test is a **self-consistency** check: it recomputes p95/median from the artifact's own raw samples and asserts equality within `1e-9`, independent of the actual timing values.
- No `sleep`, no network, no wall-clock arithmetic (record §2: `Date.now` only for the `generatedAt` diagnostic).

**Empirically confirmed:** the Slice-2 suite ran **13/13 across 3 consecutive runs** with zero variance. No flaky behaviour observed.

---

## 5. Isolation

**Strong and enforced before execution:**
- **Guards-first:** `runCells` runs `assertBenchmarkSafeEnv` + `assertDisposableDatabaseUrl` *before* any cell; the tests prove the output `json/` dir is never even created on refusal (a live flag or prod-looking DB URL aborts with `BenchIsolationError` and zero artifacts).
- **Production-path refusal:** `assertIsolatedDir` throws on the prod evidence archive and the live `cwd/data` dir.
- **Forced memory lock:** the run forces `JOB_LOCK_ADAPTER=memory` so the deadline-gap cell never opens a real Pool; the settlement flag is injected per-job, never on `process.env`.
- **Artifact isolation:** all four families write only under the passed `outputDir`; fixtures live in `mkdtemp` temp dirs; **verified no stray artifact leaked into the repo** (`scripts/bench/m10/artifacts/` holds only `.gitkeep`/`.gitignore` after all runs).
- **Runtime coupling:** the framework **barrel `index.ts` stays runtime-free**; only `cells.ts`/`fixtures.ts` reach into `../../../lib/*` (correct — a measurement layer must call the real runner + frozen builders), and **no `lib/`/`app/` file imports `scripts/bench`** (only the Slice-2 test does). The reach is one-directional (bench → runtime), never runtime → bench.
- **Runtime change is additive/dormant:** `startedAtMs = Number.isFinite(anchorMs) ? anchorMs : now()` — absent/non-finite anchor ⇒ byte-for-byte pre-Slice-2 behaviour; proven by the "no-anchor" and "disabled-job still skips" tests and the unchanged 1824-floor regression.

---

## 6. Carry-forward

- **F-1** — add a capture-path anchor assertion (`runEvidenceCaptureJob({deadlineAnchorMs})` charges source+discovery), closing the settlement/capture symmetry once capture derivation is testable.
- **F-2** — assert the `<cell>.raw.csv` exists and its parsed durations match `artifact.result.samples` (make the "percentile source of truth" independently verified).
- **F-3** — give the spawned import-safety subprocess an explicit timeout so a hung import fails fast rather than hanging the suite.
- (Deferred by design, not gaps: strict-reader / canary / full-write / lock-contention / production-depth cells; production handler route-entry capture; ≥100-sample tail-confident runs.)

---

## 7. Validation Evidence (re-run this pass)

| Check | Result |
|---|---|
| Slice-2 suite (`tests/m10Slice2Measurement.test.ts`) | **13 / 0 / 0**, stable across **3** runs (no flake) |
| Regression anchors | settlement **34**, m9Activation **18**, m9Concurrency **11**, settlement-pipeline **26**, operational **29** — all 0 fail |
| **Full suite** (`npm test`) | **1837 / 0 / 0** (= 1824 floor + 13) |
| Repo artifact dirs | clean — only `.gitkeep`/`.gitignore`; all runs used temp dirs |

*(Typecheck/lint not re-run this pass; the record reports project typecheck exit 0 + lint clean, and the full suite green corroborates no contract drift.)*

---

## 8. Explicit Confirmations

- new tests reviewed ✅ · regression coverage green + unchanged (1837/1837) ✅ · deterministic (stable ×3, fake-clock/structural) ✅ · isolation enforced pre-cell ✅ · benchmark execution CLI-only ✅ · artifact isolation (output-dir-only, no repo leak) ✅
- route-entry ✅ · deadline composition ✅ · phase timing ✅ · import safety ✅ · CLI-only execution ✅ · isolation guards ✅ · synthetic fixtures ✅ · artifact paths ✅ · production path refusal ✅ · benchmark isolation ✅ · regression suite unchanged ✅
- **NO runtime/route/cron/job/flag/test/schema/migration/deployment modified by this review; NO production activation.** Only file created: `docs/plans/m10-stage-2e-slice-2-test-strategy-review.md`.

---

# APPROVED

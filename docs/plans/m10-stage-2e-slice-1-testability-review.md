# M10 Stage 2E — Slice 1 (Benchmark Framework) — Independent Testability Review

**Review type:** Read-only test-strategy review, scoped **solely to testability**. **No runtime, route, cron, job, flag, test, schema, migration, deployment, or benchmark code was created, modified, or executed.** The only file created is this document.
**Date:** 2026-07-30
**Reviewer:** Independent Test Strategy Reviewer, Sprint 23B / M10 Stage 2E, Slice 1.
**Under review:** `scripts/bench/m10/{types,config,statistics,timing,sample,machine,guards,fsutil,logger,report,runner,index}.ts` + `artifacts/` scaffold, and the record `m10-stage-2e-impl-slice-1-benchmark-framework.md`.
**Method:** every module read line by line; runtime-coupling scanned bidirectionally; execution-impossibility and test-surface isolation verified against `tsconfig*.json` and `package.json`. No benchmark was designed or run.

---

## 1. Verdict

### APPROVED

The Slice-1 benchmark framework is **highly and independently testable by construction**: pure computation is cleanly separated from I/O and the clock; every I/O-bearing abstraction (config, filesystem, logging, report, machine spec) takes its dependency as an injected parameter (env, output dir, timestamp, `nowIso`); statistics are fully deterministic; there is **zero runtime coupling in either direction**; future benchmark cells plug in through a single typed seam; and **benchmark execution remains structurally impossible** (zero cells, a no-op CLI, no npm entry). All eight required verifications pass. One inherent, non-blocking observation (the timing primitive reads the real monotonic clock — correct for a benchmark and properly isolated) is recorded but does not qualify the verdict.

---

## 2. Required Verifications

| # | Requirement | Result | Evidence |
|---|---|---|---|
| 1 | **Framework can be independently tested** | **PASS** | Every module is pure or dependency-injected; imports only node built-ins + local; `node --test`-compatible via tsx. A test can import `scripts/bench/m10/*` and assert against fixed inputs + temp dirs with no runtime setup. |
| 2 | **Statistics are deterministic** | **PASS (definitive)** | `statistics.ts` — `computeStats`/`percentile`(type-7)/`isStable`/`hasTailConfidence` are pure functions of a raw `number[]`; no clock, no I/O; filters non-finite; empty-safe; never throws. `[1..5]` → exact p50/p95/p99/mean/stddev/cv. |
| 3 | **Timing abstraction is testable** | **PASS (contract-level)** | `time()`/`PhaseTimer`/`memorySnapshotMB`/`createEventLoopMonitor` — the **contract** is assertable (result correctness; finite non-negative duration; phase-key recording; 5-field memory shape; histogram shape). Duration *values* are real-clock (inherent) but feed the deterministic statistics layer, which is tested with synthetic arrays. See §4-O1. |
| 4 | **Filesystem abstraction is testable** | **PASS** | `fsutil.ts` — every function takes `outputDir`/`file` as a parameter (no hardcoded prod path); `atomicWrite` = tmp+rename (no torn file); `csvCell` escaping is pure. Point at `mkdtemp`, write, read back, assert. |
| 5 | **Logging abstraction is testable** | **PASS** | `logger.ts` — `BenchLogger` exposes injectable `nowIso` (deterministic timestamps), `silent` (suppress stdout), bounded `maxRetained`, and `retained()` (inspect output). Best-effort file sink swallows errors. Assert exact formatted lines. |
| 6 | **Report generation is testable** | **PASS** | `report.ts` — `buildArtifact(result, machine, config, generatedAt)` and `renderSummary(...)` are pure with **injected `generatedAt`** and deterministic `round`; `writeArtifacts(outputDir, …)` is temp-dir testable and returns paths; `safeBasename` pure. Assert exact JSON envelope + markdown. |
| 7 | **Future benchmark cells can plug in** | **PASS** | `types.ts` `BenchCell {id, describe, coords, run?}`; `runner.register(cell)` (dedup guard on `id`); `sampleWarm(cell)` invokes `cell.run(ctx)` with `ctx: BenchContext = {config, logger}`. A future cell implements `run` (isolated synthetic measurement) and registers — a clean, typed, testable seam (register a fake deterministic `run`, assert the assembled `BenchCellResult`). |
| 8 | **No runtime coupling exists** | **PASS (bidirectional)** | Framework imports **only** `node:{crypto,path,perf_hooks,os,fs}` + `./local` — no `../`, `@/`, `next`, `lib/`, `app/` (grep: NONE). No `lib/`/`app/`/`tests/` file imports `scripts/bench` (grep: NONE). `scripts` excluded from `tsconfig.json` and `tsconfig.typecheck.json`; test glob is `tests/*.test.ts` only. |

---

## 3. Benchmark Execution Is Still Impossible — confirmed

- **Zero cells:** the only `register()` is the `BenchRunner` method definition; it is **never called** with a cell anywhere in the framework. `main()` registers 0 cells.
- **Guarded run path:** `sampleWarm` executes `cell.run(ctx)` **only if** `cell.run` is supplied; a cell without `run` returns an honest empty result (`"cell has no run() — framework only"`). No `BenchCell` with a `run` exists in Slice 1.
- **No-op CLI:** `main()` asserts a benchmark-safe env, ensures artifact dirs, logs "0 cells registered, nothing executed," and only *references* (`void buildArtifact; void writeArtifacts`) the report path without calling it — it **writes no benchmark artifact**.
- **Import-safe:** `main()` runs only under `invokedDirectly` (`process.argv[1].endsWith("runner.ts")`), so importing the module for testing triggers nothing.
- **No entry point:** no `bench`/`perf` npm script exists; the sole invocation `tsx scripts/bench/m10/runner.ts` is a status no-op. Execution is structurally impossible.
- **Isolation guards defined, not exercised:** `guards.ts` (`assertDisposableDatabaseUrl`/`assertIsolatedDir`/`assertBenchmarkSafeEnv`) are the fail-closed helpers a *later* execution slice must call; Slice 1 only defines them (and `main()` calls `assertBenchmarkSafeEnv` before doing nothing).

---

## 4. Observations (non-blocking)

- **O1 — Timing has no injectable clock seam.** `time()`/`PhaseTimer`/`nowMs` read `process.hrtime.bigint()` directly, so their *duration values* cannot be pinned in a test. This is **correct and inherent** for a benchmark primitive (a fake clock would defeat its purpose) and is properly mitigated: the deterministic-critical layers (`statistics`, `report`) are fully decoupled and take raw arrays / injected timestamps, so determinism is tested there. The timing contract (result passthrough, non-negative finite duration, phase keys, memory/event-loop shapes) remains assertable. No change required; if desired, a future slice could accept an optional injected `now` in `time()`/`PhaseTimer` purely to enable value-level assertions — a nicety, not a gap.
- **O2 — No unit tests exist yet.** `tests/` contains none for the framework. Out of scope for this review (which assesses *testability*, not test presence) and appropriate for a framework slice; authoring the cell/statistics/fs/logger/report unit tests belongs to the execution slices. The framework's structure makes those tests straightforward.
- **O3 — Machine spec privacy is sound.** `captureMachineSpec(capturedAt)` takes an injected timestamp and one-way-hashes the hostname (`hashHostname(os.hostname())`) — no raw hostname/entity id reaches an artifact, and the injected timestamp keeps envelope generation deterministic.

None of O1–O3 affects any of the eight required verifications.

---

## 5. Explicit Confirmations

- **Framework can be independently tested:** ✅ (pure + injected deps + node-built-ins-only)
- **Statistics deterministic:** ✅ (pure raw-sample functions; clock/I-O-free)
- **Timing / filesystem / logging / report abstractions testable:** ✅ (injected paths/clock/timestamp; deterministic layers decoupled from the real clock)
- **Future cells plug in:** ✅ (typed `BenchCell.run(ctx)` register seam)
- **No runtime coupling:** ✅ (bidirectional grep NONE; excluded from tsconfig + test glob)
- **Benchmark execution still impossible:** ✅ (0 cells, guarded run path, no-op CLI, no npm entry)
- **NO runtime/route/cron/job/flag/test/schema/migration/deployment modified; NO benchmark executed:** ✅
- **Only file created:** `docs/plans/m10-stage-2e-slice-1-testability-review.md`.

---

# APPROVED

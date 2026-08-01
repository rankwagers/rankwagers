# M10 Stage 2E Implementation — Slice 1: Benchmark Framework (Record)

**Document type:** Implementation record (Stage 2E, Slice 1). **Framework-only; zero production impact.**
**Date:** 2026-07-30
**Governing:** `m10-stage-2e-b-benchmark-readiness-plan.md` (§4 methodology, §18 B-1) + `m10-stage-2e-b-closure.md` (findings M-E, M-G, M-H, M-I).

---

## 1. Implementation Summary

Slice 1 creates the **benchmark framework only** — standalone, evidence-only tooling under
`scripts/bench/m10/` that imports **only Node built-ins** (`fs`, `path`, `os`, `crypto`,
`perf_hooks`, `process`). It has **no coupling to any runtime module** (no pipeline import, no
route, no reader/writer, no flag, no schema), so it **changes no runtime, production, or pipeline
behaviour**. It ships with **zero benchmark cells and executes no benchmark** — the runner CLI
reports framework status and exits.

Design decisions honour the Stage-2E-B reconciled findings:
- **M-G** — percentiles are computed from **raw per-sample durations** (`statistics.ts`), never the
  runtime metrics API (which only aggregates count/sum/max).
- **M-H** — samples are tagged `cold` / `warm` / `warmup`; warmup is discarded; cold vs warm are
  analysed separately.
- **M-I** — the config carries a `criticalSamples` bar (default 100) and stats expose
  `hasTailConfidence()` for p99.
- **M-E** — isolation guards (`guards.ts`) refuse a production-looking DB URL, the production
  evidence archive dir, the live `data/` source dir, and a live-flag-on env — the fail-closed
  helpers a later execution slice MUST call before any cell.

## 2. Files Created

**Framework (`scripts/bench/m10/`):**
- `README.md` — scope + usage.
- `types.ts` — shared types (`Sample`, `Stats`, `MachineSpec`, `BenchCell`, `BenchCellResult`, `BenchArtifact`, …).
- `config.ts` — `resolveBenchConfig` over `M10_BENCH_*` env (fail-safe defaults: warmup 3, warm 30, cold 10, critical 100, CV 0.25); artifact-safe public projection.
- `statistics.ts` — pure `computeStats` / `percentile` (type-7) / `isStable` / `hasTailConfidence` from raw samples.
- `timing.ts` — `nowMs` (`hrtime.bigint`), `time()`, `PhaseTimer`, `memorySnapshotMB`, `createEventLoopMonitor` (`perf_hooks`).
- `sample.ts` — `SampleCollector` (cold/warm/warmup, phase durations).
- `machine.ts` — `captureMachineSpec` (node/v8/os/cpu/mem; one-way-hashed hostname).
- `guards.ts` — `assertDisposableDatabaseUrl` / `assertIsolatedDir` / `assertBenchmarkSafeEnv` (M-E).
- `fsutil.ts` — atomic JSON/CSV/summary writes + `ensureArtifactDirs` + bounded log append.
- `logger.ts` — `BenchLogger` (stdout + best-effort file sink; bounded; injectable clock).
- `report.ts` — `buildArtifact` / `renderSummary` / `writeArtifacts` (JSON + CSV + markdown).
- `runner.ts` — `BenchRunner` skeleton (register → warmup → warm-sample → stats → assemble) + CLI `main()` that reports status and executes **nothing**.
- `index.ts` — barrel.

**Artifact scaffold (`scripts/bench/m10/artifacts/`):**
- `json/.gitkeep`, `csv/.gitkeep`, `summary/.gitkeep`, `logs/.gitkeep` — the four artifact families.
- `.gitignore` — keeps the directory structure; ignores all generated run outputs.

## 3. Files Modified

**None.** No runtime, route, cron, flag, settlement, reader, writer, schema, migration, or
production-config file was touched. (This record is the only doc added.)

## 4. Acceptance Checklist

| Item | Status |
|---|---|
| Benchmark directory created (`scripts/bench/m10/`) | ✅ |
| Benchmark configuration (`config.ts`, fail-safe env) | ✅ |
| Benchmark artifact output (JSON/CSV/summary/logs dirs + writers) | ✅ |
| Benchmark runner skeleton (registers cells; executes none in Slice 1) | ✅ |
| Benchmark report writer (`report.ts`) | ✅ |
| Benchmark helper utilities (`guards`, `machine`, `index`) | ✅ |
| Benchmark timing abstraction (`timing.ts`) | ✅ |
| Benchmark sample abstraction (`sample.ts`) | ✅ |
| Benchmark statistics abstraction (raw-sample percentiles, M-G) | ✅ |
| Benchmark filesystem abstraction (`fsutil.ts`, atomic) | ✅ |
| Benchmark logging abstraction (`logger.ts`) | ✅ |
| No benchmark execution / route timing / strict reader / deadline anchor / dry-run / canary / FULL_WRITE | ✅ (none present) |
| Node-built-ins only; no runtime/pipeline import | ✅ |
| Runner runs as a framework-only no-op | ✅ (`tsx scripts/bench/m10/runner.ts` → status, 0 cells) |
| Framework typechecks in isolation | ✅ (tsc exit 0) |
| Full suite / typecheck / lint unchanged | ✅ (see §Validation) |
| Zero production impact | ✅ |

## 5. Outstanding Work (later slices — NOT this slice)

- Fixture generators (synthetic NDJSON archives at depth + daily-archive JSON source variants) via the frozen builders (`createEvidenceSnapshot`, `createValidationRecord`, `buildCaptureSnapshot`, `buildOddsRecord`) into `mkdtemp` dirs — M-A.
- Route-entry phase-split benchmark cells — **after** the Stage-2E route-entry deadline anchor ships (M-C).
- Memory / CPU / event-loop cells; concurrency/lock cells (disposable local Postgres — M-E guard).
- Dry-run zero-write proof (byte-identical archive manifest under injected failure); canary; full-write; failure-injection cells.
- Cold-sample orchestration (fresh process per cold sample) + raw per-sample CSV.
- Representative-depth inputs (Ops-provided — M-D DEFER).
- Readiness-gate verification + signed acceptance summary + benchmark history.

None of the above is implemented here; Slice 1 is the framework only.

## 6. Validation

- Runner: `tsx scripts/bench/m10/runner.ts` → "framework ready … 0 cells … nothing executed"; wrote only a status log (removed after), no benchmark artifact.
- Isolated typecheck of the framework: **exit 0**.
- Project baselines (unchanged — the framework is under `scripts/`, excluded from `tsconfig.typecheck.json`, imported by nothing): full suite **1824/1824**, typecheck exit 0, lint clean (recorded in the final report).

---

**Success criteria met:** runtime behaviour identical; zero production impact; framework only.

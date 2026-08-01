# M10 Benchmark Framework (Stage 2E — Implementation Slice 1)

**Scope:** the benchmark **framework only**. This directory contains standalone, evidence-only
tooling for the Stage-2E-B benchmark run. It imports **only Node built-ins** — it does not import,
touch, or change any runtime module, route, cron, feature flag, reader, writer, schema, or
production configuration. Running it has **zero production impact**.

**What Slice 1 provides (this slice):**
- benchmark configuration (`config.ts`)
- shared types (`types.ts`)
- timing abstraction (`timing.ts` — `hrtime.bigint`, phase timer, event-loop + memory snapshots)
- sample abstraction (`sample.ts` — cold/warm raw-duration collection)
- statistics abstraction (`statistics.ts` — p50/p95/p99/max/mean/stddev/CV from **raw samples**,
  never the runtime metrics API — reconciliation finding M-G)
- filesystem abstraction (`fsutil.ts` — atomic JSON/CSV writes, artifact paths)
- logging abstraction (`logger.ts`)
- machine/runtime-spec capture (`machine.ts`)
- isolation guards (`guards.ts` — refuse prod-looking DB URLs / non-isolated dirs; finding M-E)
- report writer (`report.ts` — JSON + CSV + summary from a cell result)
- benchmark runner **skeleton** (`runner.ts` — registers cells and defines the warmup → cold →
  warm → stats → artifact lifecycle; **ships with zero cells and executes no benchmark**)
- artifact directories (`artifacts/{json,csv,summary,logs}/`)

**What Slice 1 deliberately does NOT do (later slices):**
- no benchmark execution · no route timing · no strict reader · no deadline anchor · no dry-run ·
  no canary · no FULL_WRITE · no production benchmark.

**Run (framework status only — no cells registered):**
```
tsx scripts/bench/m10/runner.ts
```
This prints the framework status and writes nothing but a status log; it executes no pipeline.

Artifacts (generated at run time by later slices) are written under `artifacts/` and are
git-ignored except the directory placeholders.

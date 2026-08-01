# M10 Stage 2E — Implementation Slice 2: Measurement Layer & Route-Entry Timing

Status: **COMPLETE** (2026-07-30). Synthetic, in-process, dormant. No production activation.

Builds directly on Slice 1 (benchmark framework: `scripts/bench/m10/`). Slice 2 adds the
measurement layer that benchmarks the live-candidate settlement pipeline **from route entry**, and
closes the Stage-2E-B finding **F-C** (the deadline budget was anchored *after* discovery, so source
loading + discovery escaped it) with an **additive, dormant** runtime seam.

---

## 1. What shipped

### 1.1 Runtime change (the ONLY runtime file touched)

`lib/jobs/runner.ts` — additive, dormant, byte-for-byte back-compatible when the new option is
absent (every current caller, including the dormant cron routes):

- `producerDeadlineBudget(env, now, reserve, anchorMs?)` — new optional 4th param. When a caller
  supplies a **monotonic route-entry anchor** (ms), the effective deadline is anchored at route
  entry (`startedAtMs = anchorMs`) so source loading + discovery are **charged** to the budget.
  Absent ⇒ `startedAtMs = now()` — exactly the pre-Slice-2 behaviour. The anchor is never
  re-derived and never reset (§ closes F-C).
- `runEvidenceCaptureJob(options)` and `runPredictionSettlementJob(options)` — each gained an
  optional `deadlineAnchorMs?: number`, threaded into `producerDeadlineBudget`.

Why this seam and not a route/scheduler edit: capturing a true route-entry timestamp in the shared
cron handler would touch multiple route entry points with incompatible contracts (a Slice-2 STOP
condition). The additive runner param lets the benchmark supply the anchor and **measure the gap
end-to-end** without changing any production scheduler behaviour, flag, or route. Production handler
capture is deferred to a later activation slice.

Nothing else in the runtime changed. No flag, no cron, no schema, no migration, no archive format,
no evidence contract, no correction/retention/PostgreSQL behaviour, no `FULL_WRITE` authorization,
no capture M4→M5 status.

### 1.2 Benchmark measurement layer (`scripts/bench/m10/`, non-runtime)

| File | Role |
|---|---|
| `phases.ts` (new) | Canonical non-overlapping phase set + `PhaseRecorder` (`ran`/`ranSync`/`skip`); explicit skip with reason (never a fabricated zero-duration success). |
| `measure.ts` (new) | `routeEntryAnchorMs()` (monotonic), `toSample()`, `MeasurableCell`, `runMeasurableCell()` executor (warmup discarded, warm collected), `ErasedCell`/`eraseCell()` for a heterogeneous registry. |
| `fixtures.ts` (new) | Deterministic synthetic fixtures via the **real frozen builders** `createEvidenceSnapshot` + `createValidationRecord`; memory settlement port + memory evidence store; `makeIsolatedTempDir()` (guarded). |
| `cells.ts` (new) | The three cells (below). |
| `cli.ts` (new) | The only execution entry. Importing runs nothing (direct-invocation guard). Runs isolation guards **first**, forces memory job locks for the run, writes artifacts only under the output dir. |
| `types.ts` (extended) | `Sample` gained `runId`, `success`, `deadlineOutcome`, `phaseRecords`; new `PhaseRecord` + `DeadlineOutcome`. |
| `report.ts` (extended) | Added the **raw per-sample, per-phase CSV** (`<cell>.raw.csv`) — the percentile source of truth (finding M-G). |

The framework barrel `index.ts` was intentionally **not** extended — it stays runtime-free; the
runtime-coupled Slice-2 modules (`cells`, `fixtures`, `cli`) are imported directly by the CLI/tests.

### 1.3 The three cells (settlement path only)

1. `settlement.route_entry_phase_split` — per-phase split anchored at route entry
   (`route_entry_to_runner` → `source_load` → `archive_load` → `discovery`), with the non-executed
   phases (`candidate_prepare`, `settlement`, `capture`, `writer`, `cleanup`) recorded as explicit
   skips.
2. `settlement.runner_entry_comparison` — route-entry total vs runner-entry total; the delta
   (`deadline_gap` = source+archive+discovery) is the budget that escapes runner-entry anchoring.
3. `settlement.deadline_gap` — **exercises the real runner** with/without `deadlineAnchorMs` under an
   injected fake clock that makes discovery overrun the budget. Proves F-C is charged (deferred)
   with the anchor and reproduced (proceeds) without it.

No strict-reader, write-to-disk, canary, lock-contention, full-write, or production-depth cell was
added (all explicitly out of Slice-2 scope).

---

## 2. Measurement contract compliance

- Monotonic clock only for elapsed: `nowMs()` = `process.hrtime.bigint()` (Slice-1 abstraction).
  `Date.now`/wall-clock used only for the artifact `generatedAt` diagnostic, never in arithmetic.
- Durations finite, non-negative, single clock domain; nanoseconds internally, ms at the artifact
  boundary.
- Phases are non-overlapping by construction (each measured sequentially) and skips are explicit.
- Percentiles are computed from **raw per-run samples** (`computeStats` over the samples array),
  never from a runtime metrics aggregate; the raw CSV is emitted for independent recomputation.

---

## 3. Execution & isolation

- Execution is possible **only** via the explicit CLI / `runCells()`:
  `node --require ./scripts/mock-server-only.cjs --import tsx scripts/bench/m10/cli.ts run [cellId...] [--smoke] [--out <dir>] [--seed <n>]`
- Importing any benchmark module executes nothing (direct-invocation guard on `process.argv[1]`).
- Normal app startup executes nothing (no module is imported by the app; barrel stays runtime-free).
- Before any cell, `runCells` runs the isolation guards: refuses a live pipeline flag on
  `process.env` (`assertBenchmarkSafeEnv`) and a prod-looking `EVIDENCE_DATABASE_URL`
  (`assertDisposableDatabaseUrl`), and forces `JOB_LOCK_ADAPTER=memory` for the run so the
  deadline-gap cell never opens a real Pool. The settlement flag lives only on the injected job env,
  never on `process.env`.
- All artifacts (`json/`, `csv/` incl. `raw.csv`, `summary/`, `logs/`) are written only under the
  output dir; synthetic fixtures live in `mkdtemp` temp dirs.

Isolated typecheck (the bench dir is outside the project `tsconfig.typecheck.json`, which excludes
`scripts/`): create a throwaway config extending `./tsconfig.json` with
`include: ["scripts/bench/m10/**/*.ts", "next-env.d.ts", "types/**/*.d.ts"]` and
`exclude: ["node_modules", ".next", "tests"]`, then `tsc -p` it → **exit 0**.

---

## 4. Tests (`tests/m10Slice2Measurement.test.ts`, 13 tests, all green)

Covers the 15 required points: route entry before discovery; the same immutable anchor reaches the
deadline; source+discovery charged inside the deadline; deadline not reset after discovery; phases
non-overlapping/non-negative; skipped phases explicit; percentiles from raw samples; import executes
nothing (spawned child proves it); CLI required to execute; guards run before cells (no artifacts on
refusal); artifacts under the output dir; prod paths/URLs refused; synthetic temp fixtures only;
runtime unchanged when the anchor path is not supplied (the additive param is dormant).

Empirical evidence (smoke run, `--smoke`, n=8 warm): the deadline-gap cell **deferred the batch in
8/8 samples with the anchor and proceeded without it** — F-C charged and reproduced. Tail confidence
honestly reported **INSUFFICIENT (n<100)**; no GO/NO-GO conclusion issued.

---

## 5. Validation results

- Slice-2 focused tests: **13/13 pass**.
- Full suite: **1837/1837 pass**, 0 fail (floor ≥1824; +13 new).
- Project typecheck (`npm run typecheck`): **exit 0**.
- Isolated bench typecheck: **exit 0**.
- Lint (`next lint` + direct `eslint` on the bench dir + test): **clean**.
- Repo artifact dirs remain empty (only `.gitkeep`/`.gitignore`); all runs targeted temp dirs.

---

## 6. Deferred to later slices (out of Slice-2 scope)

- Production route/handler route-entry capture (wiring the anchor into a real request boundary).
- Capture-path full-write cells; strict-reader / lock-contention / production-depth cells.
- Deep-archive extrapolation of the deadline gap; ≥100-sample tail-confident critical runs.

# M10 Stage 2E — Slice 2 (Measurement Layer & Route-Entry Timing) — Independent Performance Review

**Document type:** Independent performance review (review-only). No runtime code, route, cron, job, flag, test, schema, database, migration, or deployment was modified. The **only** file created is this document.
**Date:** 2026-07-30
**Reviewer:** Independent Performance Reviewer, Sprint 23B / M10 Stage 2E / Slice 2.
**Under review:** the Slice-2 measurement layer `scripts/bench/m10/{measure,phases,sample,statistics,timing,fixtures,cells,cli}.ts` + `types.ts`/`report.ts` extensions, and the **single** runtime change `lib/jobs/runner.ts` (`producerDeadlineBudget` optional `anchorMs`, `deadlineAnchorMs?` on both jobs); record: `m10-stage-2e-impl-slice-2-measurement-layer.md`.
**Method:** every claim verified against code (`file:line`). No benchmark executed.

**VERDICT: PASSED.** The measurement layer uses monotonic `hrtime` throughout, computes percentiles from raw samples (never a runtime aggregate), holds only config-bounded buffers, adds negligible dormant runtime overhead (byte-for-byte back-compatible when the anchor is absent), and isolates all artifacts. No regressions; findings are minor non-blocking notes + one carry-forward for a future production-wiring slice.

---

## Verification of CONFIRM items

| Item | Result | Evidence |
|---|---|---|
| **hrtime monotonic usage** | ✅ | `timing.ts:15-17` `nowMs()=process.hrtime.bigint()/1e6`; `time()`, `PhaseTimer`, `measure.routeEntryAnchorMs()`/`toSample()` all use hrtime. Elapsed is never wall-clock. |
| **No `Date.now` arithmetic** | ✅ | grep `Date.now` across `scripts/bench/m10/*.ts` → **zero**. Bench doc note: `Date.now` used only for the artifact `generatedAt` diagnostic, never in arithmetic. (Runner's `Date.now` at `:110/124/200/388/491` are pre-existing M9 metric/cleanup/injected-clock, not Slice-2.) |
| **Raw sample percentiles** | ✅ | `statistics.ts:20-31` type-7 linear-interpolation percentile over the **sorted raw array**; `computeStats` (`:34-57`) from raw; `measure.ts:109-113` computes total/warm/phase stats from `collector.analysisDurations()`/`phaseDurations()` (raw). Raw per-sample `<cell>.raw.csv` emitted for independent recomputation. |
| **No runtime percentile calculation** | ✅ | `statistics.ts:1-7` header binds M-G: percentiles from harness samples, **never** the runtime metrics API (which only aggregates count/sum/max). `runner.ts` computes no percentiles. |
| **No unbounded buffers** | ✅ | `SampleCollector.samples[]` grows by `warmup + warmSamples (+cold)` = 3+30(+10) ≈ 43/cell (`config.ts:31-35`), collector is local to `runMeasurableCell` (GC'd per cell); `phaseRecords ≤ 12` phases (`phases.ts:14-28`). All sizes are bounded positive ints. |
| **Benchmark overhead bounded** | ✅ | Per run: N `time()` phase wraps (2 hrtime + 1 push each) + 1 sample push; per cell: one `computeStats` O(n log n) sort at n≤~43. O(samples), no per-iteration growth. |
| **Runtime overhead negligible** | ✅ | Sole change: `producerDeadlineBudget` gains `anchorMs?` + one guarded ternary (`runner.ts:314-316`): `startedAtMs = finite(anchorMs) ? anchorMs : now()`. Absent (every current caller) ⇒ `now()` — **identical** to pre-Slice-2. Cost = one `typeof`+`isFinite`, once/run, only when engaged. Dormant. |
| **Benchmark artifacts isolated** | ✅ | CLI-only execution (direct-invocation guard); isolation guards run **before** cells (`assertBenchmarkSafeEnv`, `assertDisposableDatabaseUrl`, force `JOB_LOCK_ADAPTER=memory`); fixtures in `mkdtemp`; artifacts only under the out dir; repo `artifacts/*` carry `.gitignore`+`.gitkeep` (stay empty). |

**Route-entry timing / phase measurement / deadline accounting:** `producerDeadlineBudget` anchors `startedAtMs = anchorMs` (route entry) when supplied so source-load+discovery are charged (closes F-C); `createDeadline` computes `deadlineAtMs` **once**, never reset (`:316`, `remainingMs` recomputes only `deadlineAtMs - now()`). Phases are measured **sequentially** (`PhaseRecorder.ran` wraps one unit each → non-overlapping) and non-executed phases are **explicit skips** (`phases.ts:51-53`), never fabricated zero-duration successes. Smoke evidence (per record): deadline-gap cell deferred 8/8 with the anchor, proceeded without — F-C charged and reproduced; tail confidence honestly reported INSUFFICIENT (n<100), no GO/NO-GO issued.

## Performance Findings

- **No performance regression.** The runtime delta is a dormant optional param + one branch; full suite **1837/1837**, typecheck exit 0, lint clean (per record). All current callers (incl. dormant routes) hit the unchanged `now()` path.
- **N-1 (minor, off-runtime): double object creation per warm sample.** `measure.ts:103` builds a `Sample` in `measureOnce`, `stripIndexKind` (`:136-139`) destructures it, then `collector.add` re-spreads it with a fresh index/kind — ~3 transient objects/sample. Bounded (~43/cell), harness-only, not a hot path. Cosmetic.
- **N-2 (minor): intentional defensive copies.** `PhaseTimer.durations()`/`PhaseRecorder.finish()`/`runMeasurableCell samples:[...]` spread once per call/cell — bounded, deliberate immutability, not accidental hot-loop allocation.
- **No hidden copies, no unnecessary serialization** — `JSON.stringify`/CSV only at artifact-write time (once/cell in `report.ts`), no per-run serialization.

## Scalability

The harness scales **O(samples)** per cell (samples config-bounded); it adds no O(A)/O(F) term of its own — it *measures* the pipeline's O(F·A) cost without amplifying it. Sample/warmup/critical counts are bounded defaults (30/3/100) overridable only by explicit env, so no default unbounded growth. The route-entry anchor is captured once per run and never re-derived, so measurement cost is independent of archive depth or candidate volume.

## Memory

No unbounded buffer: per-cell collector ≈ 43 samples × (small object + ≤12 phase records), GC'd after the cell. `memorySnapshotMB()` reads `process.memoryUsage()` (no retention). The runtime change stores no state (a stack-local number + one branch). No leak surface introduced; steady-state is bounded by config. `SampleCollector` retention is exactly the analysis set required for percentiles — necessary, not excess.

## CPU

Monotonic `hrtime.bigint()` for all elapsed (2 calls/phase); `computeStats` does one O(n log n) sort at n≤~43/cell — trivial. Event-loop delay measured via `perf_hooks.monitorEventLoopDelay` (native histogram, its own percentiles — correctly for the *loop-delay* metric, distinct from the duration percentiles which come from raw samples). Runtime CPU delta = one guarded ternary/run — negligible.

## Carry-forward

- **CF-1 (future production route-entry wiring — correctness, not a Slice-2 defect):** `producerDeadlineBudget` mixes `startedAtMs = anchorMs` with the injected `now` clock in `remainingMs = deadlineAtMs − now()`. The two MUST share a clock domain. In the bench both are the injected (monotonic) clock — consistent (verified by 13/13 tests + 8/8 defer). In **production**, `now` defaults to wall-clock `Date.now` (`runner.ts:388,491`), so a future production route-entry `deadlineAnchorMs` MUST be a `Date.now()` captured at handler entry (same wall-clock domain) — **never** an `hrtime` value, or the deadline math is garbage (different epochs). Document/guard this when the production handler anchor is wired (deferred slice).
- **CF-2:** ≥100-sample tail-confident critical runs + deep-archive extrapolation remain deferred (record §6) — the layer correctly refuses a GO/NO-GO at n<100.
- **CF-3 (cosmetic):** collapse the N-1 double object creation if a later slice touches `measure.ts` (let `measureOnce` return the pre-stripped shape).

## Verdict

### PASSED

Slice 2 delivers a correct, well-bounded measurement layer: monotonic `hrtime` for every elapsed measurement, percentiles computed from **raw** per-sample durations via a standard type-7 interpolation (never from the runtime metrics aggregate, which cannot yield percentiles), config-bounded sample/phase buffers with no unbounded growth, and a single **dormant, byte-for-byte back-compatible** runtime seam (`anchorMs`) that adds one guarded branch per run only when engaged and is not supplied by any current caller. Phases are non-overlapping-by-construction with explicit skips; artifacts and fixtures are fully isolated (CLI-only, guarded, temp-dir, repo dirs empty); and the deadline anchor is captured once and never reset, correctly charging source-load + discovery (closing F-C) without altering any production behaviour. No performance regression (1837/1837 green), negligible runtime overhead, no accidental hot-loop allocation, no hidden copy or serialization on the measured path, and no scalability term added by the harness itself. The only items are two minor off-runtime allocation notes and one carry-forward (the clock-domain requirement for the *future* production route-entry anchor) — none blocks this slice.

**Confirmations:** NO runtime code modified by this review · NO benchmark executed · NO tests modified · NO deployment/schema/migration modified · NO production activation. Only `docs/plans/m10-stage-2e-slice-2-performance-review.md` was created.

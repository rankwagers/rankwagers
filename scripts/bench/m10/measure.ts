/**
 * M10 Benchmark Framework — measurement + cell executor (Stage 2E, Slice 2).
 *
 * Captures the monotonic route-entry anchor, drives a measurable cell's warmup/warm samples,
 * assembles per-run `Sample`s (raw, phase-recorded, deadline-tagged) and computes cell stats
 * from RAW samples (never a runtime metrics aggregate — finding M-G).
 *
 * All measurement is synthetic and in-process; the CLI is the only execution entry (importing
 * this module runs nothing).
 */

import { nowMs } from "./timing";
import { PhaseRecorder, ranPhaseDurations } from "./phases";
import { SampleCollector } from "./sample";
import { computeStats } from "./statistics";
import type { BenchConfig } from "./config";
import type { BenchLogger } from "./logger";
import type {
  BenchCellCoords,
  BenchCellResult,
  DeadlineOutcome,
  Sample,
  SampleKind,
  Stats,
} from "./types";

/** The caller-owned monotonic route-entry anchor (ms). Captured ONCE, before any work. */
export function routeEntryAnchorMs(): number {
  return nowMs();
}

/** Deterministic-ish run id from a seed + kind + index (never an entity id). */
export function runId(seed: number, kind: SampleKind, index: number): string {
  return `r_${seed.toString(36)}_${kind[0]}_${index}`;
}

export type MeasureContext = {
  config: BenchConfig;
  logger: BenchLogger;
  seed: number;
};

/** A run's raw measurement, before it is turned into a `Sample`. */
export type RunMeasurement = {
  routeEntryMs: number;
  recorder: PhaseRecorder;
  success: boolean;
  deadlineOutcome: DeadlineOutcome;
};

/** Assemble one `Sample` from a completed measurement. `durationMs` = total from route entry. */
export function toSample(
  measurement: RunMeasurement,
  kind: SampleKind,
  index: number,
  seed: number
): Sample {
  const totalMs = nowMs() - measurement.routeEntryMs;
  const phaseRecords = measurement.recorder.finish();
  return {
    index,
    kind,
    durationMs: totalMs,
    runId: runId(seed, kind, index),
    success: measurement.success,
    deadlineOutcome: measurement.deadlineOutcome,
    phaseRecords,
    phasesMs: ranPhaseDurations(phaseRecords),
  };
}

/**
 * A measurable benchmark cell: `setup` builds isolated synthetic state once; `measureOnce`
 * performs one measured run and returns a `Sample`; `teardown` cleans up. The executor times
 * warmup (discarded) then warm samples.
 */
export type MeasurableCell<S = unknown> = {
  id: string;
  describe: string;
  coords?: BenchCellCoords;
  /** Optional pass/fail budget (ms) for the total-duration p95. */
  budgetMs?: number;
  /** Optional extra summary notes computed after sampling. */
  notes?: (samples: readonly Sample[]) => string[];
  setup?: (ctx: MeasureContext) => Promise<S> | S;
  measureOnce: (ctx: MeasureContext, state: S, kind: SampleKind, index: number) => Promise<Sample>;
  teardown?: (ctx: MeasureContext, state: S) => Promise<void> | void;
};

/** Execute one measurable cell (warmup discarded, warm collected) and assemble its result. */
export async function runMeasurableCell<S>(
  cell: MeasurableCell<S>,
  ctx: MeasureContext,
  command: string
): Promise<BenchCellResult> {
  const state = (cell.setup ? await cell.setup(ctx) : undefined) as S;
  const collector = new SampleCollector();
  try {
    for (let i = 0; i < ctx.config.warmup; i++) {
      await cell.measureOnce(ctx, state, "warmup", i); // discarded (not added)
    }
    for (let i = 0; i < ctx.config.warmSamples; i++) {
      collector.add("warm", stripIndexKind(await cell.measureOnce(ctx, state, "warm", i)));
    }
  } finally {
    if (cell.teardown) await cell.teardown(ctx, state);
  }

  const total = computeStats(collector.analysisDurations());
  const warm = computeStats(collector.durations("warm"));
  const phases: Record<string, Stats> = {};
  for (const [phase, values] of Object.entries(collector.phaseDurations())) {
    phases[phase] = computeStats(values);
  }
  const passed = cell.budgetMs !== undefined ? total.n > 0 && total.p95 <= cell.budgetMs : undefined;
  const notes = cell.notes?.(collector.all()) ?? [];
  return {
    id: cell.id,
    describe: cell.describe,
    coords: cell.coords,
    command,
    seed: ctx.seed,
    samples: [...collector.all()],
    stats: {
      total,
      ...(warm.n ? { warm } : {}),
      ...(Object.keys(phases).length ? { phases } : {}),
    },
    budgetMs: cell.budgetMs,
    passed,
    notes: notes.length ? notes : undefined,
  };
}

/** The collector assigns its own kind/index; drop the sample's own so they don't conflict. */
function stripIndexKind(sample: Sample): Omit<Sample, "index" | "kind"> {
  const { index: _i, kind: _k, ...rest } = sample;
  return rest;
}

/**
 * A cell with its state type ERASED behind a closure — lets a registry hold cells with different
 * `S` in one array without variance conflicts (`execute` captures the concrete `S`).
 */
export type ErasedCell = {
  id: string;
  describe: string;
  coords?: BenchCellCoords;
  budgetMs?: number;
  execute: (ctx: MeasureContext, command: string) => Promise<BenchCellResult>;
};

/** Erase a cell's state type by binding it into an `execute` closure over `runMeasurableCell`. */
export function eraseCell<S>(cell: MeasurableCell<S>): ErasedCell {
  return {
    id: cell.id,
    describe: cell.describe,
    coords: cell.coords,
    budgetMs: cell.budgetMs,
    execute: (ctx, command) => runMeasurableCell(cell, ctx, command),
  };
}

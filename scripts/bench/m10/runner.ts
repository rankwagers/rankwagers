/**
 * M10 Benchmark Framework — runner skeleton (Stage 2E, Slice 1).
 *
 * Defines the harness lifecycle (register cell → warmup → warm sampling → stats → artifact) and
 * a CLI entry that reports framework status. **Slice 1 registers ZERO cells and executes NO
 * benchmark and NO pipeline.** Later slices register `BenchCell`s whose `run` performs the
 * actual (isolated, synthetic-fixture) measurement.
 *
 * Cold samples are process-level (a fresh process per cold sample); the in-process runner
 * collects warm samples and phase splits. No route timing, no strict reader, no dry-run/canary/
 * FULL_WRITE here — those are later slices.
 */

import { resolveBenchConfig, toPublicConfig, type BenchConfig } from "./config";
import { BenchLogger } from "./logger";
import { SampleCollector } from "./sample";
import { computeStats } from "./statistics";
import { captureMachineSpec } from "./machine";
import { time, PhaseTimer } from "./timing";
import { buildArtifact, writeArtifacts } from "./report";
import { ensureArtifactDirs } from "./fsutil";
import { assertBenchmarkSafeEnv } from "./guards";
import type { BenchCell, BenchCellResult, BenchContext, Stats } from "./types";

export type SampleCellOptions = {
  /** Pass/fail budget in ms for the total-duration p95, when applicable. */
  budgetMs?: number;
  seed?: number;
  command?: string;
};

/** Registry + lifecycle. Ships empty in Slice 1 (no cells → nothing runs). */
export class BenchRunner {
  private readonly cellsById = new Map<string, BenchCell>();
  constructor(
    readonly config: BenchConfig,
    readonly logger: BenchLogger
  ) {}

  register(cell: BenchCell): this {
    if (this.cellsById.has(cell.id)) {
      throw new Error(`duplicate benchmark cell id: ${cell.id}`);
    }
    this.cellsById.set(cell.id, cell);
    return this;
  }

  cells(): BenchCell[] {
    return [...this.cellsById.values()];
  }

  /**
   * Warm-sample one cell's `run` (skeleton). Warmup runs are discarded; warm runs are collected
   * with per-phase splits when the cell records them on a shared `PhaseTimer` via the context.
   * Executes ONLY a cell that supplies a `run` — Slice 1 supplies none.
   */
  async sampleWarm(cell: BenchCell, opts: SampleCellOptions = {}): Promise<BenchCellResult> {
    const collector = new SampleCollector();
    const ctx: BenchContext = { config: this.config, logger: this.logger };
    const run = cell.run;
    if (!run) {
      // Framework-only cell (no measurement): return an empty, honest result.
      return this.assemble(cell, collector, opts, ["cell has no run() — framework only"]);
    }
    for (let i = 0; i < this.config.warmup; i++) {
      await Promise.resolve(run(ctx)); // warmup: discarded
    }
    for (let i = 0; i < this.config.warmSamples; i++) {
      const { durationMs } = await time(() => run(ctx));
      collector.add("warm", { durationMs });
    }
    return this.assemble(cell, collector, opts);
  }

  private assemble(
    cell: BenchCell,
    collector: SampleCollector,
    opts: SampleCellOptions,
    notes: string[] = []
  ): BenchCellResult {
    const total = computeStats(collector.analysisDurations());
    const warm = computeStats(collector.durations("warm"));
    const cold = computeStats(collector.durations("cold"));
    const phases: Record<string, Stats> = {};
    for (const [phase, values] of Object.entries(collector.phaseDurations())) {
      phases[phase] = computeStats(values);
    }
    const passed = opts.budgetMs !== undefined ? total.n > 0 && total.p95 <= opts.budgetMs : undefined;
    return {
      id: cell.id,
      describe: cell.describe,
      coords: cell.coords,
      command: opts.command ?? "(framework)",
      seed: opts.seed ?? 0,
      samples: [...collector.all()],
      stats: {
        total,
        ...(warm.n ? { warm } : {}),
        ...(cold.n ? { cold } : {}),
        ...(Object.keys(phases).length ? { phases } : {}),
      },
      budgetMs: opts.budgetMs,
      passed,
      notes: notes.length ? notes : undefined,
    };
  }
}

/** Re-export so later slices can construct a `PhaseTimer` from the runner module if convenient. */
export { PhaseTimer };

/**
 * CLI entry — framework status only. Ensures the artifact directories exist and reports that
 * Slice 1 registered no cells and executed nothing. Writes NO benchmark artifact.
 */
async function main(): Promise<void> {
  const config = resolveBenchConfig(process.env);
  const logger = new BenchLogger({
    outputDir: config.outputDir,
    logFile: "framework-status.log",
  });
  try {
    assertBenchmarkSafeEnv(process.env);
  } catch (err) {
    logger.error("bench env is not benchmark-safe", { error: (err as Error).message });
    process.exitCode = 1;
    return;
  }
  await ensureArtifactDirs(config.outputDir);
  const runner = new BenchRunner(config, logger);
  const machine = captureMachineSpec(new Date().toISOString());
  logger.info("M10 benchmark framework ready (Stage 2E — Slice 1)", {
    cells: runner.cells().length,
    outputDir: config.outputDirLabel,
    config: toPublicConfig(config),
    node: machine.nodeVersion,
    cpuCount: machine.cpuCount,
  });
  logger.info("Slice 1 is framework-only: 0 cells registered, nothing executed.");
  // Sanity: prove the report/build path is wired without running any pipeline.
  void buildArtifact;
  void writeArtifacts;
}

// Only run when invoked directly (`tsx scripts/bench/m10/runner.ts`), never on import.
const invokedDirectly =
  typeof process.argv[1] === "string" && process.argv[1].endsWith("runner.ts");
if (invokedDirectly) {
  void main();
}

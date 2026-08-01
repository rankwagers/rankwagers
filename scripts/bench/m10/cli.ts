/**
 * M10 Benchmark Framework — Slice 2 CLI (route-entry timing).
 *
 * The ONLY execution entry for the Slice-2 measurement cells. Importing this module executes
 * NOTHING (the run is gated on direct invocation). Every run:
 *   1. asserts the env is benchmark-safe (refuses a prod DB URL / prod archive dir / live-flag-on)
 *      BEFORE any cell — the isolation guard runs first, always;
 *   2. runs the selected synthetic cells in-process (warmup discarded, warm collected);
 *   3. writes JSON + stats CSV + RAW per-sample CSV + markdown summary under the output dir only.
 *
 * No production activation, no flag, no cron, no prod archive, no prod DB. Small smoke sample
 * counts are acceptable for Slice-2 validation; this CLI issues NO GO/NO-GO conclusion.
 *
 *   tsx scripts/bench/m10/cli.ts run [cellId...] [--smoke] [--out <dir>] [--seed <n>]
 */

import { resolveBenchConfig, toPublicConfig, type BenchConfig } from "./config";
import { BenchLogger } from "./logger";
import { captureMachineSpec } from "./machine";
import { assertBenchmarkSafeEnv, assertDisposableDatabaseUrl } from "./guards";
import { ensureArtifactDirs } from "./fsutil";
import { buildArtifact, writeArtifacts } from "./report";
import { type ErasedCell, type MeasureContext } from "./measure";
import { SLICE2_CELLS } from "./cells";

export type RunCellsOptions = {
  cellIds?: readonly string[];
  outputDir?: string;
  warmup?: number;
  warmSamples?: number;
  seed?: number;
  nowIso?: string;
  env?: NodeJS.ProcessEnv;
  logger?: BenchLogger;
};

export type RunCellsResult = {
  cellId: string;
  artifacts: { json: string; csv: string; rawCsv: string; summary: string };
  warmSamples: number;
  passed?: boolean;
};

/** Registered Slice-2 cells, by id. */
export function registeredCells(): ErasedCell[] {
  return [...SLICE2_CELLS];
}

function selectCells(cellIds?: readonly string[]): ErasedCell[] {
  if (!cellIds || cellIds.length === 0) return registeredCells();
  const byId = new Map(registeredCells().map((c) => [c.id, c]));
  const picked: ErasedCell[] = [];
  for (const id of cellIds) {
    const cell = byId.get(id) ?? byId.get(`settlement.${id}`);
    if (!cell) throw new Error(`unknown benchmark cell: ${id} (have: ${[...byId.keys()].join(", ")})`);
    picked.push(cell);
  }
  return picked;
}

/**
 * Programmatic entry (used by the CLI and by tests). Runs the isolation guard FIRST, then the
 * selected cells against synthetic fixtures, writing artifacts only under the output dir.
 */
export async function runCells(opts: RunCellsOptions = {}): Promise<RunCellsResult[]> {
  const env = opts.env ?? process.env;
  // Isolation guards BEFORE any cell — refuse a live pipeline flag AND a prod-looking evidence
  // DB URL. The deadline-gap cell exercises the real runner (which acquires a durable job lock via
  // process.env); a prod DB URL here could target a real store, so it is refused outright.
  assertBenchmarkSafeEnv(env);
  assertDisposableDatabaseUrl(env.EVIDENCE_DATABASE_URL);

  const base = resolveBenchConfig(env);
  const config: BenchConfig = {
    ...base,
    ...(opts.outputDir ? { outputDir: opts.outputDir, outputDirLabel: "artifacts" } : {}),
    ...(opts.warmup !== undefined ? { warmup: opts.warmup } : {}),
    ...(opts.warmSamples !== undefined ? { warmSamples: opts.warmSamples } : {}),
  };
  const logger = opts.logger ?? new BenchLogger({ outputDir: config.outputDir, logFile: "slice2.log" });
  const nowIso = opts.nowIso ?? new Date().toISOString();
  const seed = opts.seed ?? 1;

  await ensureArtifactDirs(config.outputDir);
  const machine = captureMachineSpec(nowIso);
  const publicConfig = toPublicConfig(config);
  const ctx: MeasureContext = { config, logger, seed };
  const command = "scripts/bench/m10/cli.ts run";

  // Force in-process memory job locks for the run's duration (the runner resolves the lock
  // adapter from process.env). This keeps the deadline-gap cell fully synthetic — it never opens
  // a real Pool — regardless of the ambient env. Restored in `finally`.
  const priorLockAdapter = process.env.JOB_LOCK_ADAPTER;
  process.env.JOB_LOCK_ADAPTER = "memory";

  const results: RunCellsResult[] = [];
  try {
    for (const cell of selectCells(opts.cellIds)) {
      logger.info(`running cell ${cell.id}`, { warm: config.warmSamples, warmup: config.warmup });
      const result = await cell.execute(ctx, command);
      const artifact = buildArtifact(result, machine, publicConfig, nowIso);
      const artifacts = await writeArtifacts(
        config.outputDir,
        artifact,
        config.cvUnstableThreshold,
        config.criticalSamples
      );
      results.push({ cellId: cell.id, artifacts, warmSamples: result.stats.total.n, passed: result.passed });
    }
  } finally {
    if (priorLockAdapter === undefined) delete process.env.JOB_LOCK_ADAPTER;
    else process.env.JOB_LOCK_ADAPTER = priorLockAdapter;
  }
  return results;
}

type ParsedArgs = { command: string; cellIds: string[]; smoke: boolean; out?: string; seed?: number };

export function parseArgs(argv: readonly string[]): ParsedArgs {
  const out: ParsedArgs = { command: argv[0] ?? "run", cellIds: [], smoke: false };
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--smoke") out.smoke = true;
    else if (a === "--out") out.out = argv[++i];
    else if (a === "--seed") out.seed = Number(argv[++i]);
    else if (!a.startsWith("--")) out.cellIds.push(a);
  }
  return out;
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));
  const logger = new BenchLogger({
    outputDir: parsed.out ?? resolveBenchConfig(process.env).outputDir,
    logFile: "slice2.log",
  });
  if (parsed.command !== "run") {
    logger.info("usage: tsx scripts/bench/m10/cli.ts run [cellId...] [--smoke] [--out <dir>] [--seed <n>]", {
      cells: registeredCells().map((c) => c.id),
    });
    return;
  }
  try {
    const results = await runCells({
      cellIds: parsed.cellIds.length ? parsed.cellIds : undefined,
      outputDir: parsed.out,
      seed: parsed.seed,
      ...(parsed.smoke ? { warmup: 1, warmSamples: 8 } : {}),
      logger,
    });
    for (const r of results) {
      logger.info(`cell ${r.cellId} → ${r.warmSamples} warm samples`, {
        summary: r.artifacts.summary,
        rawCsv: r.artifacts.rawCsv,
      });
    }
    logger.info("Slice-2 measurement complete (synthetic, in-process). No GO/NO-GO conclusion.");
  } catch (err) {
    logger.error("benchmark run failed", { error: (err as Error).message });
    process.exitCode = 1;
  }
}

// Run ONLY when invoked directly (`tsx scripts/bench/m10/cli.ts …`), never on import.
const invokedDirectly =
  typeof process.argv[1] === "string" && process.argv[1].endsWith("cli.ts");
if (invokedDirectly) {
  void main();
}

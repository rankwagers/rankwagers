/**
 * M10 Benchmark Framework — configuration (Stage 2E, Slice 1).
 *
 * Pure, deterministic, fail-safe env resolution for the benchmark harness. Reads ONLY
 * `M10_BENCH_*` variables — it never reads, and must never influence, any runtime/production
 * env (no EVIDENCE_*, no flags, no DB). Defaults follow the Stage-2E-B measurement contract
 * (warmup 3; ≥30 warm; ≥10 cold; ≥100 critical for p99 tail confidence; CV≤0.25 stability).
 */

import path from "node:path";
import type { BenchConfigPublic } from "./types";

export type BenchConfig = {
  /** Absolute root directory for artifact output (created lazily by the fs abstraction). */
  outputDir: string;
  /** Short label for the output dir embedded in artifacts (never an absolute prod path). */
  outputDirLabel: string;
  /** Warmup runs discarded per cell. */
  warmup: number;
  /** Warm (steady-state) samples per cell. */
  warmSamples: number;
  /** Cold (fresh-process) samples per critical cell. */
  coldSamples: number;
  /** Samples for a critical cell needing p99 tail confidence (finding M-I). */
  criticalSamples: number;
  /** A cell is flagged unstable (re-run/investigate) above this coefficient of variation. */
  cvUnstableThreshold: number;
};

export const BENCH_DEFAULTS = {
  warmup: 3,
  warmSamples: 30,
  coldSamples: 10,
  criticalSamples: 100,
  cvUnstableThreshold: 0.25,
} as const;

/** Default artifact root, co-located with the harness (generated, git-ignored). */
export function defaultOutputDir(): string {
  return path.join(process.cwd(), "scripts", "bench", "m10", "artifacts");
}

function readPositiveInt(raw: string | undefined, fallback: number): number {
  const v = raw?.trim();
  if (!v) return fallback;
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

function readNonNegativeInt(raw: string | undefined, fallback: number): number {
  const v = raw?.trim();
  if (!v) return fallback;
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 ? n : fallback;
}

function readRatio(raw: string | undefined, fallback: number): number {
  const v = raw?.trim();
  if (!v) return fallback;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 && n <= 1 ? n : fallback;
}

/** Resolve the benchmark config from `M10_BENCH_*` env. Deterministic; fail-safe defaults. */
export function resolveBenchConfig(
  env: NodeJS.ProcessEnv = process.env
): BenchConfig {
  const outputDir = env.M10_BENCH_OUTPUT_DIR?.trim()
    ? path.resolve(env.M10_BENCH_OUTPUT_DIR.trim())
    : defaultOutputDir();
  return {
    outputDir,
    outputDirLabel: path.relative(process.cwd(), outputDir) || outputDir,
    warmup: readNonNegativeInt(env.M10_BENCH_WARMUP, BENCH_DEFAULTS.warmup),
    warmSamples: readPositiveInt(env.M10_BENCH_WARM_SAMPLES, BENCH_DEFAULTS.warmSamples),
    coldSamples: readNonNegativeInt(env.M10_BENCH_COLD_SAMPLES, BENCH_DEFAULTS.coldSamples),
    criticalSamples: readPositiveInt(
      env.M10_BENCH_CRITICAL_SAMPLES,
      BENCH_DEFAULTS.criticalSamples
    ),
    cvUnstableThreshold: readRatio(
      env.M10_BENCH_CV_THRESHOLD,
      BENCH_DEFAULTS.cvUnstableThreshold
    ),
  };
}

/** Project the config to the artifact-safe public surface (no absolute prod path). */
export function toPublicConfig(config: BenchConfig): BenchConfigPublic {
  return {
    warmup: config.warmup,
    warmSamples: config.warmSamples,
    coldSamples: config.coldSamples,
    criticalSamples: config.criticalSamples,
    cvUnstableThreshold: config.cvUnstableThreshold,
    outputDirLabel: config.outputDirLabel,
  };
}

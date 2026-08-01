/**
 * M10 Benchmark Framework — statistics abstraction (Stage 2E, Slice 1).
 *
 * Pure descriptive statistics computed from RAW per-sample durations. Reconciliation finding
 * M-G: percentiles come from the harness's own samples, NEVER from the runtime metrics API
 * (which only aggregates count/sum/max and cannot yield p50/p95/p99). No I/O, no clock.
 */

import type { Stats } from "./types";

/** Empty-safe zeroed stats. */
export function emptyStats(): Stats {
  return { n: 0, min: 0, max: 0, mean: 0, median: 0, p95: 0, p99: 0, stddev: 0, cv: 0 };
}

/**
 * Linear-interpolation percentile over an ASCENDING-sorted array (type-7 / Excel `PERCENTILE.INC`).
 * `p` in [0,1]. Returns 0 for an empty array (empty-safe).
 */
export function percentile(sortedAsc: readonly number[], p: number): number {
  const n = sortedAsc.length;
  if (n === 0) return 0;
  if (n === 1) return sortedAsc[0];
  const clampedP = Math.min(1, Math.max(0, p));
  const rank = clampedP * (n - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sortedAsc[lo];
  const frac = rank - lo;
  return sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * frac;
}

/** Compute full descriptive stats from raw samples. Deterministic; never throws. */
export function computeStats(values: readonly number[]): Stats {
  const finite = values.filter((v) => Number.isFinite(v));
  const n = finite.length;
  if (n === 0) return emptyStats();
  const sorted = [...finite].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const mean = sum / n;
  const variance =
    n > 1
      ? sorted.reduce((acc, v) => acc + (v - mean) * (v - mean), 0) / (n - 1)
      : 0;
  const stddev = Math.sqrt(variance);
  return {
    n,
    min: sorted[0],
    max: sorted[n - 1],
    mean,
    median: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    p99: percentile(sorted, 0.99),
    stddev,
    cv: mean === 0 ? 0 : stddev / mean,
  };
}

/** Whether a cell's total-duration distribution is stable enough to trust (CV ≤ threshold). */
export function isStable(stats: Stats, cvUnstableThreshold: number): boolean {
  return stats.n > 0 && stats.cv <= cvUnstableThreshold;
}

/** Whether the sample count meets the p99 tail-confidence bar (finding M-I). */
export function hasTailConfidence(stats: Stats, criticalSamples: number): boolean {
  return stats.n >= criticalSamples;
}

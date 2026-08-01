import type { ChartPoint } from "./contracts";

/** Pure helpers for client chart components — no React. */
export function maxChartValue(points: readonly ChartPoint[]): number {
  let max = 0;
  for (const p of points) {
    if (p.value != null && p.value > max) max = p.value;
  }
  return max || 1;
}

export function chartBarPct(value: number | null, max: number): number {
  if (value == null || max <= 0) return 0;
  return Math.min(100, Math.round((value / max) * 1000) / 10);
}

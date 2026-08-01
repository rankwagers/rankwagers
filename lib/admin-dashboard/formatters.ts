import type { MetricValue } from "./contracts";

export function metricNumber(value: number | null | undefined, reason = "Unavailable"): MetricValue {
  if (value == null || !Number.isFinite(value)) {
    return { available: false, reason };
  }
  return { available: true, value };
}

export function metricString(value: string | null | undefined, reason = "Unavailable"): MetricValue {
  if (value == null || !String(value).trim()) {
    return { available: false, reason };
  }
  return { available: true, value: String(value) };
}

export function formatMetric(m: MetricValue): string {
  if (!m.available) return "Unavailable";
  return String(m.value);
}

export function hitRatePct(won: number, lost: number): number | null {
  const settled = won + lost;
  if (settled <= 0) return null;
  return Math.round((won / settled) * 1000) / 10;
}

export function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

export function pct(part: number, whole: number): number | null {
  if (whole <= 0) return null;
  return Math.round((part / whole) * 1000) / 10;
}

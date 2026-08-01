import type { MetricDefinition } from "./metrics";

/** Funnel step attribution — exposure → outcome within window. */
export function isWithinAttributionWindow(
  exposureTs: string,
  outcomeTs: string,
  metric: MetricDefinition,
): boolean {
  const a = Date.parse(exposureTs);
  const b = Date.parse(outcomeTs);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return false;
  const hours = (b - a) / (1000 * 60 * 60);
  return hours <= metric.attributionWindowHours;
}

/**
 * Provider-neutral in-memory metrics + structured log export.
 * No Prometheus/Datadog in Phase C.
 */

export type MetricLabels = Record<string, string | number | boolean | undefined>;

type CounterKey = string;
type GaugeKey = string;

const counters = new Map<CounterKey, number>();
const gauges = new Map<GaugeKey, number>();
const timers = new Map<string, { count: number; sum: number; max: number }>();

/**
 * Defensive cardinality cap. Metric labels are bounded, low-cardinality enums by convention,
 * but a single stray high-cardinality label (a fixtureId, date, path, click id) would otherwise
 * grow these in-memory maps without bound — a slow heap leak on a long-lived process. Each map
 * is capped: existing series always update; a NEW series beyond the cap is dropped and counted,
 * so a misconfigured call site degrades observability instead of leaking memory.
 */
const MAX_SERIES = (() => {
  const n = Number(process.env.METRICS_MAX_SERIES);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 5000;
})();
let seriesDropped = 0;

/** Whether `map` may accept `key`. Existing keys always pass; a new key past the cap is dropped. */
function admit<V>(map: Map<string, V>, key: string): boolean {
  if (map.has(key)) return true;
  if (map.size < MAX_SERIES) return true;
  seriesDropped += 1;
  return false;
}

const SENSITIVE_LABEL =
  /(secret|token|password|email|clickid|click_id|revenue|commission|conversion_value|api[_-]?key)/i;

function sanitizeLabels(labels?: MetricLabels): Record<string, string> {
  if (!labels) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(labels)) {
    if (SENSITIVE_LABEL.test(k)) continue;
    if (v === undefined) continue;
    const s = String(v);
    if (SENSITIVE_LABEL.test(s)) continue;
    out[k] = s.slice(0, 64);
  }
  return out;
}

function keyOf(name: string, labels?: MetricLabels): string {
  const clean = sanitizeLabels(labels);
  const parts = Object.keys(clean)
    .sort()
    .map((k) => `${k}=${clean[k]}`);
  return parts.length ? `${name}|${parts.join(",")}` : name;
}

function safeRun(fn: () => void): void {
  try {
    fn();
  } catch {
    // Metrics must never crash requests.
  }
}

export const metrics = {
  increment(name: string, labels?: MetricLabels, by = 1): void {
    safeRun(() => {
      const key = keyOf(name, labels);
      if (!admit(counters, key)) return;
      counters.set(key, (counters.get(key) ?? 0) + by);
    });
  },

  gauge(name: string, value: number, labels?: MetricLabels): void {
    safeRun(() => {
      if (!Number.isFinite(value)) return;
      const key = keyOf(name, labels);
      if (!admit(gauges, key)) return;
      gauges.set(key, value);
    });
  },

  timing(name: string, durationMs: number, labels?: MetricLabels): void {
    safeRun(() => {
      if (!Number.isFinite(durationMs) || durationMs < 0) return;
      const key = keyOf(name, labels);
      if (!admit(timers, key)) return;
      const prev = timers.get(key) ?? { count: 0, sum: 0, max: 0 };
      prev.count += 1;
      prev.sum += durationMs;
      prev.max = Math.max(prev.max, durationMs);
      timers.set(key, prev);
    });
  },

  /** Async-safe timer helper */
  async timeAsync<T>(
    name: string,
    fn: () => Promise<T>,
    labels?: MetricLabels
  ): Promise<T> {
    const start = Date.now();
    try {
      return await fn();
    } finally {
      metrics.timing(name, Date.now() - start, labels);
    }
  },

  snapshot(): {
    counters: Record<string, number>;
    gauges: Record<string, number>;
    timers: Record<string, { count: number; sum: number; avg: number; max: number }>;
  } {
    const counterOut: Record<string, number> = {};
    for (const [k, v] of counters) counterOut[k] = v;
    // Surface cardinality-cap pressure so a misconfigured high-cardinality label is visible
    // in diagnostics/alerting rather than silently degrading metrics.
    if (seriesDropped > 0) counterOut["metrics_series_dropped"] = seriesDropped;
    const gaugeOut: Record<string, number> = {};
    for (const [k, v] of gauges) gaugeOut[k] = v;
    const timerOut: Record<
      string,
      { count: number; sum: number; avg: number; max: number }
    > = {};
    for (const [k, v] of timers) {
      timerOut[k] = {
        count: v.count,
        sum: v.sum,
        avg: v.count ? v.sum / v.count : 0,
        max: v.max,
      };
    }
    return { counters: counterOut, gauges: gaugeOut, timers: timerOut };
  },

  reset(): void {
    counters.clear();
    gauges.clear();
    timers.clear();
    seriesDropped = 0;
  },
};

/** Public-safe metrics view for protected diagnostics. */
export function publicMetricsView() {
  const snap = metrics.snapshot();
  return {
    generatedAt: new Date().toISOString(),
    adapter: "memory",
    ...snap,
  };
}

/**
 * Internal Core Web Vitals sink — a self-contained append-only log, kept
 * SEPARATE from the frozen `data/events.log` (SiteEvent) schema so performance
 * telemetry never couples into the affiliate event contract.
 *
 * One JSON line per sample. Bounded tail read for the admin dashboard; p75 is
 * the field metric Google reports against.
 */

import { promises as fs } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const VITALS_FILE = path.join(DATA_DIR, "web-vitals.log");

export const WEB_VITAL_METRICS = ["LCP", "INP", "CLS", "FCP", "TTFB"] as const;
export type WebVitalMetric = (typeof WEB_VITAL_METRICS)[number];

export type WebVitalSample = {
  ts: string;
  metric: WebVitalMetric;
  value: number; // integer; CLS is ×1000
  rating: string;
  path: string;
  navigationType: string;
};

export function isWebVitalMetric(v: unknown): v is WebVitalMetric {
  return (
    typeof v === "string" && (WEB_VITAL_METRICS as readonly string[]).includes(v)
  );
}

export async function appendWebVital(sample: WebVitalSample): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.appendFile(VITALS_FILE, `${JSON.stringify(sample)}\n`, "utf-8");
}

/** Read the last `maxLines` samples (bounded); tolerant of torn/partial lines. */
export async function readRecentWebVitals(
  maxLines = 20_000
): Promise<WebVitalSample[]> {
  let raw: string;
  try {
    raw = await fs.readFile(VITALS_FILE, "utf-8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code === "ENOENT") return [];
    throw err;
  }
  const lines = raw.split("\n").filter(Boolean);
  const tail = lines.slice(-maxLines);
  const out: WebVitalSample[] = [];
  for (const line of tail) {
    try {
      const s = JSON.parse(line) as WebVitalSample;
      if (isWebVitalMetric(s.metric) && Number.isFinite(s.value)) out.push(s);
    } catch {
      /* skip a torn line; telemetry is non-authoritative */
    }
  }
  return out;
}

export type WebVitalSummary = {
  metric: WebVitalMetric;
  count: number;
  p75: number | null;
  good: number; // rating === "good"
};

function percentile(sortedAsc: number[], p: number): number | null {
  if (sortedAsc.length === 0) return null;
  const idx = Math.min(
    sortedAsc.length - 1,
    Math.ceil((p / 100) * sortedAsc.length) - 1
  );
  return sortedAsc[Math.max(0, idx)];
}

/** p75 per metric — the field-data statistic Core Web Vitals is graded on. */
export function summarizeWebVitals(samples: WebVitalSample[]): WebVitalSummary[] {
  return WEB_VITAL_METRICS.map((metric) => {
    const vals = samples
      .filter((s) => s.metric === metric)
      .map((s) => s.value)
      .sort((a, b) => a - b);
    const good = samples.filter(
      (s) => s.metric === metric && s.rating === "good"
    ).length;
    return { metric, count: vals.length, p75: percentile(vals, 75), good };
  });
}

import { buildDataQualityApiResponse, buildDataQualityReport } from "./reports";
import type { DataQualityReport } from "./types";

export * from "./types";
export * from "./metrics";
export * from "./validators";
export * from "./integrity";
export * from "./coverage";
export * from "./seoAudit";
export * from "./reports";
export * from "./pipeline";

type CacheEntry = {
  report: DataQualityReport;
  expiresAt: number;
};

let cache: CacheEntry | undefined;

const DEFAULT_TTL_MS = 60_000;

/** Cached full report for developer dashboard / health API. Not used on public SSR hot paths. */
export function getDataQualityReport(options?: {
  force?: boolean;
  ttlMs?: number;
  now?: number;
}): DataQualityReport {
  const now = options?.now ?? Date.now();
  const ttl = options?.ttlMs ?? DEFAULT_TTL_MS;
  if (!options?.force && cache && cache.expiresAt > now) {
    return cache.report;
  }
  const report = buildDataQualityReport(now);
  cache = { report, expiresAt: now + ttl };
  return report;
}

export function getDataQualityApiPayload(options?: { force?: boolean }) {
  return buildDataQualityApiResponse(getDataQualityReport(options));
}

/** Test helper */
export function resetDataQualityCache(): void {
  cache = undefined;
}

import { buildCrawlQualityApiResponse, buildCrawlQualityReport } from "./reports";
import type { CrawlQualityApiResponse, CrawlQualityReport } from "./types";

type CacheEntry = {
  report: CrawlQualityReport;
  expiresAt: number;
};

let cache: CacheEntry | undefined;

const DEFAULT_TTL_MS = 60_000;

/** Cached full report for developer dashboard / monitoring API. Not used on public SSR. */
export function getCrawlQualityReport(options?: {
  force?: boolean;
  ttlMs?: number;
  now?: number;
}): CrawlQualityReport {
  const now = options?.now ?? Date.now();
  const ttl = options?.ttlMs ?? DEFAULT_TTL_MS;
  if (!options?.force && cache && cache.expiresAt > now) {
    return cache.report;
  }
  const report = buildCrawlQualityReport(now);
  cache = { report, expiresAt: now + ttl };
  return report;
}

export function getCrawlQualityApiPayload(options?: {
  force?: boolean;
}): CrawlQualityApiResponse {
  return buildCrawlQualityApiResponse(getCrawlQualityReport(options));
}

/** Test helper */
export function resetCrawlQualityCache(): void {
  cache = undefined;
}

export function crawlQualityCacheStats(): { entries: number; expiresAt: number | null } {
  return {
    entries: cache ? 1 : 0,
    expiresAt: cache?.expiresAt ?? null,
  };
}

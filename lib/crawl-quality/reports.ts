import { runCrawlAudit } from "./audit";
import {
  buildCrawlMetrics,
  buildEntityCoverage,
  reportStatus,
  summarizeFindings,
} from "./metrics";
import type { CrawlQualityApiResponse, CrawlQualityReport } from "./types";

export function buildCrawlQualityReport(now = Date.now()): CrawlQualityReport {
  const { routes, stats, findings } = runCrawlAudit();
  const metrics = buildCrawlMetrics({ routes, findings, stats });
  return {
    status: reportStatus(metrics),
    generatedAt: new Date(now).toISOString(),
    metrics,
    routes,
    findings,
    linkStats: stats,
    entityCoverage: buildEntityCoverage(routes, findings, stats),
    summary: summarizeFindings(findings),
  };
}

export function buildCrawlQualityApiResponse(
  report: CrawlQualityReport = buildCrawlQualityReport()
): CrawlQualityApiResponse {
  return {
    crawlQuality: report.metrics.crawlQuality,
    orphanPages: report.metrics.orphanCount,
    thinPages: report.metrics.thinPageCount,
    brokenCanonicals: report.metrics.brokenCanonicalCount,
    structuredDataCoverage: report.metrics.structuredDataCoverage,
    internalLinkScore: report.metrics.internalLinkScore,
  };
}

export function filterCrawlFindings(
  findings: CrawlQualityReport["findings"],
  input: { category?: string; severity?: string; q?: string }
) {
  const q = input.q?.trim().toLowerCase() ?? "";
  return findings.filter((finding) => {
    if (input.category && finding.category !== input.category) return false;
    if (input.severity && finding.severity !== input.severity) return false;
    if (q) {
      const haystack =
        `${finding.message} ${finding.entityId ?? ""} ${finding.entityType ?? ""} ${finding.id}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

import { auditCoverage, buildCoverageMetrics } from "./coverage";
import { auditGraphIntegrity, auditResolvers } from "./integrity";
import {
  buildIntegrityScorecard,
  categoryScoreValue,
  reportStatus,
  summarizeFindings,
} from "./metrics";
import {
  auditAnalyticsIntegrity,
  auditPublicRoutes,
  auditSeoIntegrity,
  auditSitemapIntegrity,
} from "./seoAudit";
import type {
  DataQualityApiResponse,
  DataQualityFinding,
  DataQualityReport,
} from "./types";
import { validateAllEntities } from "./validators";

export function collectFindings(): DataQualityFinding[] {
  return [
    ...validateAllEntities(),
    ...auditResolvers(),
    ...auditGraphIntegrity(),
    ...auditCoverage(),
    ...auditSeoIntegrity(),
    ...auditSitemapIntegrity(),
    ...auditAnalyticsIntegrity(),
    ...auditPublicRoutes(),
  ];
}

export function buildDataQualityReport(now = Date.now()): DataQualityReport {
  const findings = collectFindings();
  const integrity = buildIntegrityScorecard(findings);
  const status = reportStatus(integrity);
  return {
    status,
    generatedAt: new Date(now).toISOString(),
    integrity,
    coverage: buildCoverageMetrics(),
    findings,
    summary: summarizeFindings(findings),
  };
}

export function buildDataQualityApiResponse(
  report: DataQualityReport = buildDataQualityReport()
): DataQualityApiResponse {
  const coverageScore = categoryScoreValue(report.integrity, "coverage");
  return {
    status: report.status,
    integrity: report.integrity.overall,
    coverage: coverageScore,
    registry: categoryScoreValue(report.integrity, "registry"),
    graph: categoryScoreValue(report.integrity, "graph"),
    seo: categoryScoreValue(report.integrity, "seo"),
    analytics: categoryScoreValue(report.integrity, "analytics"),
    relationships: categoryScoreValue(report.integrity, "relationships"),
    resolvers: categoryScoreValue(report.integrity, "resolvers"),
  };
}

export function filterFindings(
  findings: readonly DataQualityFinding[],
  input: {
    category?: string;
    severity?: string;
    q?: string;
  }
): DataQualityFinding[] {
  const q = input.q?.trim().toLowerCase() ?? "";
  return findings.filter((finding) => {
    if (input.category && finding.category !== input.category) return false;
    if (input.severity && finding.severity !== input.severity) return false;
    if (q) {
      const haystack = `${finding.message} ${finding.entityId ?? ""} ${finding.entityType ?? ""} ${finding.id}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

import { breadcrumbCoverageScore } from "./breadcrumbs";
import { countBrokenCanonicals } from "./canonical";
import { hreflangCoverageScore } from "./hreflang";
import { inventoryEntityRoutes } from "./inventory";
import { countOrphans } from "./orphans";
import { structuredDataCoverageScore } from "./schema";
import { sitemapCoverageScore } from "./sitemap";
import { countThinPages } from "./thin";
import type {
  CrawlFinding,
  CrawlFindingCategory,
  CrawlMetrics,
  EntityCoverageRow,
  PublicRoute,
  RouteLinkStats,
} from "./types";

const CATEGORIES: CrawlFindingCategory[] = [
  "inventory",
  "links",
  "orphans",
  "canonical",
  "hreflang",
  "breadcrumbs",
  "thin",
  "schema",
  "sitemap",
  "a11y",
  "metrics",
];

export function summarizeFindings(
  findings: readonly CrawlFinding[]
): Record<CrawlFindingCategory, { pass: number; warning: number; error: number; info: number }> {
  const summary = Object.fromEntries(
    CATEGORIES.map((category) => [category, { pass: 0, warning: 0, error: 0, info: 0 }])
  ) as Record<
    CrawlFindingCategory,
    { pass: number; warning: number; error: number; info: number }
  >;
  for (const finding of findings) {
    const bucket = summary[finding.category];
    if (!bucket) continue;
    if (finding.severity === "pass") bucket.pass += 1;
    else if (finding.severity === "warning") bucket.warning += 1;
    else if (finding.severity === "error") bucket.error += 1;
    else bucket.info += 1;
  }
  return summary;
}

export function buildEntityCoverage(
  routes: readonly PublicRoute[],
  findings: readonly CrawlFinding[],
  stats: readonly RouteLinkStats[]
): EntityCoverageRow[] {
  const types = ["competition", "season", "team", "market", "operator"] as const;
  const statsByKey = new Map(stats.map((row) => [row.key, row]));
  return types.map((entityType) => {
    const entities = routes.filter((r) => r.kind === "entity" && r.entityType === entityType);
    const orphans = entities.filter((e) => (statsByKey.get(e.key)?.inbound ?? 0) === 0).length;
    const thin = findings.filter(
      (f) => f.category === "thin" && f.severity === "warning" && f.entityType === entityType
    ).length;
    return { entityType, count: entities.length, orphans, thin };
  });
}

export function buildCrawlMetrics(input: {
  routes: readonly PublicRoute[];
  findings: readonly CrawlFinding[];
  stats: readonly RouteLinkStats[];
}): CrawlMetrics {
  const entities = inventoryEntityRoutes(input.routes);
  const entityStats = input.stats.filter((row) => entities.some((e) => e.key === row.key));
  const avgIn =
    entityStats.length === 0
      ? 0
      : entityStats.reduce((sum, row) => sum + row.inbound, 0) / entityStats.length;
  const avgOut =
    entityStats.length === 0
      ? 0
      : entityStats.reduce((sum, row) => sum + row.outbound, 0) / entityStats.length;

  const orphanCount = countOrphans(input.stats, input.routes);
  const thinPageCount = countThinPages(input.findings);
  const brokenCanonicalCount = countBrokenCanonicals(input.findings);
  const structuredDataCoverage = structuredDataCoverageScore(input.findings);
  const hreflangCoverage = hreflangCoverageScore(input.findings);
  const sitemapCoverage = sitemapCoverageScore(input.findings);
  const breadcrumbCoverage = breadcrumbCoverageScore(input.findings);

  // Internal linking score: penalize orphans and dead-ends
  const deadEnds = entityStats.filter((row) => row.outbound === 0).length;
  const linkPenalty = orphanCount * 8 + deadEnds * 4;
  const internalLinkScore = Math.max(
    0,
    Math.min(100, Math.round(100 - linkPenalty + Math.min(avgIn, 10)))
  );

  const crawlQuality = Math.round(
    (structuredDataCoverage +
      hreflangCoverage +
      sitemapCoverage +
      breadcrumbCoverage +
      internalLinkScore +
      Math.max(0, 100 - brokenCanonicalCount * 2) +
      Math.max(0, 100 - thinPageCount * 3) +
      Math.max(0, 100 - orphanCount * 10)) /
      8
  );

  return {
    indexedEntityCount: entities.filter((e) => e.indexable).length,
    publicRouteCount: input.routes.length,
    averageInboundLinks: Math.round(avgIn * 10) / 10,
    averageOutboundLinks: Math.round(avgOut * 10) / 10,
    orphanCount,
    thinPageCount,
    brokenCanonicalCount,
    structuredDataCoverage,
    internalLinkScore,
    crawlQuality,
    hreflangCoverage,
    sitemapCoverage,
    breadcrumbCoverage,
  };
}

export function reportStatus(
  metrics: CrawlMetrics
): "healthy" | "degraded" | "unhealthy" {
  if (metrics.orphanCount > 0 || metrics.brokenCanonicalCount > 0 || metrics.crawlQuality < 70) {
    return "unhealthy";
  }
  if (metrics.thinPageCount > 5 || metrics.crawlQuality < 90) {
    return "degraded";
  }
  return "healthy";
}

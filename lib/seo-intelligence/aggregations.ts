import type {
  SeoFilters,
  SeoIssue,
  SeoOverview,
  SeoPageType,
  SeoUrlRecord,
} from "./contracts";
import { PAGE_TYPE_CONTRACTS } from "./page-types";
import { countBySeverity, filterIssues, sortIssues } from "./issues";
import { buildSitemapIntelligence } from "./sitemap";
import { auditStructuredDataIntelligence } from "./structured-data";
import { buildInternalLinkIntelligence } from "./internal-links";
import type { SeoAuditSnapshot } from "./queries";

export function filterUrls(
  urls: readonly SeoUrlRecord[],
  filters: SeoFilters
): { total: number; items: SeoUrlRecord[] } {
  let list = [...urls];
  if (filters.pageType !== "all") {
    list = list.filter((u) => u.pageType === filters.pageType);
  }
  if (filters.locale) {
    list = list.filter((u) => u.locale === filters.locale);
  }
  if (filters.indexability !== "all") {
    list = list.filter((u) => u.indexability === filters.indexability);
  }
  if (filters.sitemap === "included") {
    list = list.filter((u) => u.sitemapIncluded);
  }
  if (filters.sitemap === "excluded") {
    list = list.filter((u) => !u.sitemapIncluded);
  }
  if (filters.q) {
    const q = filters.q.toLowerCase();
    list = list.filter(
      (u) =>
        u.path.toLowerCase().includes(q) ||
        u.title.toLowerCase().includes(q) ||
        u.url.toLowerCase().includes(q)
    );
  }
  return {
    total: list.length,
    items: list.slice(filters.offset, filters.offset + filters.limit),
  };
}

export function collectIssues(
  snap: SeoAuditSnapshot,
  extras: SeoIssue[]
): SeoIssue[] {
  const detectedAt = snap.generatedAt;
  const fromUrls: SeoIssue[] = [];
  for (const u of snap.urls) {
    for (const code of u.issueCodes) {
      fromUrls.push({
        code,
        severity:
          code.startsWith("SITEMAP_") || code === "MISSING_CANONICAL"
            ? "CRITICAL"
            : code.includes("ORPHAN")
              ? "HIGH"
              : "MEDIUM",
        pageType: u.pageType,
        url: u.url,
        explanation: `${code} on ${u.path} (${u.indexability})`,
        remediation: remediationFor(code),
        detectedAt,
        status: "open",
      });
    }
    if (u.indexability === "INDEX" && u.contentSignals.length >= 2) {
      fromUrls.push({
        code: "THIN_CONTENT_CANDIDATE",
        severity: "MEDIUM",
        pageType: u.pageType,
        url: u.url,
        explanation: `Thin signals: ${u.contentSignals.join("; ")}`,
        remediation: "Improve factual blocks or set noindex until quality rises",
        detectedAt,
        status: "open",
      });
    }
  }
  return sortIssues([...fromUrls, ...extras]);
}

function remediationFor(code: string): string {
  switch (code) {
    case "SITEMAP_INCLUDES_NON_INDEXABLE":
      return "Remove URL from sitemap generators";
    case "ORPHAN_OR_NEAR_ORPHAN":
      return "Add contextual internal links from hubs/related entities";
    case "DUPLICATE_TITLE":
      return "Make titles entity-unique";
    default:
      return "Review page-type contract and indexability reasons";
  }
}

export function buildOverview(
  snap: SeoAuditSnapshot,
  issues: readonly SeoIssue[],
  sitemapHealth: SeoOverview["sitemapHealth"],
  schemaHealth: SeoOverview["schemaHealth"],
  orphanCount: number
): SeoOverview {
  const counts = {
    INDEX: 0,
    NOINDEX: 0,
    EXCLUDED: 0,
    REDIRECT: 0,
    ERROR: 0,
    REVIEW_REQUIRED: 0,
  };
  for (const u of snap.urls) counts[u.indexability] += 1;
  const sev = countBySeverity(issues);
  const thinPageCount = snap.urls.filter(
    (u) => u.contentSignals.length >= 2
  ).length;
  const stalePageCount = snap.urls.filter(
    (u) => u.reasonCodes.includes("STALE_WITHOUT_ARCHIVE_VALUE")
  ).length;

  return {
    generatedAt: snap.generatedAt,
    ruleVersion: snap.ruleVersion,
    totalUrls: snap.urls.length,
    indexable: counts.INDEX,
    noindex: counts.NOINDEX,
    excluded: counts.EXCLUDED,
    redirects: counts.REDIRECT,
    errors: counts.ERROR,
    reviewRequired: counts.REVIEW_REQUIRED,
    criticalIssues: sev.CRITICAL,
    highIssues: sev.HIGH,
    sitemapHealth,
    schemaHealth,
    orphanCount,
    thinPageCount,
    duplicateMetadataCount: snap.duplicateTitlePaths.length,
    stalePageCount,
    localeIssueCount: 0,
    lastAuditAt: snap.generatedAt,
    notes: [
      "Inventory is bounded (en locale + registry routes + recent archive dates).",
      "Fixture indexability requires match-page load — marked REVIEW_REQUIRED when unloaded.",
      "Hard indexability rules override quality scores.",
      "No fabricated SEO copy or statistics.",
    ],
  };
}

export function buildSeoSectionPayload(
  section: string,
  snap: SeoAuditSnapshot,
  filters: SeoFilters
): Record<string, unknown> {
  const schema = auditStructuredDataIntelligence(snap.generatedAt);
  const links = buildInternalLinkIntelligence(snap.generatedAt);
  const decisions = snap.urls.map((u) => ({
    path: u.path,
    pageType: u.pageType,
    decision: u.indexability,
  }));
  const sitemap = buildSitemapIntelligence(decisions, snap.generatedAt);
  const issues = collectIssues(snap, [
    ...schema.issues,
    ...links.issues,
    ...sitemap.issues,
  ]);

  if (section === "overview") {
    return buildOverview(
      snap,
      issues,
      sitemap.health,
      schema.health,
      links.orphanCount
    ) as unknown as Record<string, unknown>;
  }
  if (section === "urls") {
    const page = filterUrls(snap.urls, filters);
    return {
      generatedAt: snap.generatedAt,
      total: page.total,
      offset: filters.offset,
      limit: filters.limit,
      items: page.items,
    };
  }
  if (section === "page-types") {
    const byType = new Map<SeoPageType, number>();
    for (const u of snap.urls) {
      byType.set(u.pageType, (byType.get(u.pageType) ?? 0) + 1);
    }
    return {
      generatedAt: snap.generatedAt,
      contracts: PAGE_TYPE_CONTRACTS,
      counts: Object.fromEntries(byType),
    };
  }
  if (section === "issues") {
    const page = filterIssues(issues, {
      severity: filters.severity,
      pageType: filters.pageType === "all" ? undefined : filters.pageType,
      q: filters.q,
      offset: filters.offset,
      limit: filters.limit,
    });
    return {
      generatedAt: snap.generatedAt,
      total: page.total,
      severityCounts: countBySeverity(issues),
      items: page.items,
    };
  }
  if (section === "sitemaps") {
    return sitemap as unknown as Record<string, unknown>;
  }
  if (section === "structured-data") {
    return schema as unknown as Record<string, unknown>;
  }
  if (section === "internal-links") {
    return links as unknown as Record<string, unknown>;
  }
  if (section === "content-quality") {
    const thin = snap.urls
      .filter((u) => u.contentSignals.length >= 2)
      .slice(0, filters.limit);
    return {
      generatedAt: snap.generatedAt,
      thinCandidates: thin,
      scoringNote:
        "Scores are explainable component sums; they never override hard noindex rules.",
    };
  }
  return { error: "unknown_section" };
}

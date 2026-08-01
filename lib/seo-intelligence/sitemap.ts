import { expectedSitemapUrls, auditSitemap } from "@/lib/crawl-quality/sitemap";
import { siteUrl } from "@/lib/seo";
import type { IndexabilityDecision, SeoIssue, SeoPageType } from "./contracts";
import { classifyPath } from "./page-types";
import { isSitemapEligible } from "./indexability";

export type SitemapShardSummary = {
  id: string;
  description: string;
};

export type SitemapIntelligence = {
  shards: SitemapShardSummary[];
  urlCount: number;
  localeDistribution: Record<string, number>;
  pageTypeDistribution: Partial<Record<SeoPageType, number>>;
  indexableEligibleCount: number;
  incorrectlyIncluded: string[];
  issues: SeoIssue[];
  health: "healthy" | "degraded" | "unhealthy";
  lastGeneratedNote: string;
};

const SHARDS: SitemapShardSummary[] = [
  { id: "static", description: "Hubs + legal + affiliate (no /combo redirect)" },
  { id: "operators", description: "Operators + reviews" },
  { id: "markets", description: "Market details" },
  { id: "competitions", description: "Competition details" },
  { id: "teams", description: "Team details" },
  { id: "seasons", description: "Season pages" },
  { id: "countries", description: "Indexable country landings only" },
  { id: "compare", description: "Allowlisted compare slugs" },
];

function pathFromAbsolute(url: string): { locale: string; path: string } | null {
  try {
    const base = siteUrl();
    if (!url.startsWith(base)) return null;
    const rest = url.slice(base.length);
    const parts = rest.split("/").filter(Boolean);
    const locale = parts[0] || "en";
    const path = "/" + parts.slice(1).join("/");
    return { locale, path: path === "/" ? "/" : path.replace(/\/$/, "") || "/" };
  } catch {
    return null;
  }
}

export function buildSitemapIntelligence(
  decisions: Array<{
    path: string;
    pageType: SeoPageType;
    decision: IndexabilityDecision;
  }>,
  detectedAt: string
): SitemapIntelligence {
  let urls: string[] = [];
  try {
    urls = expectedSitemapUrls();
  } catch {
    return {
      shards: SHARDS,
      urlCount: 0,
      localeDistribution: {},
      pageTypeDistribution: {},
      indexableEligibleCount: 0,
      incorrectlyIncluded: [],
      issues: [
        {
          code: "SITEMAP_SITE_URL_UNAVAILABLE",
          severity: "CRITICAL",
          pageType: "unknown",
          url: "/",
          explanation: "SITE_URL unavailable; sitemap intelligence skipped",
          remediation: "Set a valid SITE_URL for audit environments",
          detectedAt,
          status: "open",
        },
      ],
      health: "unhealthy",
      lastGeneratedNote: "Unavailable — SITE_URL missing",
    };
  }

  const localeDistribution: Record<string, number> = {};
  const pageTypeDistribution: Partial<Record<SeoPageType, number>> = {};
  const incorrectlyIncluded: string[] = [];
  const decisionByPath = new Map(
    decisions.map((d) => [d.path, d] as const)
  );

  for (const url of urls) {
    const parsed = pathFromAbsolute(url);
    if (!parsed) continue;
    localeDistribution[parsed.locale] =
      (localeDistribution[parsed.locale] ?? 0) + 1;
    const pageType = classifyPath(parsed.path === "" ? "/" : parsed.path);
    pageTypeDistribution[pageType] = (pageTypeDistribution[pageType] ?? 0) + 1;
    const dec = decisionByPath.get(parsed.path === "" ? "/" : parsed.path);
    if (dec && !isSitemapEligible(dec.decision, dec.pageType)) {
      incorrectlyIncluded.push(url);
    }
    if (pageType === "combo_redirect" || pageType === "search") {
      incorrectlyIncluded.push(url);
    }
  }

  const crawlFindings = auditSitemap();
  const issues: SeoIssue[] = [
    ...incorrectlyIncluded.slice(0, 50).map((url) => ({
      code: "SITEMAP_INCLUDES_NON_INDEXABLE",
      severity: "CRITICAL" as const,
      pageType: classifyPath(pathFromAbsolute(url)?.path || "/"),
      url,
      explanation: "Sitemap URL fails indexability/sitemap eligibility rules",
      remediation: "Remove from sitemap generators; keep redirect/noindex out",
      detectedAt,
      status: "open" as const,
    })),
    ...crawlFindings
      .filter((f) => f.severity === "error" || f.severity === "warning")
      .map((f) => ({
        code: "SITEMAP_AUDIT_" + f.severity.toUpperCase(),
        severity:
          f.severity === "error"
            ? ("HIGH" as const)
            : ("MEDIUM" as const),
        pageType: "unknown" as const,
        url: f.id,
        explanation: f.message,
        remediation: "Align app/sitemap.ts with eligibility rules",
        detectedAt,
        status: "open" as const,
      })),
  ];

  const indexableEligibleCount = decisions.filter((d) =>
    isSitemapEligible(d.decision, d.pageType)
  ).length;

  const health =
    incorrectlyIncluded.length > 0 ||
    crawlFindings.some((f) => f.severity === "error")
      ? "unhealthy"
      : crawlFindings.some((f) => f.severity === "warning")
        ? "degraded"
        : "healthy";

  return {
    shards: SHARDS,
    urlCount: urls.length,
    localeDistribution,
    pageTypeDistribution,
    indexableEligibleCount,
    incorrectlyIncluded: incorrectlyIncluded.slice(0, 100),
    issues,
    health,
    lastGeneratedNote:
      "Expected set mirrors app/sitemap.ts (revalidate 3600); not a live fetch",
  };
}

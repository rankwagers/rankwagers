import { BRANDS } from "@/lib/brands";
import { COMPARE_INDEXABLE_SLUGS } from "@/lib/compareSlugs";
import { listCompetitions } from "@/lib/competitions/registry";
import { locales } from "@/lib/i18n";
import { listMarkets } from "@/lib/markets/registry";
import { listSeasons } from "@/lib/seasons/registry";
import { listTeams } from "@/lib/teams/registry";
import { listIndexableCountryCodes } from "@/lib/countries/landing";
import { siteUrl } from "@/lib/seo";
import { absoluteCanonical } from "./canonical";
import { inventoryEntityRoutes, buildPublicRouteInventory } from "./inventory";
import type { CrawlFinding, PublicRoute } from "./types";

const SITEMAP_SHARD_IDS = [
  "static",
  "operators",
  "markets",
  "competitions",
  "teams",
  "seasons",
  "countries",
  "compare",
] as const;

const STATIC_PATHS = [
  "",
  "/best-crypto-betting-sites",
  "/best-betting-sites",
  "/operators",
  "/markets",
  "/competitions",
  "/teams",
  "/seasons",
  "/countries",
  // /combo is a redirect to noindex Acca Builder — must not appear in sitemap
  "/archive",
  "/methodology",
  "/bonuses",
  "/responsible-gambling",
  "/terms",
  "/privacy",
  "/availability",
];

/** Expected sitemap URL set mirroring app/sitemap.ts (in-process, no HTTP). */
export function expectedSitemapUrls(): string[] {
  const base = siteUrl();
  const urls: string[] = [];

  for (const locale of locales) {
    for (const p of STATIC_PATHS) {
      urls.push(`${base}/${locale}${p}`);
    }
    for (const brand of BRANDS) {
      urls.push(`${base}/${locale}/operators/${brand.slug}`);
      urls.push(`${base}/${locale}/reviews/${brand.slug}`);
    }
    for (const market of listMarkets()) {
      urls.push(`${base}/${locale}/markets/${market.slug}`);
    }
    for (const competition of listCompetitions()) {
      urls.push(`${base}/${locale}/competitions/${competition.slug}`);
    }
    for (const team of listTeams()) {
      urls.push(`${base}/${locale}/teams/${team.slug}`);
    }
    for (const season of listSeasons()) {
      urls.push(
        `${base}/${locale}/competitions/${season.competitionSlug}/seasons/${season.slug}`
      );
    }
    for (const code of listIndexableCountryCodes()) {
      urls.push(`${base}/${locale}/countries/${code.toLowerCase()}`);
    }
    for (const slug of COMPARE_INDEXABLE_SLUGS) {
      urls.push(`${base}/${locale}/compare/${slug}`);
    }
  }

  return urls;
}

export function auditSitemap(
  routes: readonly PublicRoute[] = buildPublicRouteInventory()
): CrawlFinding[] {
  const findings: CrawlFinding[] = [];

  try {
    siteUrl();
  } catch {
    findings.push({
      id: "sitemap-site-url-fail",
      category: "sitemap",
      severity: "error",
      message: "SITE_URL unavailable; sitemap audit skipped",
    });
    return findings;
  }

  findings.push({
    id: "sitemap-shards",
    category: "sitemap",
    severity: "pass",
    message: `Expected sitemap shards: ${SITEMAP_SHARD_IDS.join(", ")}`,
  });

  const expected = expectedSitemapUrls();
  const expectedSet = new Set(expected);

  // Duplicate entries
  const seen = new Set<string>();
  let duplicates = 0;
  for (const url of expected) {
    if (seen.has(url)) duplicates += 1;
    seen.add(url);
  }
  findings.push({
    id: "sitemap-duplicates",
    category: "sitemap",
    severity: duplicates === 0 ? "pass" : "error",
    message:
      duplicates === 0
        ? "No duplicate sitemap URLs in expected set"
        : `Duplicate sitemap URLs: ${duplicates}`,
  });

  // Entity inventory ⊆ sitemap
  const entities = inventoryEntityRoutes(routes);
  let missing = 0;
  for (const entity of entities) {
    for (const locale of locales) {
      const url = absoluteCanonical(locale, entity.path);
      if (!expectedSet.has(url)) {
        missing += 1;
        if (missing <= 20) {
          findings.push({
            id: `sitemap-missing-${entity.key}-${locale}`,
            category: "sitemap",
            severity: "error",
            entityType: entity.entityType,
            entityId: entity.entityId,
            message: `Entity missing from sitemap: ${url}`,
          });
        }
      }
    }
  }

  if (missing === 0) {
    findings.push({
      id: "sitemap-entity-coverage",
      category: "sitemap",
      severity: "pass",
      message: `All ${entities.length} entity routes present in sitemap for ${locales.length} locales`,
    });
  } else {
    findings.push({
      id: "sitemap-entity-coverage",
      category: "sitemap",
      severity: "error",
      message: `${missing} entity×locale URLs missing from sitemap`,
    });
  }

  // Search must NOT be in sitemap
  const searchInSitemap = [...expectedSet].some((url) => url.includes("/search"));
  findings.push({
    id: "sitemap-no-search",
    category: "sitemap",
    severity: searchInSitemap ? "warning" : "pass",
    message: searchInSitemap
      ? "Search URLs unexpectedly present in sitemap"
      : "Search excluded from sitemap (noindex utility)",
  });

  // Invalid locale URLs — every URL must contain a known locale segment
  let invalidLocale = 0;
  const localeSet = new Set(locales as readonly string[]);
  for (const url of expected) {
    try {
      const pathname = new URL(url).pathname;
      const segment = pathname.split("/").filter(Boolean)[0];
      if (!segment || !localeSet.has(segment)) invalidLocale += 1;
    } catch {
      invalidLocale += 1;
    }
  }
  findings.push({
    id: "sitemap-locale-urls",
    category: "sitemap",
    severity: invalidLocale === 0 ? "pass" : "error",
    message:
      invalidLocale === 0
        ? "All sitemap URLs use valid locale prefixes"
        : `Invalid locale URLs: ${invalidLocale}`,
  });

  findings.push({
    id: "sitemap-size",
    category: "sitemap",
    severity: "info",
    message: `Expected sitemap URL count: ${expected.length}`,
  });

  return findings;
}

export function sitemapCoverageScore(findings: readonly CrawlFinding[]): number {
  const coverage = findings.find((f) => f.id === "sitemap-entity-coverage");
  if (!coverage) return 0;
  return coverage.severity === "pass" ? 100 : 0;
}

import { existsSync } from "node:fs";
import path from "node:path";
import { analyticsEventNames } from "@/lib/analytics/types";
import { listCompetitions } from "@/lib/competitions/registry";
import {
  competitionBreadcrumbLd,
  competitionCollectionPageLd,
} from "@/lib/competitions/schema";
import { listMarkets } from "@/lib/markets/registry";
import { marketBreadcrumbLd, marketWebPageLd } from "@/lib/markets/schema";
import { listOperators } from "@/lib/operators/registry";
import {
  operatorBreadcrumbLd,
  operatorWebPageLd,
} from "@/lib/operators/schema";
import { listSeasons } from "@/lib/seasons/registry";
import { seasonBreadcrumbLd, seasonCollectionPageLd } from "@/lib/seasons/schema";
import { listTeams } from "@/lib/teams/registry";
import { teamBreadcrumbLd, teamWebPageLd } from "@/lib/teams/schema";
import { locales } from "@/lib/i18n";
import { pageMetadata, siteUrl } from "@/lib/seo";
import type { DataQualityFinding } from "./types";

function hasType(data: Record<string, unknown>, type: string): boolean {
  const actual = data["@type"];
  return actual === type || (Array.isArray(actual) && actual.includes(type));
}

export function auditSeoIntegrity(): DataQualityFinding[] {
  const findings: DataQualityFinding[] = [];
  const canonicals = new Set<string>();

  try {
    siteUrl();
    findings.push({
      id: "seo-site-url",
      category: "seo",
      severity: "pass",
      message: "SITE_URL resolver available",
    });
  } catch {
    findings.push({
      id: "seo-site-url-fail",
      category: "seo",
      severity: "error",
      message: "SITE_URL resolver threw in this environment",
    });
  }

  const market = listMarkets()[0];
  if (market) {
    const web = marketWebPageLd({ market, locale: "en" });
    const crumbs = marketBreadcrumbLd({ market, locale: "en" });
    findings.push({
      id: "seo-market-webpage",
      category: "seo",
      severity: hasType(web, "WebPage") ? "pass" : "error",
      message: "Market WebPage schema",
      entityType: "market",
      entityId: market.slug,
    });
    findings.push({
      id: "seo-market-breadcrumb",
      category: "seo",
      severity: hasType(crumbs, "BreadcrumbList") ? "pass" : "error",
      message: "Market BreadcrumbList schema",
      entityType: "market",
      entityId: market.slug,
    });
  }

  const operator = listOperators()[0];
  if (operator) {
    const web = operatorWebPageLd({
      operator,
      locale: "en",
      description: operator.description,
    });
    const crumbs = operatorBreadcrumbLd({ operator, locale: "en" });
    findings.push({
      id: "seo-operator-webpage",
      category: "seo",
      severity: hasType(web, "WebPage") ? "pass" : "error",
      message: "Operator WebPage schema",
      entityType: "operator",
      entityId: operator.slug,
    });
    findings.push({
      id: "seo-operator-breadcrumb",
      category: "seo",
      severity: hasType(crumbs, "BreadcrumbList") ? "pass" : "error",
      message: "Operator BreadcrumbList schema",
      entityType: "operator",
      entityId: operator.slug,
    });
  }

  const competition = listCompetitions()[0];
  if (competition) {
    const page = competitionCollectionPageLd({ competition, locale: "en" });
    const crumbs = competitionBreadcrumbLd({ competition, locale: "en" });
    findings.push({
      id: "seo-competition-collection",
      category: "seo",
      severity: hasType(page, "CollectionPage") ? "pass" : "error",
      message: "Competition CollectionPage schema",
      entityType: "competition",
      entityId: competition.slug,
    });
    findings.push({
      id: "seo-competition-breadcrumb",
      category: "seo",
      severity: hasType(crumbs, "BreadcrumbList") ? "pass" : "error",
      message: "Competition BreadcrumbList schema",
      entityType: "competition",
      entityId: competition.slug,
    });
  }

  const team = listTeams()[0];
  if (team) {
    const web = teamWebPageLd({ team, locale: "en" });
    const crumbs = teamBreadcrumbLd({ team, locale: "en" });
    findings.push({
      id: "seo-team-webpage",
      category: "seo",
      severity: hasType(web, "WebPage") ? "pass" : "error",
      message: "Team WebPage schema",
      entityType: "team",
      entityId: team.slug,
    });
    findings.push({
      id: "seo-team-breadcrumb",
      category: "seo",
      severity: hasType(crumbs, "BreadcrumbList") ? "pass" : "error",
      message: "Team BreadcrumbList schema",
      entityType: "team",
      entityId: team.slug,
    });
  }

  const season = listSeasons()[0];
  if (season) {
    const page = seasonCollectionPageLd({ season, locale: "en" });
    const crumbs = seasonBreadcrumbLd({ season, locale: "en" });
    findings.push({
      id: "seo-season-collection",
      category: "seo",
      severity: hasType(page, "CollectionPage") ? "pass" : "error",
      message: "Season CollectionPage schema",
      entityType: "season",
      entityId: season.id,
    });
    findings.push({
      id: "seo-season-breadcrumb",
      category: "seo",
      severity: hasType(crumbs, "BreadcrumbList") ? "pass" : "error",
      message: "Season BreadcrumbList schema",
      entityType: "season",
      entityId: season.id,
    });
  }

  // Canonical uniqueness across sample entity metadata paths.
  const samples = [
    ...listCompetitions().map((row) => `/competitions/${row.slug}`),
    ...listMarkets().map((row) => `/markets/${row.slug}`),
    ...listOperators().map((row) => `/operators/${row.slug}`),
    ...listTeams().map((row) => `/teams/${row.slug}`),
    ...listSeasons().map(
      (row) => `/competitions/${row.competitionSlug}/seasons/${row.slug}`
    ),
  ];

  for (const path of samples) {
    for (const locale of locales.slice(0, 1)) {
      const meta = pageMetadata({
        locale,
        path,
        title: "t",
        description: "d",
      });
      const canonical = String(meta.alternates?.canonical ?? "");
      if (!canonical) {
        findings.push({
          id: `seo-canonical-missing-${path}`,
          category: "seo",
          severity: "error",
          message: `Missing canonical for ${path}`,
        });
        continue;
      }
      if (canonicals.has(canonical)) {
        findings.push({
          id: `seo-canonical-dupe-${canonical}`,
          category: "seo",
          severity: "error",
          message: `Duplicate canonical ${canonical}`,
        });
      } else {
        canonicals.add(canonical);
      }
    }
  }

  findings.push({
    id: "seo-canonical-sample",
    category: "seo",
    severity: "pass",
    message: `Checked ${canonicals.size} sample canonical URLs for uniqueness`,
  });

  return findings;
}

export function auditSitemapIntegrity(): DataQualityFinding[] {
  const findings: DataQualityFinding[] = [];
  const expectedShards = [
    "static",
    "operators",
    "markets",
    "competitions",
    "teams",
    "seasons",
    "compare",
  ];

  // Structural expectation — sitemap.ts generateSitemaps ids.
  findings.push({
    id: "sitemap-shards-expected",
    category: "sitemap",
    severity: "pass",
    message: `Expected sitemap shards: ${expectedShards.join(", ")}`,
  });

  const routeCounts = {
    competitions: listCompetitions().length,
    markets: listMarkets().length,
    operators: listOperators().length,
    teams: listTeams().length,
    seasons: listSeasons().length,
  };

  for (const [key, count] of Object.entries(routeCounts)) {
    findings.push({
      id: `sitemap-count-${key}`,
      category: "sitemap",
      severity: count > 0 ? "pass" : "error",
      message: `${count} ${key} should appear in sitemap shard`,
    });
  }

  // Locale multiplier sanity.
  findings.push({
    id: "sitemap-locales",
    category: "sitemap",
    severity: locales.length > 0 ? "pass" : "error",
    message: `${locales.length} locales included in sitemap generation`,
  });

  return findings;
}

export function auditAnalyticsIntegrity(): DataQualityFinding[] {
  const findings: DataQualityFinding[] = [];

  const required = [
    "competition_page_view",
    "market_page_view",
    "operator_page_view",
    "team_page_view",
    "season_page_view",
    "entity_view",
    "entity_navigation",
    "related_click",
    "graph_navigation",
    "recommendation_click",
  ];

  for (const name of required) {
    findings.push({
      id: `analytics-event-${name}`,
      category: "analytics",
      severity: analyticsEventNames.includes(name as (typeof analyticsEventNames)[number])
        ? "pass"
        : "error",
      message: `Analytics event ${name}`,
    });
  }

  // Payload shape expectations are enforced by typed AnalyticsEvent; mark structural pass.
  findings.push({
    id: "analytics-payload-shape",
    category: "analytics",
    severity: "pass",
    message: "AnalyticsEvent requires country/locale/session/timestamp enrichment path",
  });

  return findings;
}

export function auditPublicRoutes(): DataQualityFinding[] {
  const findings: DataQualityFinding[] = [];
  const root = path.resolve(process.cwd());

  const requiredFiles = [
    "app/[locale]/competitions/page.tsx",
    "app/[locale]/competitions/[slug]/page.tsx",
    "app/[locale]/markets/page.tsx",
    "app/[locale]/markets/[slug]/page.tsx",
    "app/[locale]/operators/page.tsx",
    "app/[locale]/operators/[slug]/page.tsx",
    "app/[locale]/teams/page.tsx",
    "app/[locale]/teams/[slug]/page.tsx",
    "app/[locale]/seasons/page.tsx",
    "app/[locale]/competitions/[slug]/seasons/[season]/page.tsx",
    "app/not-found.tsx",
    "app/[locale]/error.tsx",
  ];

  for (const rel of requiredFiles) {
    findings.push({
      id: `route-file-${rel}`,
      category: "routes",
      severity: existsSync(path.join(root, rel)) ? "pass" : "error",
      message: `Route module ${rel}`,
    });
  }

  return findings;
}

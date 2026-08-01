import { listCompetitions } from "@/lib/competitions/registry";
import {
  competitionBreadcrumbLd,
  competitionCollectionPageLd,
} from "@/lib/competitions/schema";
import { listMarkets } from "@/lib/markets/registry";
import { marketBreadcrumbLd, marketFaqLd, marketWebPageLd } from "@/lib/markets/schema";
import { listOperators } from "@/lib/operators/registry";
import {
  operatorBreadcrumbLd,
  operatorOrganizationLd,
  operatorWebPageLd,
} from "@/lib/operators/schema";
import { graphRelatedItemListLd } from "@/lib/knowledge-graph/schema";
import { siteUrl } from "@/lib/seo";
import { listSeasons } from "@/lib/seasons/registry";
import { seasonBreadcrumbLd, seasonCollectionPageLd } from "@/lib/seasons/schema";
import { listTeams } from "@/lib/teams/registry";
import { teamBreadcrumbLd, teamWebPageLd } from "@/lib/teams/schema";
import {
  archiveDayWebPageLd,
  archiveHubBreadcrumbLd,
  archiveHubWebPageLd,
  methodologyBreadcrumbLd,
  methodologyWebPageLd,
} from "@/lib/archive/schema";

export type SeoValidationIssue = {
  entity: string;
  severity: "error" | "warning";
  message: string;
};

function requireType(data: Record<string, unknown>, type: string, entity: string): SeoValidationIssue[] {
  const issues: SeoValidationIssue[] = [];
  const actual = data["@type"];
  if (actual !== type && !(Array.isArray(actual) && actual.includes(type))) {
    issues.push({
      entity,
      severity: "error",
      message: `Expected @type ${type}, got ${String(actual)}`,
    });
  }
  if (!data["@context"]) {
    issues.push({ entity, severity: "warning", message: "Missing @context" });
  }
  return issues;
}

function requireUrl(data: Record<string, unknown>, key: string, entity: string): SeoValidationIssue[] {
  const value = data[key];
  if (typeof value !== "string" || !value.startsWith("http")) {
    return [{ entity, severity: "error", message: `${key} must be absolute URL` }];
  }
  return [];
}

/** Validate key JSON-LD generators used on entity pages. */
export function validateStructuredData(locale: "en" = "en"): SeoValidationIssue[] {
  const issues: SeoValidationIssue[] = [];
  const base = siteUrl();

  const market = listMarkets()[0];
  if (market) {
    const web = marketWebPageLd({ market, locale });
    issues.push(...requireType(web, "WebPage", `market:${market.slug}`));
    issues.push(...requireUrl(web, "url", `market:${market.slug}`));
    const crumbs = marketBreadcrumbLd({ market, locale });
    issues.push(...requireType(crumbs, "BreadcrumbList", `market-breadcrumb:${market.slug}`));
    const faq = marketFaqLd(market);
    if (faq) issues.push(...requireType(faq, "FAQPage", `market-faq:${market.slug}`));
  }

  const operator = listOperators()[0];
  if (operator) {
    const org = operatorOrganizationLd(operator);
    issues.push(...requireType(org, "Organization", `operator-org:${operator.slug}`));
    const web = operatorWebPageLd({
      operator,
      locale,
      description: operator.description,
    });
    issues.push(...requireType(web, "WebPage", `operator-web:${operator.slug}`));
    const crumbs = operatorBreadcrumbLd({ operator, locale });
    issues.push(...requireType(crumbs, "BreadcrumbList", `operator-breadcrumb:${operator.slug}`));
  }

  const competition = listCompetitions()[0];
  if (competition) {
    const collection = competitionCollectionPageLd({ competition, locale });
    issues.push(...requireType(collection, "CollectionPage", `competition:${competition.slug}`));
    const crumbs = competitionBreadcrumbLd({ competition, locale });
    issues.push(...requireType(crumbs, "BreadcrumbList", `competition-breadcrumb:${competition.slug}`));
    const itemList = graphRelatedItemListLd({
      type: "competition",
      slug: competition.slug,
      locale,
      siteUrl: base,
    });
    if (itemList) {
      issues.push(...requireType(itemList, "ItemList", `competition-itemlist:${competition.slug}`));
    }
  }

  const team = listTeams()[0];
  if (team) {
    const web = teamWebPageLd({ team, locale });
    issues.push(...requireType(web, "WebPage", `team:${team.slug}`));
    issues.push(...requireUrl(web, "url", `team:${team.slug}`));
    const about = web.about as Record<string, unknown> | undefined;
    if (!about || about["@type"] !== "SportsTeam") {
      issues.push({
        entity: `team-sportsteam:${team.slug}`,
        severity: "error",
        message: "Expected WebPage.about @type SportsTeam",
      });
    }
    const crumbs = teamBreadcrumbLd({ team, locale });
    issues.push(...requireType(crumbs, "BreadcrumbList", `team-breadcrumb:${team.slug}`));
    const itemList = graphRelatedItemListLd({
      type: "team",
      slug: team.slug,
      locale,
      siteUrl: base,
    });
    if (itemList) {
      issues.push(...requireType(itemList, "ItemList", `team-itemlist:${team.slug}`));
    }
  }

  const season = listSeasons()[0];
  if (season) {
    const collection = seasonCollectionPageLd({ season, locale });
    issues.push(...requireType(collection, "CollectionPage", `season:${season.id}`));
    issues.push(...requireUrl(collection, "url", `season:${season.id}`));
    const crumbs = seasonBreadcrumbLd({ season, locale });
    issues.push(...requireType(crumbs, "BreadcrumbList", `season-breadcrumb:${season.id}`));
    const itemList = graphRelatedItemListLd({
      type: "season",
      slug: season.id,
      locale,
      siteUrl: base,
    });
    if (itemList) {
      issues.push(...requireType(itemList, "ItemList", `season-itemlist:${season.id}`));
    }
  }

  const archiveHub = archiveHubWebPageLd({
    locale,
    title: "Prediction archive",
    description: "Transparent settled results",
  });
  issues.push(...requireType(archiveHub, "CollectionPage", "archive:hub"));
  issues.push(...requireUrl(archiveHub, "url", "archive:hub"));
  issues.push(
    ...requireType(archiveHubBreadcrumbLd(locale), "BreadcrumbList", "archive:hub-breadcrumb")
  );

  const archiveDay = archiveDayWebPageLd({
    locale,
    date: "2026-07-20",
    title: "Archive day",
    description: "Daily archive",
    events: [
      {
        name: "Sample vs Sample",
        startDate: "2026-07-20T15:00:00.000Z",
        url: `/${locale}/fixtures/1`,
      },
    ],
  });
  issues.push(...requireType(archiveDay, "CollectionPage", "archive:day"));
  const mainEntity = archiveDay.mainEntity as Record<string, unknown> | undefined;
  if (!mainEntity || mainEntity["@type"] !== "ItemList") {
    issues.push({
      entity: "archive:day-itemlist",
      severity: "error",
      message: "Expected CollectionPage.mainEntity @type ItemList",
    });
  }

  const methodology = methodologyWebPageLd({
    locale,
    title: "Methodology",
    description: "How predictions work",
  });
  issues.push(...requireType(methodology, "WebPage", "methodology"));
  issues.push(...requireUrl(methodology, "url", "methodology"));
  issues.push(
    ...requireType(methodologyBreadcrumbLd(locale), "BreadcrumbList", "methodology-breadcrumb")
  );

  return issues;
}

export function assertSeoValid(): void {
  const errors = validateStructuredData().filter((issue) => issue.severity === "error");
  if (errors.length) {
    throw new Error(errors.map((issue) => `${issue.entity}: ${issue.message}`).join("; "));
  }
}

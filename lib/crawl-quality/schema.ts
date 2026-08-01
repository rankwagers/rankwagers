import { listCompetitions } from "@/lib/competitions/registry";
import {
  competitionBreadcrumbLd,
  competitionCollectionPageLd,
  competitionSportsOrganizationLd,
} from "@/lib/competitions/schema";
import { listMarkets } from "@/lib/markets/registry";
import { marketBreadcrumbLd, marketWebPageLd } from "@/lib/markets/schema";
import { listOperators } from "@/lib/operators/registry";
import { operatorBreadcrumbLd, operatorWebPageLd } from "@/lib/operators/schema";
import { listSeasons } from "@/lib/seasons/registry";
import { seasonBreadcrumbLd, seasonCollectionPageLd } from "@/lib/seasons/schema";
import { listTeams } from "@/lib/teams/registry";
import { teamBreadcrumbLd, teamSportsTeamLd, teamWebPageLd } from "@/lib/teams/schema";
import { buildCountryLanding, listIndexableCountryCodes } from "@/lib/countries/landing";
import {
  countryLandingBreadcrumbLd,
  countryLandingWebPageLd,
} from "@/lib/countries/schema";
import type { CrawlFinding } from "./types";

function hasType(data: Record<string, unknown>, type: string): boolean {
  const actual = data["@type"];
  return actual === type || (Array.isArray(actual) && actual.includes(type));
}

function pushSchemaFinding(
  findings: CrawlFinding[],
  id: string,
  ok: boolean,
  entityType: string,
  entityId: string,
  expected: string
): void {
  findings.push({
    id,
    category: "schema",
    severity: ok ? "pass" : "error",
    entityType,
    entityId,
    message: ok
      ? `${expected} present for ${entityType}:${entityId}`
      : `Missing or invalid ${expected} for ${entityType}:${entityId}`,
  });
}

export function auditStructuredData(): CrawlFinding[] {
  const findings: CrawlFinding[] = [];
  let checked = 0;
  let passed = 0;

  for (const competition of listCompetitions()) {
    const page = competitionCollectionPageLd({ competition, locale: "en" });
    const crumbs = competitionBreadcrumbLd({ competition, locale: "en" });
    const org = competitionSportsOrganizationLd(competition);
    const checks = [
      ["CollectionPage", hasType(page, "CollectionPage")],
      ["BreadcrumbList", hasType(crumbs, "BreadcrumbList")],
      ["SportsOrganization", hasType(org, "SportsOrganization")],
    ] as const;
    for (const [type, ok] of checks) {
      checked += 1;
      if (ok) passed += 1;
      pushSchemaFinding(
        findings,
        `schema-competition-${competition.slug}-${type}`,
        ok,
        "competition",
        competition.slug,
        type
      );
    }
  }

  for (const season of listSeasons()) {
    const page = seasonCollectionPageLd({ season, locale: "en" });
    const crumbs = seasonBreadcrumbLd({ season, locale: "en" });
    const checks = [
      ["CollectionPage", hasType(page, "CollectionPage")],
      ["BreadcrumbList", hasType(crumbs, "BreadcrumbList")],
    ] as const;
    for (const [type, ok] of checks) {
      checked += 1;
      if (ok) passed += 1;
      pushSchemaFinding(
        findings,
        `schema-season-${season.id}-${type}`,
        ok,
        "season",
        season.id,
        type
      );
    }
  }

  for (const team of listTeams()) {
    const page = teamWebPageLd({ team, locale: "en" });
    const crumbs = teamBreadcrumbLd({ team, locale: "en" });
    const sportsTeam = teamSportsTeamLd(team);
    const checks = [
      ["WebPage", hasType(page, "WebPage")],
      ["BreadcrumbList", hasType(crumbs, "BreadcrumbList")],
      ["SportsTeam", hasType(sportsTeam, "SportsTeam")],
    ] as const;
    for (const [type, ok] of checks) {
      checked += 1;
      if (ok) passed += 1;
      pushSchemaFinding(
        findings,
        `schema-team-${team.slug}-${type}`,
        ok,
        "team",
        team.slug,
        type
      );
    }
  }

  for (const market of listMarkets()) {
    const page = marketWebPageLd({ market, locale: "en" });
    const crumbs = marketBreadcrumbLd({ market, locale: "en" });
    const checks = [
      ["WebPage", hasType(page, "WebPage")],
      ["BreadcrumbList", hasType(crumbs, "BreadcrumbList")],
    ] as const;
    for (const [type, ok] of checks) {
      checked += 1;
      if (ok) passed += 1;
      pushSchemaFinding(
        findings,
        `schema-market-${market.slug}-${type}`,
        ok,
        "market",
        market.slug,
        type
      );
    }
  }

  for (const operator of listOperators()) {
    const page = operatorWebPageLd({
      operator,
      locale: "en",
      description: operator.description,
    });
    const crumbs = operatorBreadcrumbLd({ operator, locale: "en" });
    const checks = [
      ["WebPage", hasType(page, "WebPage")],
      ["BreadcrumbList", hasType(crumbs, "BreadcrumbList")],
    ] as const;
    for (const [type, ok] of checks) {
      checked += 1;
      if (ok) passed += 1;
      pushSchemaFinding(
        findings,
        `schema-operator-${operator.slug}-${type}`,
        ok,
        "operator",
        operator.slug,
        type
      );
    }
  }

  for (const code of listIndexableCountryCodes()) {
    const model = buildCountryLanding("en", code);
    if (!model) continue;
    const page = countryLandingWebPageLd({ locale: "en", model });
    const crumbs = countryLandingBreadcrumbLd({ locale: "en", model });
    const checks = [
      ["WebPage", hasType(page, "WebPage")],
      ["BreadcrumbList", hasType(crumbs, "BreadcrumbList")],
    ] as const;
    for (const [type, ok] of checks) {
      checked += 1;
      if (ok) passed += 1;
      pushSchemaFinding(
        findings,
        `schema-country-${code.toLowerCase()}-${type}`,
        ok,
        "country",
        code.toLowerCase(),
        type
      );
    }
  }

  const coverage = checked ? Math.round((passed / checked) * 1000) / 10 : 100;
  findings.push({
    id: "schema-coverage",
    category: "schema",
    severity: coverage >= 99 ? "pass" : coverage >= 90 ? "warning" : "error",
    message: `Structured data coverage ${coverage}% (${passed}/${checked})`,
  });

  return findings;
}

export function structuredDataCoverageScore(findings: readonly CrawlFinding[]): number {
  const row = findings.find((f) => f.id === "schema-coverage");
  if (!row) return 0;
  const match = row.message.match(/([\d.]+)%/);
  return match ? Number(match[1]) : 0;
}

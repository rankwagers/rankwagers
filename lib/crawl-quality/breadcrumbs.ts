import { listCompetitions } from "@/lib/competitions/registry";
import { competitionBreadcrumbLd } from "@/lib/competitions/schema";
import { listMarkets } from "@/lib/markets/registry";
import { marketBreadcrumbLd } from "@/lib/markets/schema";
import { listOperators } from "@/lib/operators/registry";
import { operatorBreadcrumbLd } from "@/lib/operators/schema";
import { listSeasons } from "@/lib/seasons/registry";
import { seasonBreadcrumbLd } from "@/lib/seasons/schema";
import { listTeams } from "@/lib/teams/registry";
import { teamBreadcrumbLd } from "@/lib/teams/schema";
import {
  buildCountryLanding,
  listIndexableCountryCodes,
} from "@/lib/countries/landing";
import { countryLandingBreadcrumbLd } from "@/lib/countries/schema";
import { buildEntityNavigation } from "@/lib/knowledge-graph/navigation";
import type { CrawlFinding } from "./types";

function hasType(data: Record<string, unknown>, type: string): boolean {
  const actual = data["@type"];
  return actual === type || (Array.isArray(actual) && actual.includes(type));
}

function listItems(data: Record<string, unknown>): unknown[] {
  const raw = data.itemListElement;
  return Array.isArray(raw) ? raw : [];
}

export function auditBreadcrumbs(): CrawlFinding[] {
  const findings: CrawlFinding[] = [];
  let ok = 0;
  let fail = 0;

  for (const competition of listCompetitions()) {
    const ld = competitionBreadcrumbLd({ competition, locale: "en" });
    const nav = buildEntityNavigation("competition", competition.slug, "en");
    const items = listItems(ld);
    const valid =
      hasType(ld, "BreadcrumbList") &&
      items.length >= 3 &&
      !!nav &&
      nav.breadcrumbs.length >= 3;
    if (valid) ok += 1;
    else {
      fail += 1;
      findings.push({
        id: `breadcrumb-competition-${competition.slug}`,
        category: "breadcrumbs",
        severity: "error",
        entityType: "competition",
        entityId: competition.slug,
        message: "Competition breadcrumb hierarchy incomplete",
      });
    }
  }

  for (const season of listSeasons()) {
    const ld = seasonBreadcrumbLd({ season, locale: "en" });
    const nav = buildEntityNavigation("season", season.id, "en");
    const items = listItems(ld);
    // Competition → Season chain (season LD typically includes parent competition)
    const valid =
      hasType(ld, "BreadcrumbList") &&
      items.length >= 3 &&
      !!nav &&
      nav.breadcrumbs.length >= 3;
    if (valid) ok += 1;
    else {
      fail += 1;
      findings.push({
        id: `breadcrumb-season-${season.id}`,
        category: "breadcrumbs",
        severity: "error",
        entityType: "season",
        entityId: season.id,
        message: "Season breadcrumb hierarchy incomplete",
      });
    }
  }

  for (const team of listTeams()) {
    const ld = teamBreadcrumbLd({ team, locale: "en" });
    const nav = buildEntityNavigation("team", team.slug, "en");
    const items = listItems(ld);
    const valid =
      hasType(ld, "BreadcrumbList") &&
      items.length >= 3 &&
      !!nav &&
      nav.breadcrumbs.length >= 3;
    if (valid) ok += 1;
    else {
      fail += 1;
      findings.push({
        id: `breadcrumb-team-${team.slug}`,
        category: "breadcrumbs",
        severity: "error",
        entityType: "team",
        entityId: team.slug,
        message: "Team breadcrumb hierarchy incomplete",
      });
    }
  }

  for (const market of listMarkets()) {
    const ld = marketBreadcrumbLd({ market, locale: "en" });
    const nav = buildEntityNavigation("market", market.slug, "en");
    const items = listItems(ld);
    const valid =
      hasType(ld, "BreadcrumbList") &&
      items.length >= 3 &&
      !!nav &&
      nav.breadcrumbs.length >= 3;
    if (valid) ok += 1;
    else {
      fail += 1;
      findings.push({
        id: `breadcrumb-market-${market.slug}`,
        category: "breadcrumbs",
        severity: "error",
        entityType: "market",
        entityId: market.slug,
        message: "Market breadcrumb hierarchy incomplete",
      });
    }
  }

  for (const operator of listOperators()) {
    const ld = operatorBreadcrumbLd({ operator, locale: "en" });
    const nav = buildEntityNavigation("operator", operator.slug, "en");
    const items = listItems(ld);
    const valid =
      hasType(ld, "BreadcrumbList") &&
      items.length >= 3 &&
      !!nav &&
      nav.breadcrumbs.length >= 3;
    if (valid) ok += 1;
    else {
      fail += 1;
      findings.push({
        id: `breadcrumb-operator-${operator.slug}`,
        category: "breadcrumbs",
        severity: "error",
        entityType: "operator",
        entityId: operator.slug,
        message: "Operator breadcrumb hierarchy incomplete",
      });
    }
  }

  for (const code of listIndexableCountryCodes()) {
    const model = buildCountryLanding("en", code);
    if (!model) continue;
    const ld = countryLandingBreadcrumbLd({ locale: "en", model });
    const nav = buildEntityNavigation("country", code, "en");
    const items = listItems(ld);
    const valid =
      hasType(ld, "BreadcrumbList") &&
      items.length >= 3 &&
      !!nav &&
      nav.breadcrumbs.length >= 3;
    if (valid) ok += 1;
    else {
      fail += 1;
      findings.push({
        id: `breadcrumb-country-${code.toLowerCase()}`,
        category: "breadcrumbs",
        severity: "error",
        entityType: "country",
        entityId: code.toLowerCase(),
        message: "Country breadcrumb hierarchy incomplete",
      });
    }
  }

  findings.push({
    id: "breadcrumb-coverage",
    category: "breadcrumbs",
    severity: fail === 0 ? "pass" : "error",
    message: `Breadcrumb coverage: ${ok} ok, ${fail} failed`,
  });

  return findings;
}

export function breadcrumbCoverageScore(findings: readonly CrawlFinding[]): number {
  const coverage = findings.find((f) => f.id === "breadcrumb-coverage");
  if (!coverage) return 0;
  const match = coverage.message.match(/(\d+) ok, (\d+) failed/);
  if (!match) return coverage.severity === "pass" ? 100 : 0;
  const ok = Number(match[1]);
  const fail = Number(match[2]);
  const total = ok + fail;
  if (!total) return 100;
  return Math.round((ok / total) * 100);
}

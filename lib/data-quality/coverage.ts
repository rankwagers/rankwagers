import { listCompetitions } from "@/lib/competitions/registry";
import { getKnowledgeGraph, resetKnowledgeGraphCache } from "@/lib/knowledge-graph/graph";
import { listMarkets } from "@/lib/markets/registry";
import { listOperators } from "@/lib/operators/registry";
import { COUNTRY_PROFILES } from "@/lib/personalization/countries";
import { listSeasons } from "@/lib/seasons/registry";
import { listTeams } from "@/lib/teams/registry";
import { locales } from "@/lib/i18n";
import type { CoverageMetrics, DataQualityFinding } from "./types";

export function buildCoverageMetrics(): CoverageMetrics {
  resetKnowledgeGraphCache();
  const graph = getKnowledgeGraph().toJSON();
  const competitions = listCompetitions().length;
  const seasons = listSeasons().length;
  const teams = listTeams().length;
  const markets = listMarkets().length;
  const operators = listOperators().length;
  const countries = Object.keys(COUNTRY_PROFILES).length;

  const indexableRoutes =
    (1 + // home
      1 + // operators index
      1 + // markets index
      1 + // competitions index
      1 + // teams index
      1 + // seasons index
      operators +
      markets +
      competitions +
      teams +
      seasons) *
    locales.length;

  return {
    competitions,
    seasons,
    teams,
    markets,
    operators,
    countries,
    graphEntities: graph.entities.length,
    graphEdges: graph.edges.length,
    indexableRoutes,
    analyticsEntityEvents: 6, // competition/market/operator/team/season/entity families present
  };
}

export function auditCoverage(): DataQualityFinding[] {
  const metrics = buildCoverageMetrics();
  const findings: DataQualityFinding[] = [];

  const checks: Array<{ ok: boolean; id: string; message: string; warn?: boolean }> = [
    { ok: metrics.competitions >= 10, id: "coverage-competitions", message: `${metrics.competitions} competitions registered` },
    { ok: metrics.seasons >= 10, id: "coverage-seasons", message: `${metrics.seasons} seasons registered` },
    { ok: metrics.teams >= 20, id: "coverage-teams", message: `${metrics.teams} teams registered` },
    { ok: metrics.markets >= 5, id: "coverage-markets", message: `${metrics.markets} markets registered` },
    { ok: metrics.operators >= 5, id: "coverage-operators", message: `${metrics.operators} operators registered` },
    { ok: metrics.countries >= 4, id: "coverage-countries", message: `${metrics.countries} country profiles` },
    { ok: metrics.graphEdges > 50, id: "coverage-graph-edges", message: `${metrics.graphEdges} graph edges` },
  ];

  for (const check of checks) {
    findings.push({
      id: check.id,
      category: "coverage",
      severity: check.ok ? "pass" : check.warn ? "warning" : "error",
      message: check.message + (check.ok ? "" : " below expected threshold"),
    });
  }

  // Evidence eligibility is structural here: markets with listKind are trackable.
  const tracked = listMarkets().filter((market) => market.listKind).length;
  const educational = listMarkets().length - tracked;
  findings.push({
    id: "coverage-evidence-tracked",
    category: "coverage",
    severity: tracked > 0 ? "pass" : "error",
    message: `${tracked} tracked markets / ${educational} educational markets (no fabricated enrichment)`,
  });

  const competitionsWithoutSeason = listCompetitions().filter(
    (competition) => !listSeasons().some((season) => season.competitionSlug === competition.slug)
  );
  if (competitionsWithoutSeason.length) {
    for (const competition of competitionsWithoutSeason) {
      findings.push({
        id: `coverage-season-gap-${competition.slug}`,
        category: "coverage",
        severity: "error",
        entityType: "competition",
        entityId: competition.slug,
        message: "Competition has no season entity",
      });
    }
  } else {
    findings.push({
      id: "coverage-season-complete",
      category: "coverage",
      severity: "pass",
      message: "Every competition has a season entity",
    });
  }

  return findings;
}

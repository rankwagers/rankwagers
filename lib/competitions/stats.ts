import type { QualifiedFixture } from "@/lib/research/qualifiedFixture";
import { competitionMatchesLeague } from "./registry";
import type { CompetitionDefinition, CompetitionResearchStats } from "./types";

export function fixturesForCompetition(
  competition: CompetitionDefinition,
  fixtures: readonly QualifiedFixture[]
): QualifiedFixture[] {
  return fixtures.filter((fixture) =>
    competitionMatchesLeague(competition, fixture.league)
  );
}

export function buildCompetitionResearchStats(
  competition: CompetitionDefinition,
  fixtures: readonly QualifiedFixture[]
): CompetitionResearchStats {
  const scoped = fixturesForCompetition(competition, fixtures);
  if (!scoped.length) {
    return {
      qualifiedFixtureCount: 0,
      uniqueMatchCount: 0,
      averageModelProbability: null,
      marketBreakdown: [],
      sampleQuality: "none",
      sampleNote:
        "No qualified research fixtures matched this competition in the current daily set.",
    };
  }

  const uniqueMatchCount = new Set(scoped.map((fixture) => fixture.matchId)).size;
  const averageModelProbability =
    scoped.reduce((sum, fixture) => sum + fixture.modelProbability, 0) / scoped.length;

  const byMarket = new Map<string, { count: number; total: number }>();
  for (const fixture of scoped) {
    const row = byMarket.get(fixture.market) ?? { count: 0, total: 0 };
    row.count += 1;
    row.total += fixture.modelProbability;
    byMarket.set(fixture.market, row);
  }

  const marketBreakdown = [...byMarket.entries()]
    .map(([market, value]) => ({
      market,
      count: value.count,
      averageProbability: value.total / value.count,
    }))
    .sort((left, right) => right.count - left.count);

  const sampleQuality =
    uniqueMatchCount >= 6
      ? "adequate"
      : uniqueMatchCount >= 3
        ? "limited"
        : "very-limited";

  return {
    qualifiedFixtureCount: scoped.length,
    uniqueMatchCount,
    averageModelProbability,
    marketBreakdown,
    sampleQuality,
    sampleNote: `Aggregated from today's qualified research queue for ${competition.name} only — not a full-season forecast.`,
  };
}

export function upcomingFixtures(
  competition: CompetitionDefinition,
  fixtures: readonly QualifiedFixture[],
  limit = 8
): QualifiedFixture[] {
  return [...fixturesForCompetition(competition, fixtures)]
    .sort(
      (left, right) =>
        Date.parse(left.kickoffDateTime) - Date.parse(right.kickoffDateTime) ||
        right.modelProbability - left.modelProbability
    )
    .slice(0, limit);
}

export function recentAnalyzedFixtures(
  competition: CompetitionDefinition,
  fixtures: readonly QualifiedFixture[],
  limit = 6
): QualifiedFixture[] {
  // Research queue has no separate "recent results" feed — surface highest-signal
  // analyzed fixtures as the factual stand-in without inventing match outcomes.
  return [...fixturesForCompetition(competition, fixtures)]
    .sort((left, right) => right.modelProbability - left.modelProbability)
    .slice(0, limit);
}

export function relatedTeamsFromFixtures(
  competition: CompetitionDefinition,
  fixtures: readonly QualifiedFixture[],
  limit = 8
): string[] {
  const names = new Set<string>();
  for (const fixture of fixturesForCompetition(competition, fixtures)) {
    names.add(fixture.home);
    names.add(fixture.away);
  }
  const fromFixtures = [...names].sort((left, right) => left.localeCompare(right));
  if (fromFixtures.length) return fromFixtures.slice(0, limit);
  return [...competition.relatedTeamHints].slice(0, limit);
}

import type { QualifiedFixture } from "@/lib/research/qualifiedFixture";
import type { MarketDefinition, MarketHistoricalStats } from "./types";

export function buildMarketHistoricalStats(
  market: MarketDefinition,
  fixtures: readonly QualifiedFixture[]
): MarketHistoricalStats {
  const scoped = market.listKind
    ? fixtures.filter((fixture) => fixture.marketKind === market.listKind)
    : [];

  if (!scoped.length) {
    return {
      qualifiedFixtureCount: 0,
      averageModelProbability: null,
      highestModelProbability: null,
      leagueCoverage: 0,
      topLeagues: [],
      sampleNote: market.listKind
        ? "No qualified fixtures for this market in the current research set."
        : "This market is documented for education; it is not part of the daily qualification queue yet.",
    };
  }

  const probabilities = scoped.map((fixture) => fixture.modelProbability);
  const leagueCounts = new Map<string, number>();
  for (const fixture of scoped) {
    leagueCounts.set(fixture.league, (leagueCounts.get(fixture.league) ?? 0) + 1);
  }
  const topLeagues = [...leagueCounts.entries()]
    .map(([league, count]) => ({ league, count }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 5);

  return {
    qualifiedFixtureCount: scoped.length,
    averageModelProbability:
      probabilities.reduce((sum, value) => sum + value, 0) / probabilities.length,
    highestModelProbability: Math.max(...probabilities),
    leagueCoverage: leagueCounts.size,
    topLeagues,
    sampleNote: "Aggregated from today's qualified research fixtures only — not a season forecast.",
  };
}

export function fixturesForMarket(
  market: MarketDefinition,
  fixtures: readonly QualifiedFixture[],
  limit = 8
): QualifiedFixture[] {
  if (!market.listKind) return [];
  return fixtures
    .filter((fixture) => fixture.marketKind === market.listKind)
    .sort((left, right) => right.modelProbability - left.modelProbability)
    .slice(0, limit);
}

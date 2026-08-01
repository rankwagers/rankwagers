import { detectOddsMovements } from "@/lib/odds-history/movement";
import { queryOddsHistory } from "@/lib/odds-history/service";
import type { OddsHistoryRecord } from "@/lib/odds-history/types";
import type { QualifiedFixture } from "@/lib/research/qualifiedFixture";
import type { CompetitionOddsSummary } from "./types";

export function buildCompetitionOddsSummary(
  fixtureIds: readonly number[],
  records: readonly OddsHistoryRecord[]
): CompetitionOddsSummary {
  if (!fixtureIds.length) {
    return { sampleSize: 0, bestOdds: null, averageOdds: null, movementCount: 0 };
  }
  const idSet = new Set(fixtureIds);
  const scoped = records.filter((record) => idSet.has(record.fixtureId));
  if (!scoped.length) {
    return { sampleSize: 0, bestOdds: null, averageOdds: null, movementCount: 0 };
  }
  const odds = scoped.map((row) => row.odd);
  return {
    sampleSize: scoped.length,
    bestOdds: Math.max(...odds),
    averageOdds: odds.reduce((sum, value) => sum + value, 0) / odds.length,
    movementCount: detectOddsMovements(scoped).length,
  };
}

export async function getCompetitionOddsSummary(
  fixtures: readonly QualifiedFixture[]
): Promise<CompetitionOddsSummary> {
  const fixtureIds = [...new Set(fixtures.map((fixture) => fixture.matchId))];
  if (!fixtureIds.length) {
    return { sampleSize: 0, bestOdds: null, averageOdds: null, movementCount: 0 };
  }
  const records = await queryOddsHistory({ limit: 20_000 });
  return buildCompetitionOddsSummary(fixtureIds, records);
}

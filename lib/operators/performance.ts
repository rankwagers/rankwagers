import { ClosingLineValueService } from "@/lib/odds-history/closingLineValue";
import { detectOddsMovements } from "@/lib/odds-history/movement";
import { queryOddsHistory } from "@/lib/odds-history/service";
import type { OddsHistoryRecord } from "@/lib/odds-history/types";
import type { Operator, OperatorOddsPerformance } from "./types";

const clvService = new ClosingLineValueService();

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export function recordsForOperator(
  operator: Operator,
  records: readonly OddsHistoryRecord[]
): OddsHistoryRecord[] {
  const nameKey = normalizeName(operator.name);
  const slugKey = normalizeName(operator.slug);
  const ids = new Set(operator.apiFootballBookmakerIds);
  return records.filter((record) => {
    if (ids.size && ids.has(record.operatorId)) return true;
    const recordName = normalizeName(record.operatorName);
    return recordName === nameKey || recordName.includes(slugKey) || slugKey.includes(recordName);
  });
}

export function buildOperatorOddsPerformance(
  operator: Operator,
  records: readonly OddsHistoryRecord[]
): OperatorOddsPerformance {
  const scoped = recordsForOperator(operator, records);
  if (!scoped.length) {
    return {
      sampleSize: 0,
      averageOdds: null,
      highestOdds: null,
      lowestOdds: null,
      marketCoverage: 0,
      marketsObserved: [],
      movementCount: 0,
      steamCount: 0,
      clvAveragePercent: null,
      recentFixtureIds: [],
    };
  }

  const odds = scoped.map((row) => row.odd);
  const marketsObserved = [...new Set(scoped.map((row) => row.market))].sort();
  const movements = detectOddsMovements(scoped);
  const bySeries = new Map<string, OddsHistoryRecord[]>();
  for (const record of scoped) {
    const key = `${record.fixtureId}:${record.market}`;
    const series = bySeries.get(key) ?? [];
    series.push(record);
    bySeries.set(key, series);
  }

  const clvValues: number[] = [];
  for (const series of bySeries.values()) {
    const ordered = [...series].sort(
      (left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp)
    );
    if (ordered.length < 2) continue;
    const opening = ordered[0].odd;
    const closing = ordered[ordered.length - 1].odd;
    const current = ordered.length >= 3 ? ordered[ordered.length - 2].odd : opening;
    try {
      clvValues.push(clvService.calculate({ opening, current, closing }).clvPercent);
    } catch {
      // skip invalid series
    }
  }

  const recentFixtureIds = [...new Set(scoped.map((row) => row.fixtureId))]
    .sort((left, right) => right - left)
    .slice(0, 8);

  return {
    sampleSize: scoped.length,
    averageOdds: odds.reduce((sum, value) => sum + value, 0) / odds.length,
    highestOdds: Math.max(...odds),
    lowestOdds: Math.min(...odds),
    marketCoverage: marketsObserved.length,
    marketsObserved,
    movementCount: movements.length,
    steamCount: movements.filter((move) => move.isSteam).length,
    clvAveragePercent: clvValues.length
      ? clvValues.reduce((sum, value) => sum + value, 0) / clvValues.length
      : null,
    recentFixtureIds,
  };
}

export async function getOperatorOddsPerformance(
  operator: Operator
): Promise<OperatorOddsPerformance> {
  const records = await queryOddsHistory({ limit: 20_000 });
  return buildOperatorOddsPerformance(operator, records);
}

export function currentBestOddsFromPerformance(
  performance: OperatorOddsPerformance
): { highest: number | null; lowest: number | null; average: number | null } {
  return {
    highest: performance.highestOdds,
    lowest: performance.lowestOdds,
    average: performance.averageOdds,
  };
}

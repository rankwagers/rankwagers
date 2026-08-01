import { ClosingLineValueService } from "@/lib/odds-history/closingLineValue";
import { detectOddsMovements } from "@/lib/odds-history/movement";
import { queryOddsHistory } from "@/lib/odds-history/service";
import type { OddsHistoryRecord } from "@/lib/odds-history/types";
import type { MarketDefinition, MarketOddsSummary } from "./types";

const clvService = new ClosingLineValueService();

export function buildMarketOddsSummary(
  market: MarketDefinition,
  records: readonly OddsHistoryRecord[]
): MarketOddsSummary {
  if (!market.listKind) {
    return {
      sampleSize: 0,
      bestOdds: null,
      averageOdds: null,
      lowestOdds: null,
      movementCount: 0,
      steamCount: 0,
      clvAveragePercent: null,
    };
  }

  const scoped = records.filter((record) => record.market === market.listKind);
  if (!scoped.length) {
    return {
      sampleSize: 0,
      bestOdds: null,
      averageOdds: null,
      lowestOdds: null,
      movementCount: 0,
      steamCount: 0,
      clvAveragePercent: null,
    };
  }

  const odds = scoped.map((row) => row.odd);
  const movements = detectOddsMovements(scoped);
  const bySeries = new Map<string, OddsHistoryRecord[]>();
  for (const record of scoped) {
    const key = `${record.fixtureId}:${record.operatorId}`;
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
      // skip invalid
    }
  }

  return {
    sampleSize: scoped.length,
    bestOdds: Math.max(...odds),
    averageOdds: odds.reduce((sum, value) => sum + value, 0) / odds.length,
    lowestOdds: Math.min(...odds),
    movementCount: movements.length,
    steamCount: movements.filter((move) => move.isSteam).length,
    clvAveragePercent: clvValues.length
      ? clvValues.reduce((sum, value) => sum + value, 0) / clvValues.length
      : null,
  };
}

export async function getMarketOddsSummary(
  market: MarketDefinition
): Promise<MarketOddsSummary> {
  const records = await queryOddsHistory({
    market: market.listKind ?? undefined,
    limit: 20_000,
  });
  return buildMarketOddsSummary(market, records);
}

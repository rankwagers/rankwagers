import type {
  OddsChartRange,
  OddsChartSeries,
  OddsChartView,
  OddsHistoryRecord,
} from "./types";

const RANGE_MS: Record<OddsChartRange, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "12h": 12 * 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  live: 15 * 60 * 1000,
};

export function rangeToWindow(
  range: OddsChartRange,
  now = Date.now()
): { from: string; to: string } {
  return {
    from: new Date(now - RANGE_MS[range]).toISOString(),
    to: new Date(now).toISOString(),
  };
}

export function filterRecordsByRange(
  records: readonly OddsHistoryRecord[],
  range: OddsChartRange,
  now = Date.now()
): OddsHistoryRecord[] {
  const { from, to } = rangeToWindow(range, now);
  const fromMs = Date.parse(from);
  const toMs = Date.parse(to);
  return records.filter((record) => {
    const ts = Date.parse(record.timestamp);
    return ts >= fromMs && ts <= toMs;
  });
}

function pointValue(
  view: OddsChartView,
  odd: number,
  opening: number | null
): number | null {
  if (view === "decimal") return odd;
  if (view === "implied") return (1 / odd) * 100;
  if (opening === null || opening <= 0) return null;
  return ((odd - opening) / opening) * 100;
}

export function buildChartSeries(
  records: readonly OddsHistoryRecord[],
  view: OddsChartView
): OddsChartSeries[] {
  const byOperator = new Map<number, OddsHistoryRecord[]>();
  for (const record of records) {
    const series = byOperator.get(record.operatorId) ?? [];
    series.push(record);
    byOperator.set(record.operatorId, series);
  }

  return [...byOperator.entries()]
    .map(([operatorId, series]) => {
      const ordered = [...series].sort(
        (left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp)
      );
      const opening = ordered[0]?.odd ?? null;
      const points = ordered
        .map((record) => {
          const value = pointValue(view, record.odd, opening);
          if (value === null) return null;
          return { timestamp: record.timestamp, value };
        })
        .filter((point): point is { timestamp: string; value: number } => point !== null);
      return {
        operatorId,
        operatorName: ordered[ordered.length - 1]?.operatorName ?? String(operatorId),
        points,
      };
    })
    .filter((series) => series.points.length > 0)
    .sort((left, right) => left.operatorName.localeCompare(right.operatorName));
}

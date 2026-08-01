import type { OddsHistoryRecord, OddsTimelinePoint } from "./types";

function sortByTime(records: readonly OddsHistoryRecord[]): OddsHistoryRecord[] {
  return [...records].sort(
    (left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp)
  );
}

/**
 * Build a fixture/market timeline from observed history only.
 * Opening = earliest point, Closing = latest when market is considered closed
 * (or latest observation when `markLatestAsClosing` is true).
 */
export function buildOddsTimeline(
  records: readonly OddsHistoryRecord[],
  options: { markLatestAsClosing?: boolean } = {}
): OddsTimelinePoint[] {
  if (!records.length) return [];
  const ordered = sortByTime(records);
  const openingTime = ordered[0].timestamp;
  const closingTime = ordered[ordered.length - 1].timestamp;
  const markClosing = options.markLatestAsClosing !== false;

  return ordered.map((record, index) => {
    let kind: OddsTimelinePoint["kind"] = "historical";
    if (record.timestamp === openingTime && index === 0) kind = "opening";
    else if (markClosing && record.timestamp === closingTime && index === ordered.length - 1) {
      kind = "closing";
    } else if (index === ordered.length - 1) {
      kind = "current";
    }
    // Prefer "current" over "closing" label when there is only one point.
    if (ordered.length === 1) kind = "current";
    else if (index === ordered.length - 1 && !markClosing) kind = "current";
    else if (
      index === ordered.length - 1 &&
      markClosing &&
      ordered.length > 1
    ) {
      kind = "closing";
    }
    // Dual-label the last point as current when it is also the close for display lists:
    // callers can still show Opening → … → Current/Closing.
    if (index === ordered.length - 1 && ordered.length > 1 && markClosing) {
      kind = "closing";
    }
    if (index === 0 && ordered.length > 1) kind = "opening";
    if (index > 0 && index < ordered.length - 1) kind = "historical";

    return {
      kind,
      timestamp: record.timestamp,
      price: record.odd,
      operatorId: record.operatorId,
      operatorName: record.operatorName,
      market: record.market,
    };
  });
}

/** Per-operator opening / current / closing prices from history. */
export function operatorPriceAnchors(records: readonly OddsHistoryRecord[]): Array<{
  operatorId: number;
  operatorName: string;
  opening: number;
  current: number;
  closing: number;
  coveragePoints: number;
}> {
  const byOperator = new Map<number, OddsHistoryRecord[]>();
  for (const record of records) {
    const series = byOperator.get(record.operatorId) ?? [];
    series.push(record);
    byOperator.set(record.operatorId, series);
  }

  return [...byOperator.entries()].map(([operatorId, series]) => {
    const ordered = sortByTime(series);
    const opening = ordered[0];
    const latest = ordered[ordered.length - 1];
    return {
      operatorId,
      operatorName: latest.operatorName,
      opening: opening.odd,
      current: latest.odd,
      closing: latest.odd,
      coveragePoints: ordered.length,
    };
  });
}

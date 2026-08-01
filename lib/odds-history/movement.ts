import { classifySeverity, getMovementThresholds, type MovementThresholds } from "./thresholds";
import type { OddsHistoryRecord, OddsMovement, OddsMovementDirection } from "./types";

function percentChange(from: number, to: number): number {
  return ((to - from) / from) * 100;
}

function directionFor(percent: number): OddsMovementDirection {
  if (percent < 0) return "shortened";
  if (percent > 0) return "drifted";
  return "unchanged";
}

/**
 * Detect significant consecutive price moves per operator+market series.
 * Does not invent points — only compares observed history.
 */
export function detectOddsMovements(
  records: readonly OddsHistoryRecord[],
  thresholds: MovementThresholds = getMovementThresholds()
): OddsMovement[] {
  const byKey = new Map<string, OddsHistoryRecord[]>();
  for (const record of records) {
    const key = `${record.operatorId}:${record.market}`;
    const series = byKey.get(key) ?? [];
    series.push(record);
    byKey.set(key, series);
  }

  const movements: OddsMovement[] = [];
  for (const series of byKey.values()) {
    const ordered = [...series].sort(
      (left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp)
    );
    for (let index = 1; index < ordered.length; index += 1) {
      const previous = ordered[index - 1];
      const current = ordered[index];
      if (previous.odd === current.odd) continue;
      const change = percentChange(previous.odd, current.odd);
      const severity = classifySeverity(Math.abs(change), thresholds);
      if (!severity) continue;
      movements.push({
        operatorId: current.operatorId,
        operatorName: current.operatorName,
        market: current.market,
        fromTimestamp: previous.timestamp,
        toTimestamp: current.timestamp,
        fromPrice: previous.odd,
        toPrice: current.odd,
        percentChange: change,
        direction: directionFor(change),
        severity,
        isSteam: severity === "steam",
      });
    }
  }

  return movements.sort(
    (left, right) => Math.abs(right.percentChange) - Math.abs(left.percentChange)
  );
}

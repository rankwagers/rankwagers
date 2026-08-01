import { operatorPriceAnchors } from "./timeline";
import type { OddsHistoryRecord, OperatorOddsComparisonRow } from "./types";

function directionFor(percent: number | null): OperatorOddsComparisonRow["movementDirection"] {
  if (percent === null || percent === 0) return "unchanged";
  return percent < 0 ? "shortened" : "drifted";
}

export function buildOperatorComparison(
  records: readonly OddsHistoryRecord[],
  operatorIds?: readonly number[]
): OperatorOddsComparisonRow[] {
  const anchors = operatorPriceAnchors(records).filter((row) =>
    operatorIds?.length ? operatorIds.includes(row.operatorId) : true
  );

  return anchors
    .map((row) => {
      const difference =
        row.opening !== null && row.current !== null ? row.current - row.opening : null;
      const movementPercent =
        row.opening > 0 ? ((row.current - row.opening) / row.opening) * 100 : null;
      return {
        operatorId: row.operatorId,
        operatorName: row.operatorName,
        opening: row.opening,
        current: row.current,
        closing: row.closing,
        difference,
        movementPercent,
        movementDirection: directionFor(movementPercent),
        coveragePoints: row.coveragePoints,
      };
    })
    .sort((left, right) => (right.current ?? 0) - (left.current ?? 0));
}

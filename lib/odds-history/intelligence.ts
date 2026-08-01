import { buildChartSeries, filterRecordsByRange } from "./chartSeries";
import { ClosingLineValueService } from "./closingLineValue";
import { buildOperatorComparison } from "./comparison";
import { detectOddsMovements } from "./movement";
import { buildBestOddsSnapshot } from "./snapshot";
import { buildOddsTimeline } from "./timeline";
import type {
  ClosingLineDisplay,
  OddsChartRange,
  OddsChartView,
  OddsHistoryRecord,
  OddsIntelligencePayload,
} from "./types";

const clvService = new ClosingLineValueService();

function buildClvRows(records: readonly OddsHistoryRecord[]): ClosingLineDisplay[] {
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
      if (ordered.length < 2) return null;
      const opening = ordered[0].odd;
      const closing = ordered[ordered.length - 1].odd;
      // CLV compares a taken price vs close. Use the penultimate observation as
      // "current" so latest-as-close does not force a neutral 0% result.
      const current = ordered.length >= 3 ? ordered[ordered.length - 2].odd : opening;
      const result = clvService.calculate({ opening, current, closing });
      return {
        operatorId,
        operatorName: ordered[ordered.length - 1].operatorName,
        opening,
        current,
        closing,
        clvPercent: result.clvPercent,
        direction: result.direction,
      };
    })
    .filter((row): row is ClosingLineDisplay => row !== null)
    .sort((left, right) => right.clvPercent - left.clvPercent);
}

export function buildOddsIntelligence(input: {
  fixtureId: number;
  market: string;
  records: readonly OddsHistoryRecord[];
  range?: OddsChartRange;
  view?: OddsChartView;
  compareOperatorIds?: readonly number[];
  now?: number;
}): OddsIntelligencePayload {
  const range = input.range ?? "24h";
  const view = input.view ?? "decimal";
  const scoped = filterRecordsByRange(input.records, range, input.now).filter(
    (record) => record.market === input.market && record.fixtureId === input.fixtureId
  );
  // If the range window is empty but we have market history, fall back to full series
  // so charts still render observed evidence (no fabricated points).
  const records =
    scoped.length > 0
      ? scoped
      : input.records.filter(
          (record) => record.market === input.market && record.fixtureId === input.fixtureId
        );

  return {
    fixtureId: input.fixtureId,
    market: input.market,
    range,
    records: [...records],
    timeline: buildOddsTimeline(records),
    movements: detectOddsMovements(records),
    snapshot: buildBestOddsSnapshot(input.market, records),
    comparison: buildOperatorComparison(records, input.compareOperatorIds),
    clv: buildClvRows(records),
    chart: {
      view,
      series: buildChartSeries(records, view),
    },
  };
}

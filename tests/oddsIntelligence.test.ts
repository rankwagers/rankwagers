import assert from "node:assert/strict";
import test from "node:test";
import { analyticsEventNames } from "../lib/analytics/types";
import { buildChartSeries, filterRecordsByRange } from "../lib/odds-history/chartSeries";
import { buildOperatorComparison } from "../lib/odds-history/comparison";
import { buildOddsIntelligence } from "../lib/odds-history/intelligence";
import { MemoryOddsHistoryStore } from "../lib/odds-history/memory";
import { detectOddsMovements } from "../lib/odds-history/movement";
import { buildBestOddsSnapshot } from "../lib/odds-history/snapshot";
import { classifySeverity } from "../lib/odds-history/thresholds";
import { buildOddsTimeline } from "../lib/odds-history/timeline";
import type { OddsHistoryRecord } from "../lib/odds-history/types";

function record(
  partial: Partial<OddsHistoryRecord> & Pick<OddsHistoryRecord, "odd" | "timestamp">
): OddsHistoryRecord {
  return {
    fixtureId: 100,
    operatorId: 1,
    operatorName: "Alpha",
    market: "over15",
    line: "1.5",
    ...partial,
  };
}

const sample: OddsHistoryRecord[] = [
  record({ operatorId: 1, operatorName: "Alpha", odd: 2.1, timestamp: "2026-07-25T10:00:00.000Z" }),
  record({ operatorId: 1, operatorName: "Alpha", odd: 2.0, timestamp: "2026-07-25T12:00:00.000Z" }),
  record({ operatorId: 1, operatorName: "Alpha", odd: 1.8, timestamp: "2026-07-25T14:00:00.000Z" }),
  record({ operatorId: 2, operatorName: "Beta", odd: 2.05, timestamp: "2026-07-25T10:00:00.000Z" }),
  record({ operatorId: 2, operatorName: "Beta", odd: 2.2, timestamp: "2026-07-25T14:00:00.000Z" }),
];

test("builds opening historical and closing timeline points without inventing prices", () => {
  const timeline = buildOddsTimeline(sample.filter((row) => row.operatorId === 1));
  assert.equal(timeline[0]?.kind, "opening");
  assert.equal(timeline[0]?.price, 2.1);
  assert.equal(timeline[timeline.length - 1]?.kind, "closing");
  assert.equal(timeline[timeline.length - 1]?.price, 1.8);
  assert.ok(timeline.some((point) => point.kind === "historical"));
});

test("detects shortened drifted and steam movements from configurable thresholds", () => {
  assert.equal(classifySeverity(1.5, { minor: 1, medium: 3, major: 6, steam: 8 }), "minor");
  assert.equal(classifySeverity(9, { minor: 1, medium: 3, major: 6, steam: 8 }), "steam");

  const movements = detectOddsMovements(sample, {
    minor: 1,
    medium: 3,
    major: 6,
    steam: 8,
  });
  assert.ok(movements.some((move) => move.direction === "shortened"));
  assert.ok(movements.some((move) => move.direction === "drifted"));
  assert.ok(movements.some((move) => move.isSteam || move.severity === "major" || move.severity === "medium"));
});

test("best odds snapshot and operator comparison use observed latest prices", () => {
  const snapshot = buildBestOddsSnapshot("over15", sample);
  assert.equal(snapshot.highest?.operatorName, "Beta");
  assert.equal(snapshot.highest?.odd, 2.2);
  assert.equal(snapshot.lowest?.operatorName, "Alpha");
  assert.ok(snapshot.average !== null);
  assert.ok(snapshot.spread !== null);

  const comparison = buildOperatorComparison(sample, [1, 2]);
  assert.equal(comparison.length, 2);
  assert.equal(comparison.find((row) => row.operatorId === 1)?.opening, 2.1);
  assert.equal(comparison.find((row) => row.operatorId === 1)?.current, 1.8);
});

test("chart series support decimal implied and percent change views", () => {
  const decimal = buildChartSeries(sample, "decimal");
  const implied = buildChartSeries(sample, "implied");
  const change = buildChartSeries(sample, "percent_change");
  assert.ok(decimal[0]?.points.length);
  assert.ok(implied[0]?.points[0]?.value && implied[0].points[0].value < 100);
  assert.equal(change.find((row) => row.operatorId === 1)?.points[0]?.value, 0);
});

test("range filter keeps only observations inside the window", () => {
  const filtered = filterRecordsByRange(sample, "1h", Date.parse("2026-07-25T14:30:00.000Z"));
  assert.ok(filtered.every((row) => Date.parse(row.timestamp) >= Date.parse("2026-07-25T13:30:00.000Z")));
});

test("intelligence payload aggregates timeline movements clv snapshot comparison and chart", () => {
  const payload = buildOddsIntelligence({
    fixtureId: 100,
    market: "over15",
    records: sample,
    range: "24h",
    view: "decimal",
    now: Date.parse("2026-07-25T15:00:00.000Z"),
  });
  assert.equal(payload.fixtureId, 100);
  assert.ok(payload.timeline.length >= 3);
  assert.ok(payload.movements.length >= 1);
  assert.ok(payload.snapshot.highest);
  assert.equal(payload.comparison.length, 2);
  assert.ok(payload.clv.some((row) => row.operatorName === "Alpha"));
  assert.ok(payload.chart.series.length >= 1);
});

test("memory odds history store supports append and query filters", async () => {
  const store = new MemoryOddsHistoryStore();
  await store.append(sample);
  const rows = await store.query({ fixtureId: 100, market: "over15", operatorId: 2 });
  assert.equal(rows.length, 2);
  assert.ok(rows.every((row) => row.operatorId === 2));
});

test("odds intelligence analytics event names are registered", () => {
  for (const eventName of [
    "odds_history_viewed",
    "odds_chart_viewed",
    "odds_timeline_expanded",
    "odds_operator_compared",
    "odds_clv_viewed",
    "odds_movement_interaction",
  ] as const) {
    assert.ok(analyticsEventNames.includes(eventName), eventName);
  }
});

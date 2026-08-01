import assert from "node:assert/strict";
import test from "node:test";
import { aggregateOperatorAnalytics } from "../lib/analytics/dashboard";
import type { AnalyticsEvent } from "../lib/analytics/types";

const base: Omit<AnalyticsEvent, "event_name"> = {
  fixture_id: 42,
  market: "over15",
  operator_slug: "operator-one",
  country: "BR",
  country_source: "geo",
  locale: "pt",
  device: "mobile",
  referrer: null,
  timestamp: "2026-07-24T18:00:00.000Z",
  session_id: "session-1",
  user_id: null,
  properties: { fixture_label: "Home vs Away", league: "Example League" },
};

test("aggregates partner impressions and clicks into sortable operator rows", () => {
  const rows = aggregateOperatorAnalytics([
    { ...base, event_name: "operator_impression" },
    { ...base, event_name: "operator_impression", session_id: "session-2" },
    { ...base, event_name: "operator_click", session_id: "session-2" },
    { ...base, event_name: "search", operator_slug: null },
  ]);
  assert.deepEqual(rows, [{
    operator: "operator-one",
    impressions: 2,
    clicks: 1,
    ctr: 50,
    country: "BR",
    league: "Example League",
    market: "over15",
    fixture: "Home vs Away",
  }]);
});

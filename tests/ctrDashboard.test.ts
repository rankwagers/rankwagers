import assert from "node:assert/strict";
import test from "node:test";
import { buildCtrDashboard } from "../lib/analytics/ctrDashboard";
import type { AnalyticsEvent } from "../lib/analytics/types";

function event(
  partial: Pick<AnalyticsEvent, "event_name"> & Partial<AnalyticsEvent>
): AnalyticsEvent {
  return {
    fixture_id: null,
    market: null,
    operator_slug: null,
    country: null,
    country_source: null,
    locale: "en",
    device: "desktop",
    referrer: null,
    timestamp: "2026-07-25T12:00:00.000Z",
    session_id: "session-1",
    user_id: null,
    ...partial,
  };
}

test("builds operator fixture league market and country CTR rows", () => {
  const data = buildCtrDashboard([
    event({
      event_name: "operator_impression",
      operator_slug: "1xbet",
      market: "over15",
      country: "NG",
      fixture_id: 11,
      properties: { league: "NPFL", fixture_label: "Home vs Away" },
    }),
    event({
      event_name: "operator_impression",
      operator_slug: "1xbet",
      market: "over15",
      country: "NG",
      fixture_id: 11,
      properties: { league: "NPFL", fixture_label: "Home vs Away" },
      session_id: "session-2",
    }),
    event({
      event_name: "operator_click",
      operator_slug: "1xbet",
      market: "over15",
      country: "NG",
      fixture_id: 11,
      properties: { league: "NPFL", fixture_label: "Home vs Away" },
      session_id: "session-2",
    }),
    event({
      event_name: "fixture_impression",
      fixture_id: 11,
      market: "over15",
      country: "NG",
      properties: { league: "NPFL", fixture_label: "Home vs Away" },
    }),
    event({
      event_name: "go_redirect",
      operator_slug: "1xbet",
      market: "over15",
      country: "NG",
      fixture_id: 11,
      properties: { league: "NPFL", fixture_label: "Home vs Away" },
    }),
  ]);

  assert.equal(data.operators[0]?.key, "1xbet");
  assert.equal(data.operators[0]?.impressions, 2);
  assert.equal(data.operators[0]?.clicks, 1);
  assert.equal(data.operators[0]?.ctr, 50);
  assert.equal(data.operators[0]?.redirects, 1);
  assert.equal(data.fixtures[0]?.impressions, 1);
  assert.equal(data.fixtures[0]?.clicks, 1);
  assert.equal(data.leagues[0]?.key, "NPFL");
  assert.equal(data.markets[0]?.key, "over15");
  assert.equal(data.countries[0]?.country, "NG");
  assert.equal(data.countries[0]?.sessions, 2);
  assert.equal(data.countries[0]?.impressions, 2);
  assert.equal(data.countries[0]?.clicks, 1);
  assert.equal(data.countries[0]?.redirects, 1);
  assert.equal(data.countries[0]?.topOperator, "1xbet");
  assert.equal(data.countries[0]?.topLeague, "NPFL");
  assert.equal(data.countries[0]?.topMarket, "over15");
});

test("aggregates section funnel scroll time and exit analytics", () => {
  const data = buildCtrDashboard([
    event({ event_name: "homepage_section_impression", properties: { section: "highest_confidence" } }),
    event({ event_name: "homepage_section_click", properties: { section: "highest_confidence" } }),
    event({ event_name: "fixture_view", fixture_id: 9, market: "fh" }),
    event({ event_name: "operator_impression", operator_slug: "melbet", market: "fh" }),
    event({ event_name: "operator_click", operator_slug: "melbet", market: "fh" }),
    event({ event_name: "go_redirect", operator_slug: "melbet", market: "fh" }),
    event({ event_name: "scroll_depth", properties: { depth: 50 }, session_id: "a" }),
    event({ event_name: "scroll_depth", properties: { depth: 50 }, session_id: "a" }),
    event({ event_name: "scroll_depth", properties: { depth: 50 }, session_id: "b" }),
    event({
      event_name: "fixture_time_spent",
      fixture_id: 9,
      properties: { seconds: 12, fixture_label: "A vs B", league: "League" },
    }),
    event({
      event_name: "fixture_time_spent",
      fixture_id: 9,
      properties: { seconds: 8, fixture_label: "A vs B", league: "League" },
    }),
    event({ event_name: "page_exit", properties: { pathname: "/en" } }),
  ]);

  assert.equal(data.sections[0]?.section, "highest_confidence");
  assert.equal(data.sections[0]?.ctr, 100);
  assert.equal(data.funnel[0]?.step, "homepage_section");
  assert.equal(data.funnel[4]?.step, "go_redirect");
  assert.equal(data.scrollDepth[0]?.depth, 50);
  assert.equal(data.scrollDepth[0]?.sessions, 2);
  assert.equal(data.timeOnFixture[0]?.averageSeconds, 10);
  assert.equal(data.exits[0]?.path, "/en");
});

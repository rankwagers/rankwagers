"use client";

import { trackAnalyticsEvent } from "./client";

export function trackOddsHistoryViewed(input: {
  fixtureId: number;
  market: string;
  locale: string;
}): void {
  trackAnalyticsEvent({
    event_name: "odds_history_viewed",
    fixture_id: input.fixtureId,
    market: input.market,
    operator_slug: null,
    locale: input.locale,
    user_id: null,
  });
}

export function trackOddsChartViewed(input: {
  fixtureId: number;
  market: string;
  view: string;
  range: string;
  locale: string;
}): void {
  trackAnalyticsEvent({
    event_name: "odds_chart_viewed",
    fixture_id: input.fixtureId,
    market: input.market,
    operator_slug: null,
    locale: input.locale,
    user_id: null,
    properties: { view: input.view, range: input.range },
  });
}

export function trackOddsTimelineExpanded(input: {
  fixtureId: number;
  market: string;
  locale: string;
}): void {
  trackAnalyticsEvent({
    event_name: "odds_timeline_expanded",
    fixture_id: input.fixtureId,
    market: input.market,
    operator_slug: null,
    locale: input.locale,
    user_id: null,
  });
}

export function trackOddsOperatorCompared(input: {
  fixtureId: number;
  market: string;
  operatorIds: number[];
  locale: string;
}): void {
  trackAnalyticsEvent({
    event_name: "odds_operator_compared",
    fixture_id: input.fixtureId,
    market: input.market,
    operator_slug: null,
    locale: input.locale,
    user_id: null,
    properties: { operator_ids: input.operatorIds.join(",") },
  });
}

export function trackOddsClvViewed(input: {
  fixtureId: number;
  market: string;
  locale: string;
}): void {
  trackAnalyticsEvent({
    event_name: "odds_clv_viewed",
    fixture_id: input.fixtureId,
    market: input.market,
    operator_slug: null,
    locale: input.locale,
    user_id: null,
  });
}

export function trackOddsMovementInteraction(input: {
  fixtureId: number;
  market: string;
  severity: string;
  locale: string;
}): void {
  trackAnalyticsEvent({
    event_name: "odds_movement_interaction",
    fixture_id: input.fixtureId,
    market: input.market,
    operator_slug: null,
    locale: input.locale,
    user_id: null,
    properties: { severity: input.severity },
  });
}

"use client";

import { trackAnalyticsEvent } from "./client";

export function trackCompetitionPageView(input: {
  competitionSlug: string;
  locale: string;
}): void {
  trackAnalyticsEvent({
    event_name: "competition_page_view",
    fixture_id: null,
    market: null,
    operator_slug: null,
    locale: input.locale,
    user_id: null,
    properties: { competition: input.competitionSlug },
  });
}

export function trackCompetitionFixtureClick(input: {
  competitionSlug: string;
  fixtureId: number;
  locale: string;
}): void {
  trackAnalyticsEvent({
    event_name: "competition_fixture_click",
    fixture_id: input.fixtureId,
    market: null,
    operator_slug: null,
    locale: input.locale,
    user_id: null,
    properties: { competition: input.competitionSlug },
  });
}

export function trackCompetitionMarketClick(input: {
  competitionSlug: string;
  marketSlug: string;
  locale: string;
}): void {
  trackAnalyticsEvent({
    event_name: "competition_market_click",
    fixture_id: null,
    market: input.marketSlug,
    operator_slug: null,
    locale: input.locale,
    user_id: null,
    properties: { competition: input.competitionSlug },
  });
}

export function trackCompetitionOperatorClick(input: {
  competitionSlug: string;
  operatorSlug: string;
  locale: string;
}): void {
  trackAnalyticsEvent({
    event_name: "competition_operator_click",
    fixture_id: null,
    market: null,
    operator_slug: input.operatorSlug,
    locale: input.locale,
    user_id: null,
    properties: { competition: input.competitionSlug },
  });
}

export function trackCompetitionOddsInteraction(input: {
  competitionSlug: string;
  locale: string;
}): void {
  trackAnalyticsEvent({
    event_name: "competition_odds_interaction",
    fixture_id: null,
    market: null,
    operator_slug: null,
    locale: input.locale,
    user_id: null,
    properties: { competition: input.competitionSlug },
  });
}

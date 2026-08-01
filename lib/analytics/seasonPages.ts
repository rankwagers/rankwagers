"use client";

import { trackAnalyticsEvent } from "./client";

export function trackSeasonPageView(input: {
  seasonSlug: string;
  competitionSlug: string;
  locale: string;
}): void {
  trackAnalyticsEvent({
    event_name: "season_page_view",
    fixture_id: null,
    market: null,
    operator_slug: null,
    locale: input.locale,
    user_id: null,
    properties: {
      season_slug: input.seasonSlug,
      competition_slug: input.competitionSlug,
    },
  });
}

export function trackSeasonFixtureClick(input: {
  seasonSlug: string;
  competitionSlug: string;
  fixtureId: number;
  locale: string;
}): void {
  trackAnalyticsEvent({
    event_name: "season_fixture_click",
    fixture_id: input.fixtureId,
    market: null,
    operator_slug: null,
    locale: input.locale,
    user_id: null,
    properties: {
      season_slug: input.seasonSlug,
      competition_slug: input.competitionSlug,
    },
  });
}

export function trackSeasonTeamClick(input: {
  seasonSlug: string;
  competitionSlug: string;
  teamSlug: string;
  locale: string;
}): void {
  trackAnalyticsEvent({
    event_name: "season_team_click",
    fixture_id: null,
    market: null,
    operator_slug: null,
    locale: input.locale,
    user_id: null,
    properties: {
      season_slug: input.seasonSlug,
      competition_slug: input.competitionSlug,
      team_slug: input.teamSlug,
    },
  });
}

export function trackSeasonMarketClick(input: {
  seasonSlug: string;
  competitionSlug: string;
  marketSlug: string;
  locale: string;
}): void {
  trackAnalyticsEvent({
    event_name: "season_market_click",
    fixture_id: null,
    market: input.marketSlug,
    operator_slug: null,
    locale: input.locale,
    user_id: null,
    properties: {
      season_slug: input.seasonSlug,
      competition_slug: input.competitionSlug,
    },
  });
}

export function trackSeasonOperatorClick(input: {
  seasonSlug: string;
  competitionSlug: string;
  operatorSlug: string;
  locale: string;
}): void {
  trackAnalyticsEvent({
    event_name: "season_operator_click",
    fixture_id: null,
    market: null,
    operator_slug: input.operatorSlug,
    locale: input.locale,
    user_id: null,
    properties: {
      season_slug: input.seasonSlug,
      competition_slug: input.competitionSlug,
    },
  });
}

export function trackSeasonGraphNavigation(input: {
  seasonSlug: string;
  competitionSlug: string;
  targetType: string;
  targetSlug: string;
  locale: string;
}): void {
  trackAnalyticsEvent({
    event_name: "season_graph_navigation",
    fixture_id: null,
    market: null,
    operator_slug: null,
    locale: input.locale,
    user_id: null,
    properties: {
      season_slug: input.seasonSlug,
      competition_slug: input.competitionSlug,
      target_type: input.targetType,
      target_slug: input.targetSlug,
    },
  });
}

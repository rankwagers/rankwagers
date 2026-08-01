"use client";

import { trackAnalyticsEvent } from "./client";

export function trackTeamPageView(input: {
  teamSlug: string;
  teamId: string;
  locale: string;
}): void {
  trackAnalyticsEvent({
    event_name: "team_page_view",
    fixture_id: null,
    market: null,
    operator_slug: null,
    locale: input.locale,
    user_id: null,
    properties: {
      team_slug: input.teamSlug,
      team_id: input.teamId,
    },
  });
}

export function trackTeamFixtureClick(input: {
  teamSlug: string;
  teamId: string;
  fixtureId: number;
  locale: string;
}): void {
  trackAnalyticsEvent({
    event_name: "team_fixture_click",
    fixture_id: input.fixtureId,
    market: null,
    operator_slug: null,
    locale: input.locale,
    user_id: null,
    properties: {
      team_slug: input.teamSlug,
      team_id: input.teamId,
    },
  });
}

export function trackTeamCompetitionClick(input: {
  teamSlug: string;
  teamId: string;
  competitionSlug: string;
  locale: string;
}): void {
  trackAnalyticsEvent({
    event_name: "team_competition_click",
    fixture_id: null,
    market: null,
    operator_slug: null,
    locale: input.locale,
    user_id: null,
    properties: {
      team_slug: input.teamSlug,
      team_id: input.teamId,
      competition_slug: input.competitionSlug,
    },
  });
}

export function trackTeamMarketClick(input: {
  teamSlug: string;
  teamId: string;
  marketSlug: string;
  locale: string;
}): void {
  trackAnalyticsEvent({
    event_name: "team_market_click",
    fixture_id: null,
    market: input.marketSlug,
    operator_slug: null,
    locale: input.locale,
    user_id: null,
    properties: {
      team_slug: input.teamSlug,
      team_id: input.teamId,
    },
  });
}

export function trackTeamOperatorClick(input: {
  teamSlug: string;
  teamId: string;
  operatorSlug: string;
  locale: string;
}): void {
  trackAnalyticsEvent({
    event_name: "team_operator_click",
    fixture_id: null,
    market: null,
    operator_slug: input.operatorSlug,
    locale: input.locale,
    user_id: null,
    properties: {
      team_slug: input.teamSlug,
      team_id: input.teamId,
    },
  });
}

export function trackTeamEvidenceExpand(input: {
  teamSlug: string;
  teamId: string;
  locale: string;
}): void {
  trackAnalyticsEvent({
    event_name: "team_evidence_expand",
    fixture_id: null,
    market: null,
    operator_slug: null,
    locale: input.locale,
    user_id: null,
    properties: {
      team_slug: input.teamSlug,
      team_id: input.teamId,
    },
  });
}

export function trackTeamRelatedClick(input: {
  teamSlug: string;
  teamId: string;
  relatedSlug: string;
  locale: string;
}): void {
  trackAnalyticsEvent({
    event_name: "team_related_click",
    fixture_id: null,
    market: null,
    operator_slug: null,
    locale: input.locale,
    user_id: null,
    properties: {
      team_slug: input.teamSlug,
      team_id: input.teamId,
      related_slug: input.relatedSlug,
    },
  });
}

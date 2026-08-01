"use client";

import { trackAnalyticsEvent } from "@/lib/analytics/client";

export function trackMatchDetailViewed(input: {
  matchId: number;
  locale: string;
  league: string;
  country: string;
  market: string | null;
  source: string | null;
  lifecycle: string;
}): void {
  trackAnalyticsEvent({
    event_name: "match_detail_viewed",
    fixture_id: input.matchId,
    market: input.market,
    operator_slug: null,
    locale: input.locale,
    user_id: null,
    properties: {
      source: input.source,
      league: input.league,
      country: input.country,
      lifecycle: input.lifecycle,
    },
  });
}

export function trackMatchPredictionExpanded(input: {
  matchId: number;
  locale: string;
  market: string;
}): void {
  trackAnalyticsEvent({
    event_name: "match_prediction_expanded",
    fixture_id: input.matchId,
    market: input.market,
    operator_slug: null,
    locale: input.locale,
    user_id: null,
  });
}

export function trackMatchEvidenceViewed(input: {
  matchId: number;
  locale: string;
  market: string | null;
}): void {
  trackAnalyticsEvent({
    event_name: "match_evidence_viewed",
    fixture_id: input.matchId,
    market: input.market,
    operator_slug: null,
    locale: input.locale,
    user_id: null,
  });
}

export function trackMatchRetry(input: {
  matchId: number;
  locale: string;
}): void {
  trackAnalyticsEvent({
    event_name: "match_detail_retry",
    fixture_id: input.matchId,
    market: null,
    operator_slug: null,
    locale: input.locale,
    user_id: null,
  });
}

export function trackMatchRelatedClick(input: {
  matchId: number;
  locale: string;
  kind: "fixture" | "team" | "competition";
  target: string;
}): void {
  trackAnalyticsEvent({
    event_name: "match_related_click",
    fixture_id: input.matchId,
    market: null,
    operator_slug: null,
    locale: input.locale,
    user_id: null,
    properties: { kind: input.kind, target: input.target },
  });
}

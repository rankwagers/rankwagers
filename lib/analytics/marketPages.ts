"use client";

import { trackAnalyticsEvent } from "./client";

export function trackMarketPageView(input: {
  marketSlug: string;
  locale: string;
}): void {
  trackAnalyticsEvent({
    event_name: "market_page_view",
    fixture_id: null,
    market: input.marketSlug,
    operator_slug: null,
    locale: input.locale,
    user_id: null,
  });
}

export function trackMarketRelatedFixtureClick(input: {
  marketSlug: string;
  fixtureId: number;
  locale: string;
}): void {
  trackAnalyticsEvent({
    event_name: "market_related_fixture_click",
    fixture_id: input.fixtureId,
    market: input.marketSlug,
    operator_slug: null,
    locale: input.locale,
    user_id: null,
  });
}

export function trackMarketRelatedOperatorClick(input: {
  marketSlug: string;
  operatorSlug: string;
  locale: string;
}): void {
  trackAnalyticsEvent({
    event_name: "market_related_operator_click",
    fixture_id: null,
    market: input.marketSlug,
    operator_slug: input.operatorSlug,
    locale: input.locale,
    user_id: null,
  });
}

export function trackMarketOddsInteraction(input: {
  marketSlug: string;
  locale: string;
}): void {
  trackAnalyticsEvent({
    event_name: "market_odds_interaction",
    fixture_id: null,
    market: input.marketSlug,
    operator_slug: null,
    locale: input.locale,
    user_id: null,
  });
}

export function trackMarketEvidenceExpansion(input: {
  marketSlug: string;
  locale: string;
}): void {
  trackAnalyticsEvent({
    event_name: "market_evidence_expansion",
    fixture_id: null,
    market: input.marketSlug,
    operator_slug: null,
    locale: input.locale,
    user_id: null,
  });
}

export function trackMarketCtaInteraction(input: {
  marketSlug: string;
  locale: string;
  target: string;
}): void {
  trackAnalyticsEvent({
    event_name: "market_cta_interaction",
    fixture_id: null,
    market: input.marketSlug,
    operator_slug: null,
    locale: input.locale,
    user_id: null,
    properties: { target: input.target },
  });
}

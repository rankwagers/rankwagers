"use client";

import { trackAnalyticsEvent } from "./client";

export type HomepageDestination =
  | "todays_matches"
  | "live_signals"
  | "qualified_markets"
  | "operators"
  | "markets"
  | "competitions"
  | "teams"
  | "seasons";

type PartnerCardContext = {
  fixtureId: number;
  fixtureLabel: string;
  league: string;
  market: string;
  operatorSlug: string;
  availability: string;
  oddsVerified: boolean;
  locale?: string;
};

function trackPartnerCardEvent(
  event_name: "operator_click" | "operator_impression",
  context: PartnerCardContext
): void {
  trackAnalyticsEvent({
    event_name,
    fixture_id: context.fixtureId,
    market: context.market,
    operator_slug: context.operatorSlug,
    locale: context.locale ?? "en",
    user_id: null,
    properties: {
      availability: context.availability,
      odds_verified: context.oddsVerified,
      fixture_label: context.fixtureLabel,
      league: context.league,
    },
  });
}

export function trackHomepageNavigation(
  destination: HomepageDestination,
  locale: string
): void {
  trackAnalyticsEvent({
    event_name: "homepage_navigation",
    fixture_id: null,
    market: null,
    operator_slug: null,
    locale,
    user_id: null,
    properties: { destination },
  });
}

export function trackHomepageSearch(query: string, locale: string): void {
  const queryLength = query.trim().length;
  if (!queryLength) return;
  trackAnalyticsEvent({
    event_name: "search",
    fixture_id: null,
    market: null,
    operator_slug: null,
    locale,
    user_id: null,
    properties: { query_length: queryLength },
  });
}

export function trackHomepageFilter(
  filter: "league" | "market",
  value: string,
  locale: string
): void {
  trackAnalyticsEvent({
    event_name: filter === "market" ? "market_selected" : "filter_change",
    fixture_id: null,
    market: filter === "market" && value !== "All" ? value : null,
    operator_slug: null,
    locale,
    user_id: null,
    properties: { filter, value },
  });
}

export function trackHomepagePagination(
  page: number,
  locale: string
): void {
  trackAnalyticsEvent({
    event_name: "pagination",
    fixture_id: null,
    market: null,
    operator_slug: null,
    locale,
    user_id: null,
    properties: { page },
  });
}

export function trackPartnerCardClick(context: PartnerCardContext): void {
  trackPartnerCardEvent("operator_click", context);
}

export function trackPartnerCardImpression(context: PartnerCardContext): void {
  trackPartnerCardEvent("operator_impression", context);
}

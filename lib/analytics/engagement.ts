"use client";

import { trackAnalyticsEvent } from "./client";

export type HomepageSectionId =
  | "hero"
  | "highest_confidence"
  | "top_picks"
  | "trending_markets"
  | "live_signals"
  | "live_matches"
  | "verified_performance"
  | "recent_results"
  | "featured_leagues"
  | "top_operators"
  | "why_trust"
  | "prediction_archive"
  | "acca_entry"
  | "recently_qualified"
  | "latest_insights"
  | "saved";

const trackedScrollDepths = new Set<number>();
const trackedSections = new Set<string>();
let exitTracked = false;

export function trackHomepageSectionImpression(section: HomepageSectionId, locale: string): void {
  if (trackedSections.has(`impression:${section}`)) return;
  trackedSections.add(`impression:${section}`);
  trackAnalyticsEvent({
    event_name: "homepage_section_impression",
    fixture_id: null,
    market: null,
    operator_slug: null,
    locale,
    user_id: null,
    properties: { section },
  });
}

export function trackHomepageSectionClick(section: HomepageSectionId, locale: string): void {
  trackAnalyticsEvent({
    event_name: "homepage_section_click",
    fixture_id: null,
    market: null,
    operator_slug: null,
    locale,
    user_id: null,
    properties: { section },
  });
}

export function trackScrollDepth(depth: number, locale: string): void {
  if (![25, 50, 75, 100].includes(depth) || trackedScrollDepths.has(depth)) return;
  trackedScrollDepths.add(depth);
  trackAnalyticsEvent({
    event_name: "scroll_depth",
    fixture_id: null,
    market: null,
    operator_slug: null,
    locale,
    user_id: null,
    properties: { depth },
  });
}

export function trackFixtureTimeSpent(input: {
  fixtureId: number;
  fixtureLabel: string;
  market: string;
  league: string;
  seconds: number;
  locale: string;
}): void {
  if (input.seconds < 1) return;
  trackAnalyticsEvent({
    event_name: "fixture_time_spent",
    fixture_id: input.fixtureId,
    market: input.market,
    operator_slug: null,
    locale: input.locale,
    user_id: null,
    properties: {
      seconds: Math.round(input.seconds),
      fixture_label: input.fixtureLabel,
      league: input.league,
    },
  });
}

export function trackPageExit(pathname: string, locale: string): void {
  if (exitTracked) return;
  exitTracked = true;
  trackAnalyticsEvent({
    event_name: "page_exit",
    fixture_id: null,
    market: null,
    operator_slug: null,
    locale,
    user_id: null,
    properties: { pathname },
  });
}

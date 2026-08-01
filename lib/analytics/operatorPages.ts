"use client";

import { trackAnalyticsEvent } from "./client";

export function trackOperatorPageView(input: {
  operatorSlug: string;
  locale: string;
}): void {
  trackAnalyticsEvent({
    event_name: "operator_page_view",
    fixture_id: null,
    market: null,
    operator_slug: input.operatorSlug,
    locale: input.locale,
    user_id: null,
  });
}

export function trackOperatorAffiliateCtaClick(input: {
  operatorSlug: string;
  locale: string;
}): void {
  trackAnalyticsEvent({
    event_name: "operator_affiliate_cta_click",
    fixture_id: null,
    market: null,
    operator_slug: input.operatorSlug,
    locale: input.locale,
    user_id: null,
  });
}

export function trackOperatorOddsPanelInteraction(input: {
  operatorSlug: string;
  locale: string;
  panel: string;
}): void {
  trackAnalyticsEvent({
    event_name: "operator_odds_panel_interaction",
    fixture_id: null,
    market: null,
    operator_slug: input.operatorSlug,
    locale: input.locale,
    user_id: null,
    properties: { panel: input.panel },
  });
}

export function trackOperatorRelatedClick(input: {
  operatorSlug: string;
  locale: string;
  kind: "operator" | "market" | "fixture" | "league";
  target: string;
}): void {
  trackAnalyticsEvent({
    event_name: "operator_related_click",
    fixture_id: null,
    market: input.kind === "market" ? input.target : null,
    operator_slug: input.operatorSlug,
    locale: input.locale,
    user_id: null,
    properties: { kind: input.kind, target: input.target },
  });
}

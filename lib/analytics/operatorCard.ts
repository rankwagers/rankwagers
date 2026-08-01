"use client";

import { trackAnalyticsEvent } from "./client";

/**
 * Operator evidence card analytics (Sprint 21).
 *
 * Mirrors `lib/analytics/engagement.ts` deliberately: same `trackAnalyticsEvent` envelope, same
 * dedupe-impressions-once discipline. It is a separate module rather than an extension of
 * `HomepageSectionId` because these cards render on fixture, competition and market pages, and
 * widening the homepage section union would have made that type lie about where it applies.
 */

/** Where a card was rendered. Needed to compare CTR across templates. */
export type OperatorCardSurface = "fixture" | "competition" | "market";

export type OperatorCardContext = {
  surface: OperatorCardSurface;
  operatorSlug: string;
  locale: string;
  /** Fixture id when the surface is a fixture page, otherwise null. Numeric per AnalyticsEvent. */
  fixtureId?: number | null;
  /** Contextual market key when the page has one, otherwise null. */
  market?: string | null;
  /** 1-based position in the ranked list, so CTR can be read by rank. */
  position: number;
  evidenceScore: number;
  qualification: string;
};

/**
 * Impressions are deduped per operator+surface for the lifetime of the page.
 *
 * Without this, a card scrolled past three times reports three impressions and the resulting CTR
 * is understated by a factor nobody can reconstruct afterwards.
 */
const seenImpressions = new Set<string>();

function envelope(ctx: OperatorCardContext) {
  return {
    fixture_id: ctx.fixtureId ?? null,
    market: ctx.market ?? null,
    operator_slug: ctx.operatorSlug,
    locale: ctx.locale,
    user_id: null,
    properties: {
      surface: ctx.surface,
      position: ctx.position,
      evidence_score: ctx.evidenceScore,
      qualification: ctx.qualification,
    },
  };
}

export function trackOperatorCardImpression(ctx: OperatorCardContext): void {
  const key = `${ctx.surface}:${ctx.operatorSlug}`;
  if (seenImpressions.has(key)) return;
  seenImpressions.add(key);
  trackAnalyticsEvent({ event_name: "operator_card_impression", ...envelope(ctx) });
}

export function trackOperatorCardPrimaryClick(ctx: OperatorCardContext): void {
  trackAnalyticsEvent({ event_name: "operator_card_primary_click", ...envelope(ctx) });
}

export function trackOperatorCardSecondaryClick(ctx: OperatorCardContext): void {
  trackAnalyticsEvent({ event_name: "operator_card_secondary_click", ...envelope(ctx) });
}

export function trackOperatorCardEvidenceExpand(ctx: OperatorCardContext): void {
  trackAnalyticsEvent({ event_name: "operator_card_evidence_expand", ...envelope(ctx) });
}

/** Test seam. The dedupe set is module state and would otherwise leak between cases. */
export function __resetOperatorCardImpressions(): void {
  seenImpressions.clear();
}

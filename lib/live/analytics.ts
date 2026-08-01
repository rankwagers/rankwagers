"use client";

/**
 * Sprint 22 — Live Match analytics.
 *
 * Four events, one per interaction the sprint asks to measure. Each carries `fixture_id` so
 * live engagement can be joined to the existing match-detail funnel, and `properties.phase`
 * so engagement can be read separately for first half, half-time and second half.
 *
 * No operator, affiliate or CTA identifiers are emitted from this layer by design.
 */

import { trackAnalyticsEvent } from "@/lib/analytics/client";
import type { LiveMatchPhase } from "@/types/live";

type LiveAnalyticsBase = {
  matchId: number;
  locale: string;
  phase: LiveMatchPhase;
};

export function trackLiveSectionViewed(
  input: LiveAnalyticsBase & {
    hasTimeline: boolean;
    hasMomentum: boolean;
    hasStatistics: boolean;
  }
): void {
  trackAnalyticsEvent({
    event_name: "live_section_viewed",
    fixture_id: input.matchId,
    market: null,
    operator_slug: null,
    locale: input.locale,
    user_id: null,
    properties: {
      phase: input.phase,
      has_timeline: input.hasTimeline,
      has_momentum: input.hasMomentum,
      has_statistics: input.hasStatistics,
    },
  });
}

export function trackLiveTimelineExpanded(
  input: LiveAnalyticsBase & { segment: string; eventCount: number }
): void {
  trackAnalyticsEvent({
    event_name: "live_timeline_expanded",
    fixture_id: input.matchId,
    market: null,
    operator_slug: null,
    locale: input.locale,
    user_id: null,
    properties: {
      phase: input.phase,
      segment: input.segment,
      event_count: input.eventCount,
    },
  });
}

export function trackLiveStatisticsExpanded(
  input: LiveAnalyticsBase & { statisticCount: number }
): void {
  trackAnalyticsEvent({
    event_name: "live_statistics_expanded",
    fixture_id: input.matchId,
    market: null,
    operator_slug: null,
    locale: input.locale,
    user_id: null,
    properties: {
      phase: input.phase,
      statistic_count: input.statisticCount,
    },
  });
}

export function trackLiveMomentumViewed(
  input: LiveAnalyticsBase & { availability: string; leader: string }
): void {
  trackAnalyticsEvent({
    event_name: "live_momentum_viewed",
    fixture_id: input.matchId,
    market: null,
    operator_slug: null,
    locale: input.locale,
    user_id: null,
    properties: {
      phase: input.phase,
      availability: input.availability,
      leader: input.leader,
    },
  });
}

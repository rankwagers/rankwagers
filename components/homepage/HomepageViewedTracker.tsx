"use client";

import { useEffect } from "react";
import { trackAnalyticsEvent } from "@/lib/analytics/client";

export function HomepageViewedTracker({
  locale,
  liveMatchCount,
  qualifiedFixtureCount,
}: {
  locale: string;
  liveMatchCount: number;
  qualifiedFixtureCount: number;
}) {
  useEffect(() => {
    trackAnalyticsEvent({
      event_name: "homepage_viewed",
      fixture_id: null,
      market: null,
      operator_slug: null,
      locale,
      user_id: null,
      properties: {
        live_match_count: liveMatchCount,
        qualified_fixture_count: qualifiedFixtureCount,
      },
    });
  }, [locale, liveMatchCount, qualifiedFixtureCount]);

  return null;
}

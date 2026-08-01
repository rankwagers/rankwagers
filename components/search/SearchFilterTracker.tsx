"use client";

import { useEffect, useRef } from "react";
import type { Locale } from "@/lib/i18n";
import { trackAnalyticsEvent } from "@/lib/analytics/client";
import { searchEventProperties } from "@/lib/search/analytics";

/** Fires search_filter when the type filter query param changes. */
export function SearchFilterTracker({
  locale,
  query,
  filter,
  resultsCount,
}: {
  locale: Locale;
  query: string;
  filter: string | null;
  resultsCount: number;
}) {
  const prev = useRef<string | null>(null);

  useEffect(() => {
    const key = filter ?? "all";
    if (prev.current === key) return;
    const isFirst = prev.current === null;
    prev.current = key;
    if (isFirst && key === "all") return;
    trackAnalyticsEvent({
      event_name: "search_filter",
      fixture_id: null,
      market: null,
      operator_slug: null,
      locale,
      user_id: null,
      properties: searchEventProperties({
        query,
        locale,
        filter: key,
        results_count: resultsCount,
      }),
    });
    if (key !== "all") {
      trackAnalyticsEvent({
        event_name: "search_group_expand",
        fixture_id: null,
        market: null,
        operator_slug: null,
        locale,
        user_id: null,
        properties: searchEventProperties({
          query,
          locale,
          group: key,
          results_count: resultsCount,
        }),
      });
    }
  }, [filter, locale, query, resultsCount]);

  return null;
}

"use client";

import { useEffect, useRef } from "react";
import { trackAnalyticsEvent } from "@/lib/analytics/client";
import { discoveryEventProperties } from "@/lib/discovery/eventProperties";

/** Fires recommendation_impression once when the discovery section enters view. */
export function RecommendationImpressionTracker({
  sourceEntity,
  count,
  locale,
  country,
}: {
  sourceEntity: string;
  count: number;
  locale: string;
  country?: string | null;
}) {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current || count <= 0) return;
    sent.current = true;
    trackAnalyticsEvent({
      event_name: "recommendation_impression",
      fixture_id: null,
      market: null,
      operator_slug: null,
      locale,
      user_id: null,
      properties: discoveryEventProperties({
        source_entity: sourceEntity,
        position: count,
        locale,
        country,
        panel: "entity_discovery",
      }),
    });
  }, [count, country, locale, sourceEntity]);

  return null;
}

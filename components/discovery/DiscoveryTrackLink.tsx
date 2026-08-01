"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { trackAnalyticsEvent } from "@/lib/analytics/client";
import { discoveryEventProperties } from "@/lib/discovery/eventProperties";
import type { AnalyticsEventName } from "@/lib/analytics/types";

export function DiscoveryTrackLink({
  href,
  children,
  eventName,
  sourceEntity,
  targetEntity,
  relationship,
  position,
  locale,
  country,
  className,
}: {
  href: string;
  children: ReactNode;
  eventName: AnalyticsEventName;
  sourceEntity: string;
  targetEntity: string;
  relationship?: string;
  position?: number;
  locale: string;
  country?: string | null;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => {
        trackAnalyticsEvent({
          event_name: eventName,
          fixture_id: null,
          market: null,
          operator_slug: null,
          locale,
          user_id: null,
          properties: discoveryEventProperties({
            source_entity: sourceEntity,
            target_entity: targetEntity,
            relationship,
            position,
            locale,
            country,
          }),
        });
      }}
    >
      {children}
    </Link>
  );
}

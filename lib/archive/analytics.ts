import { trackAnalyticsEvent } from "@/lib/analytics/client";
import type { AnalyticsEventName } from "@/lib/analytics/types";

export const ARCHIVE_ANALYTICS_EVENTS = [
  "archive_viewed",
  "archive_filter_used",
  "archive_prediction_opened",
  "archive_day_viewed",
  "methodology_viewed",
  "transparency_viewed",
  "transparency_interaction",
] as const satisfies readonly AnalyticsEventName[];

export type ArchiveAnalyticsEvent = (typeof ARCHIVE_ANALYTICS_EVENTS)[number];

export function trackArchiveEvent(
  event_name: ArchiveAnalyticsEvent,
  input?: {
    locale?: string | null;
    properties?: Record<string, string | number | boolean | null>;
  }
): void {
  trackAnalyticsEvent({
    event_name,
    fixture_id: null,
    market: null,
    operator_slug: null,
    locale: input?.locale ?? null,
    user_id: null,
    properties: input?.properties,
  });
}

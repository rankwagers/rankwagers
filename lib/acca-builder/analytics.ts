import { trackAnalyticsEvent } from "@/lib/analytics/client";
import type { AnalyticsEventName } from "@/lib/analytics/types";

export const ACCA_BUILDER_ANALYTICS_EVENTS = [
  "acca_builder_viewed",
  "acca_builder_generation_started",
  "acca_builder_generation_succeeded",
  "acca_builder_generation_failed",
  "acca_builder_no_valid_combination",
  "acca_builder_configuration_changed",
  "acca_builder_risk_mode_selected",
  "acca_builder_target_odds_selected",
  "acca_builder_combination_viewed",
  "acca_builder_leg_evidence_expanded",
  "acca_builder_added_to_studio",
  "acca_builder_merge_selected",
  "acca_builder_replace_selected",
  "acca_builder_operator_handoff",
  "acca_builder_abandoned",
] as const satisfies readonly AnalyticsEventName[];

export type AccaBuilderAnalyticsEvent =
  (typeof ACCA_BUILDER_ANALYTICS_EVENTS)[number];

export function trackAccaBuilderEvent(
  event_name: AccaBuilderAnalyticsEvent,
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

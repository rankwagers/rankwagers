import type { AnalyticsEventName } from "@/lib/analytics/types";

export const EVIDENCE_ANALYTICS_EVENTS = [
  "evidence_expand",
  "evidence_compare",
  "baseline_view",
  "qualification_view",
  "split_toggle",
  "source_view",
] as const satisfies readonly AnalyticsEventName[];

export type EvidenceAnalyticsPayload = {
  entity?: string;
  metric?: string;
  sample_size?: number;
  coverage?: number | null;
  locale?: string | null;
  country?: string | null;
  timestamp?: string;
};

export function evidenceEventProperties(
  payload: EvidenceAnalyticsPayload
): Record<string, string | number | boolean | null> {
  return {
    entity: payload.entity ?? null,
    metric: payload.metric ?? null,
    sample_size: payload.sample_size ?? null,
    coverage: payload.coverage ?? null,
    locale: payload.locale ?? null,
    country: payload.country ?? null,
    timestamp: payload.timestamp ?? new Date().toISOString(),
  };
}

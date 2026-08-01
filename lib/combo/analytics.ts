import { trackAnalyticsEvent } from "@/lib/analytics/client";
import type { AnalyticsEventName } from "@/lib/analytics/types";

export type ComboAnalyticsPayload = {
  comboId?: string;
  locale?: string;
  country?: string;
  targetOddsMin?: number;
  targetOddsMax?: number;
  actualOdds?: number;
  riskProfile?: string;
  selectionCount?: number;
  marketTypes?: string[];
  evidenceStrength?: string;
  averageCoverage?: number;
  operatorId?: string;
  operatorRank?: number;
  operatorAvailability?: "full" | "partial" | "none" | "unknown";
  placement?: string;
  deeplinkType?: string;
  offerId?: string;
};

function props(payload: ComboAnalyticsPayload): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      out[key] = value.join(",");
    } else {
      out[key] = value;
    }
  }
  out.timestamp = new Date().toISOString();
  return out;
}

/** Typed combo analytics — no-ops safely when analytics backend is absent. */
export function trackComboEvent(
  eventName: AnalyticsEventName,
  payload: ComboAnalyticsPayload = {}
): void {
  trackAnalyticsEvent({
    event_name: eventName,
    user_id: null,
    fixture_id: null,
    market: payload.marketTypes?.[0] ?? null,
    operator_slug: payload.operatorId ?? null,
    locale: payload.locale ?? null,
    country: payload.country ?? null,
    properties: props(payload),
  });
}

export type DiscoveryAnalyticsPayload = {
  source_entity?: string;
  target_entity?: string;
  relationship?: string;
  position?: number;
  country?: string | null;
  locale?: string | null;
  timestamp?: string;
  panel?: string;
};

export function discoveryEventProperties(
  payload: DiscoveryAnalyticsPayload
): Record<string, string | number | boolean | null> {
  return {
    source_entity: payload.source_entity ?? null,
    target_entity: payload.target_entity ?? null,
    relationship: payload.relationship ?? null,
    position: payload.position ?? null,
    country: payload.country ?? null,
    locale: payload.locale ?? null,
    timestamp: payload.timestamp ?? new Date().toISOString(),
    panel: payload.panel ?? null,
  };
}

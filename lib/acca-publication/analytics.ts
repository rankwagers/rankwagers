import { trackAnalyticsEvent } from "@/lib/analytics/client";
import type { AnalyticsEventName } from "@/lib/analytics/types";

/**
 * Analytics for the public Acca surface (Sprint 24).
 *
 * ONE ABSTRACTION, NOT A SECOND ONE. This is a thin typed wrapper over the existing
 * `trackAnalyticsEvent` spine, exactly like `lib/acca-builder/analytics.ts` and
 * `lib/analytics/operatorCard.ts`. It adds no transport, no queue and no provider.
 *
 * IMPORTABLE FROM CLIENT CODE. It pulls in the analytics client and the event-name union and
 * nothing else — no storage, no projection module, no `server-only` import. A client island that
 * imported the projection would drag the Acca store into the browser bundle.
 *
 * PRIVACY. The property allowlist below is exhaustive and is enforced by construction: callers
 * pass a typed object, and only these keys are forwarded. There is no free-form property bag, so
 * a fixture id, an operator, a query string, a referrer path or a title cannot be attached by a
 * future caller without editing this file and deciding that it is safe.
 */

export const PUBLIC_ACCA_ANALYTICS_EVENTS = [
  "acca_index_view",
  "acca_card_impression",
  "acca_card_click",
  "acca_detail_view",
  "acca_leg_expand",
  "acca_evidence_expand",
  "acca_share_open",
  "acca_share_copy",
  "acca_share_native",
  "acca_builder_entry_click",
] as const satisfies readonly AnalyticsEventName[];

export type PublicAccaAnalyticsEvent = (typeof PUBLIC_ACCA_ANALYTICS_EVENTS)[number];

/** Which page emitted the event. */
export type PublicAccaSurface = "acca_index" | "acca_detail" | "acca_homepage_section";

/**
 * Everything the public Acca events may carry.
 *
 * `publicAccaId` is the SLUG. The storage id is never sent: it is an internal identifier, it
 * appears nowhere on the page, and shipping it to an analytics provider would put it in a system
 * that has no reason to hold it.
 */
export type PublicAccaAnalyticsProperties = {
  publicAccaId?: string;
  surface: PublicAccaSurface;
  locale?: string;
  profile?: string;
  legCount?: number;
  oddsBand?: string;
  freshnessState?: string;
  /** 1-based position within a list, for impressions and clicks. */
  position?: number;
  /** Index page number, for the index view event. */
  page?: number;
  /** Count of results shown, for the index view event. */
  resultCount?: number;
  /** Whether the reader had narrowed the index. Boolean only — never the filter values. */
  filtered?: boolean;
  /** Which share mechanism was used. */
  shareMethod?: "native" | "clipboard" | "manual";
};

/** The exhaustive property allowlist, exported so a test can assert nothing else is forwarded. */
export const PUBLIC_ACCA_ANALYTICS_PROPERTY_KEYS: readonly string[] = [
  "publicAccaId",
  "surface",
  "locale",
  "profile",
  "legCount",
  "oddsBand",
  "freshnessState",
  "position",
  "page",
  "resultCount",
  "filtered",
  "shareMethod",
];

/**
 * Build the forwarded property bag.
 *
 * Exported separately from the tracker so the redaction rule can be tested without a browser
 * environment or a stubbed transport.
 */
export function publicAccaAnalyticsProperties(
  input: PublicAccaAnalyticsProperties,
): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const key of PUBLIC_ACCA_ANALYTICS_PROPERTY_KEYS) {
    const value = (input as Record<string, unknown>)[key];
    if (value === undefined || value === null) continue;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      out[key] = value;
    }
  }
  return out;
}

export function trackPublicAccaEvent(
  event_name: PublicAccaAnalyticsEvent,
  properties: PublicAccaAnalyticsProperties,
): void {
  trackAnalyticsEvent({
    event_name,
    fixture_id: null,
    market: null,
    operator_slug: null,
    locale: properties.locale ?? null,
    user_id: null,
    properties: publicAccaAnalyticsProperties(properties),
  });
}

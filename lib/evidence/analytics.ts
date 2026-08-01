/**
 * Sprint 23 evidence archive analytics.
 *
 * Browser-safe. Mirrors the shape of `lib/archive/analytics.ts` so downstream event
 * pipelines need no special-casing.
 *
 * The four events map to the sprint's tracking requirements:
 *   evidence_history_viewed      — Evidence History section rendered into view
 *   evidence_snapshot_expanded   — Snapshot Expanded
 *   evidence_validation_viewed   — Validation Viewed
 *   evidence_timeline_interaction— Timeline Interaction (keyboard or pointer)
 */

import { trackAnalyticsEvent } from "@/lib/analytics/client";
import type { AnalyticsEventName } from "@/lib/analytics/types";

export const EVIDENCE_ARCHIVE_ANALYTICS_EVENTS = [
  "evidence_history_viewed",
  "evidence_snapshot_expanded",
  "evidence_validation_viewed",
  "evidence_timeline_interaction",
] as const satisfies readonly AnalyticsEventName[];

export type EvidenceArchiveAnalyticsEvent =
  (typeof EVIDENCE_ARCHIVE_ANALYTICS_EVENTS)[number];

export type EvidenceArchiveAnalyticsPayload = {
  fixtureId?: number | null;
  snapshotId?: string | null;
  sequence?: number | null;
  modelVersion?: string | null;
  qualification?: string | null;
  validationState?: string | null;
  /** e.g. `keyboard` | `pointer` — how a timeline interaction was driven. */
  interaction?: string | null;
  snapshotCount?: number | null;
  locale?: string | null;
};

/** Normalize to the flat primitive map the analytics transport accepts. */
export function evidenceArchiveEventProperties(
  payload: EvidenceArchiveAnalyticsPayload
): Record<string, string | number | boolean | null> {
  return {
    snapshot_id: payload.snapshotId ?? null,
    sequence: payload.sequence ?? null,
    model_version: payload.modelVersion ?? null,
    qualification: payload.qualification ?? null,
    validation_state: payload.validationState ?? null,
    interaction: payload.interaction ?? null,
    snapshot_count: payload.snapshotCount ?? null,
  };
}

export function trackEvidenceArchiveEvent(
  event_name: EvidenceArchiveAnalyticsEvent,
  payload: EvidenceArchiveAnalyticsPayload = {}
): void {
  trackAnalyticsEvent({
    event_name,
    fixture_id: payload.fixtureId ?? null,
    market: null,
    operator_slug: null,
    locale: payload.locale ?? null,
    user_id: null,
    properties: evidenceArchiveEventProperties(payload),
  });
}

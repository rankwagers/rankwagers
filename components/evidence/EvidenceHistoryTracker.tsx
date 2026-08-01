"use client";

import { useEffect } from "react";
import { trackEvidenceArchiveEvent } from "@/lib/evidence/analytics";

/**
 * Fires `evidence_history_viewed` once per mount (Sprint 23).
 *
 * Rendered by the server section so the event carries the same counts the reader
 * actually saw. Renders nothing.
 */
export function EvidenceHistoryTracker({
  fixtureId,
  locale,
  snapshotCount,
  latestSnapshotId,
  latestModelVersion,
}: {
  fixtureId: number;
  locale?: string | null;
  snapshotCount: number;
  latestSnapshotId?: string | null;
  latestModelVersion?: string | null;
}) {
  useEffect(() => {
    trackEvidenceArchiveEvent("evidence_history_viewed", {
      fixtureId,
      locale: locale ?? null,
      snapshotCount,
      snapshotId: latestSnapshotId ?? null,
      modelVersion: latestModelVersion ?? null,
    });
  }, [fixtureId, locale, snapshotCount, latestSnapshotId, latestModelVersion]);

  return null;
}

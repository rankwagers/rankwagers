"use client";

import { useEffect, useRef } from "react";
import { trackLiveSectionViewed } from "@/lib/live/analytics";
import type { LiveMatchSnapshot } from "@/types/live";

/**
 * Sprint 22 — "live section viewed".
 *
 * Fires once per mount, and only when the section actually enters the viewport. The Live
 * Match section sits below the fold on most fixture pages, so a mount-time event would count
 * renders rather than views and make the funnel unusable.
 *
 * Renders nothing.
 */

export function LiveSectionViewTracker({
  matchId,
  locale,
  snapshot,
}: {
  matchId: number;
  locale: string;
  snapshot: Pick<LiveMatchSnapshot, "status" | "timeline" | "momentum" | "statistics">;
}) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;

    const fire = () => {
      if (firedRef.current) return;
      firedRef.current = true;
      trackLiveSectionViewed({
        matchId,
        locale,
        phase: snapshot.status.phase,
        hasTimeline: snapshot.timeline.availability === "available",
        hasMomentum: snapshot.momentum.availability === "available",
        hasStatistics: snapshot.statistics.availability === "available",
      });
    };

    const node = document.querySelector("[data-live-match-section]");
    if (!node || typeof IntersectionObserver === "undefined") {
      fire();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          fire();
          observer.disconnect();
        }
      },
      { threshold: 0.25 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [
    locale,
    matchId,
    snapshot.momentum.availability,
    snapshot.statistics.availability,
    snapshot.status.phase,
    snapshot.timeline.availability,
  ]);

  return null;
}

"use client";

import { useLiveAnnouncements } from "@/lib/live/context";

/**
 * Sprint 22 — ARIA live regions for the live layer.
 *
 * Two regions, always present in the DOM from the first server render. That matters: a live
 * region inserted at the same time as its content is frequently missed by screen readers,
 * because the region has to exist before the mutation happens.
 *
 *  - assertive (`role="alert"` semantics via `aria-live`): goals, penalties, red cards,
 *    full-time. Interrupting is justified because the user's model of the match just changed.
 *  - polite: bookings, substitutions, VAR checks, phase transitions.
 *
 * `aria-atomic="false"` so only the newly added sentence is read, not the whole buffer.
 */

export function LiveAnnouncer() {
  const announcements = useLiveAnnouncements();
  const assertive = announcements.filter((entry) => entry.priority === "assertive");
  const polite = announcements.filter((entry) => entry.priority === "polite");

  return (
    <>
      <div
        className="sr-only"
        role="log"
        aria-live="assertive"
        aria-atomic="false"
        data-testid="live-announcer-assertive"
      >
        {assertive.map((entry) => (
          <p key={entry.id}>{entry.message}</p>
        ))}
      </div>
      <div
        className="sr-only"
        role="log"
        aria-live="polite"
        aria-atomic="false"
        data-testid="live-announcer-polite"
      >
        {polite.map((entry) => (
          <p key={entry.id}>{entry.message}</p>
        ))}
      </div>
    </>
  );
}

"use client";

import { useCallback, useId, useState } from "react";
import { LiveEventBadge } from "./LiveEventBadge";
import { formatEventClock } from "@/lib/live/events";
import { trackLiveTimelineExpanded } from "@/lib/live/analytics";
import { readLivePhase, useLiveSlice, useLiveStoreContext } from "@/lib/live/context";
import { defaultExpandedSegments } from "@/lib/live/timeline";
import type { LiveMatchPhase, LiveTimeline, LiveTimelineSegmentKey } from "@/types/live";

/**
 * Sprint 22 — `LiveTimelineCard`.
 *
 * Segment-per-disclosure timeline. Subscribes to the `timeline` slice only.
 *
 * Accessibility:
 *  - each segment header is a real `<button>` with `aria-expanded` / `aria-controls`, so
 *    keyboard and screen-reader behaviour comes from the platform rather than from ARIA
 *    patched onto a `<div>`;
 *  - the event list is an ordered list, so a screen reader announces position and count;
 *  - new events arriving into an expanded segment are announced by `LiveAnnouncer`, not by
 *    marking the whole list as a live region (which would re-read every entry).
 */

export function LiveTimelineCard({
  initialTimeline,
  initialPhase,
  homeTeam,
  awayTeam,
  matchId,
  locale,
  headingId,
}: {
  initialTimeline: LiveTimeline;
  initialPhase: LiveMatchPhase;
  homeTeam: string;
  awayTeam: string;
  matchId: number;
  locale: string;
  headingId: string;
}) {
  const timeline = useLiveSlice("timeline", initialTimeline);
  const context = useLiveStoreContext();
  const baseId = useId();

  const [expanded, setExpanded] = useState<LiveTimelineSegmentKey[]>(() =>
    defaultExpandedSegments(initialTimeline, initialPhase)
  );

  const toggle = useCallback(
    (key: LiveTimelineSegmentKey, eventCount: number) => {
      setExpanded((current) => {
        const isOpen = current.includes(key);
        if (isOpen) return current.filter((entry) => entry !== key);
        trackLiveTimelineExpanded({
          matchId,
          locale,
          phase: readLivePhase(context, initialPhase),
          segment: key,
          eventCount,
        });
        return [...current, key];
      });
    },
    [context, initialPhase, locale, matchId]
  );

  if (timeline.availability !== "available") {
    return (
      <p
        className="rounded-lg border border-[var(--border-subtle)] bg-[var(--canvas-secondary)] px-4 py-5 text-sm text-muted-foreground"
        data-testid="live-timeline-empty"
      >
        {timeline.message ?? "Timeline data is not available for this fixture."}
      </p>
    );
  }

  const sideLabel = (side: "home" | "away" | "neutral") =>
    side === "home" ? homeTeam : side === "away" ? awayTeam : null;

  return (
    <div className="space-y-2" data-testid="live-timeline">
      {timeline.message ? (
        <p className="text-xs text-muted-foreground">{timeline.message}</p>
      ) : null}

      {timeline.segments.map((segment) => {
        const panelId = `${baseId}-${segment.key}`;
        const isOpen = expanded.includes(segment.key);
        return (
          <section
            key={segment.key}
            className="overflow-hidden rounded-lg border border-[var(--border-subtle)]"
          >
            <h3>
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => toggle(segment.key, segment.events.length)}
                className="flex min-h-[var(--touch-min)] w-full items-center justify-between gap-3 bg-[var(--canvas-secondary)] px-4 py-2 text-left text-sm font-semibold text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                <span>{segment.label}</span>
                <span className="flex items-center gap-2 text-xs font-normal text-muted-foreground">
                  {segment.events.length}{" "}
                  {segment.events.length === 1 ? "event" : "events"}
                  <span aria-hidden="true">{isOpen ? "−" : "+"}</span>
                </span>
              </button>
            </h3>
            <div id={panelId} hidden={!isOpen}>
              <ol className="divide-y divide-[var(--border-subtle)]">
                {segment.events.map((event) => (
                  <li
                    key={event.id}
                    className="flex items-start gap-3 px-4 py-2 text-sm"
                    data-live-event-id={event.id}
                  >
                    <span className="w-12 shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                      {formatEventClock(event)}
                    </span>
                    <LiveEventBadge event={event} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-foreground">
                        {event.label}
                      </span>
                      {sideLabel(event.side) ? (
                        <span className="block text-xs text-muted-foreground">
                          {sideLabel(event.side)}
                        </span>
                      ) : null}
                      {event.detail ? (
                        <span className="block text-xs text-muted-foreground">
                          {event.detail}
                        </span>
                      ) : null}
                      {event.origin === "derived" ? (
                        <span className="block text-metadata uppercase tracking-label text-muted-foreground">
                          Derived from match phase
                        </span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        );
      })}

      {timeline.undatedEvents.length ? (
        <section
          className="rounded-lg border border-dashed border-[var(--border-subtle)] px-4 py-3"
          aria-labelledby={`${headingId}-undated`}
        >
          <h3
            id={`${headingId}-undated`}
            className="text-xs font-semibold uppercase tracking-label text-muted-foreground"
          >
            Reported without a minute
          </h3>
          <ul className="mt-2 space-y-1">
            {timeline.undatedEvents.map((event) => (
              <li key={event.id} className="flex items-center gap-2 text-sm">
                <LiveEventBadge event={event} />
                <span>{event.label}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

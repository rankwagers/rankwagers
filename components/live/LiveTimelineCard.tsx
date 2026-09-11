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
        className="px-4 py-5 text-[13px]"
        style={{
          border: "1px solid var(--line)",
          background: "var(--surface)",
          borderRadius: 6,
          color: "var(--muted)",
        }}
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
        <p className="rw3-meta">{timeline.message}</p>
      ) : null}

      {timeline.segments.map((segment) => {
        const panelId = `${baseId}-${segment.key}`;
        const isOpen = expanded.includes(segment.key);
        return (
          <section
            key={segment.key}
            className="overflow-hidden"
            style={{ border: "1px solid var(--line)", borderRadius: 6 }}
          >
            <h3>
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => toggle(segment.key, segment.events.length)}
                className="rw3-hoverable flex min-h-[var(--touch-min)] w-full items-center justify-between gap-3 bg-[var(--surface)] px-4 py-2 text-left text-[13px] font-semibold"
              >
                <span>{segment.label}</span>
                <span
                  className="flex items-center gap-2 text-[12px] font-normal"
                  style={{ color: "var(--muted)" }}
                >
                  {segment.events.length}{" "}
                  {segment.events.length === 1 ? "event" : "events"}
                  <span aria-hidden="true">{isOpen ? "−" : "+"}</span>
                </span>
              </button>
            </h3>
            <div id={panelId} hidden={!isOpen}>
              <ol className="divide-y divide-[var(--line)]">
                {segment.events.map((event) => (
                  <li
                    key={event.id}
                    className="flex items-start gap-3 px-4 py-2 text-[13px]"
                    data-live-event-id={event.id}
                  >
                    <span
                      className="w-12 shrink-0 text-[12px] tabular-nums"
                      style={{ color: "var(--muted)" }}
                    >
                      {formatEventClock(event)}
                    </span>
                    <LiveEventBadge event={event} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">
                        {event.label}
                      </span>
                      {sideLabel(event.side) ? (
                        <span className="rw3-meta block">
                          {sideLabel(event.side)}
                        </span>
                      ) : null}
                      {event.detail ? (
                        <span className="rw3-meta block">
                          {event.detail}
                        </span>
                      ) : null}
                      {event.origin === "derived" ? (
                        <span className="rw3-label block">
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
          className="px-4 py-3"
          style={{ border: "1px dashed var(--line)", borderRadius: 6 }}
          aria-labelledby={`${headingId}-undated`}
        >
          <h3 id={`${headingId}-undated`} className="rw3-label">
            Reported without a minute
          </h3>
          <ul className="mt-2 space-y-1">
            {timeline.undatedEvents.map((event) => (
              <li key={event.id} className="flex items-center gap-2 text-[13px]">
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

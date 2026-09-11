import type { LiveEvent, LiveEventType } from "@/types/live";
import {
  LIVE_EVENT_GLYPH,
  LIVE_EVENT_LABEL,
  LIVE_EVENT_TONE,
  formatEventClock,
  type LiveEventTone,
} from "@/lib/live/events";

/**
 * Sprint 22 — `LiveEventBadge`.
 *
 * Presentational and dependency-free: no `"use client"`, no hooks, no store. It renders
 * identically in a server tree and inside a hydrated island, which is what lets the timeline
 * be server-rendered and then updated in place.
 *
 * Accessibility: the glyph is decorative (`aria-hidden`) and the full event type is exposed
 * as visually hidden text, so a screen reader hears "Yellow card" rather than "Y C".
 */

/* Live coloring law (Bible V3): the on-air moment carries `--accent`, everything
 * else stays quiet in `--muted`. Small 11px labels — the mock's live markers
 * never shout. */
const TONE_CLASS: Record<LiveEventTone, string> = {
  critical: "bg-[var(--pctbg)] text-[var(--accent)]",
  warning: "bg-[var(--pctbg)] text-[var(--muted)]",
  phase: "bg-[var(--pctbg)] text-[var(--muted)]",
  neutral: "bg-transparent text-[var(--muted)]",
};

export function liveEventBadgeTone(type: LiveEventType): LiveEventTone {
  return LIVE_EVENT_TONE[type];
}

export function LiveEventBadge({
  event,
  showClock = false,
  className = "",
}: {
  event: Pick<LiveEvent, "type" | "minute" | "addedTime">;
  showClock?: boolean;
  className?: string;
}) {
  const tone = LIVE_EVENT_TONE[event.type];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-[.06em] ${TONE_CLASS[tone]} ${className}`.trim()}
      style={{ border: "1px solid var(--line)", borderRadius: 6 }}
      data-live-event-type={event.type}
      data-live-event-tone={tone}
    >
      <span aria-hidden="true">{LIVE_EVENT_GLYPH[event.type]}</span>
      <span className="sr-only">{LIVE_EVENT_LABEL[event.type]}</span>
      {showClock ? (
        <span className="tabular-nums normal-case">
          {formatEventClock(event)}
        </span>
      ) : null}
    </span>
  );
}

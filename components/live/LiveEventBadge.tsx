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

const TONE_CLASS: Record<LiveEventTone, string> = {
  critical:
    "border-[color:color-mix(in_srgb,var(--red-primary)_35%,transparent)] bg-[var(--status-live-bg)] text-[var(--status-live-fg)]",
  warning: "border-[var(--amber-border)] bg-[var(--amber-surface)] text-[var(--amber-primary)]",
  phase: "border-[var(--border-subtle)] bg-[var(--canvas-secondary)] text-[var(--ink-secondary)]",
  neutral: "border-[var(--border-subtle)] bg-transparent text-[var(--ink-secondary)]",
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
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-metadata font-medium uppercase tracking-label ${TONE_CLASS[tone]} ${className}`.trim()}
      data-live-event-type={event.type}
      data-live-event-tone={tone}
    >
      <span aria-hidden="true">{LIVE_EVENT_GLYPH[event.type]}</span>
      <span className="sr-only">{LIVE_EVENT_LABEL[event.type]}</span>
      {showClock ? (
        <span className="font-mono tabular-nums normal-case">
          {formatEventClock(event)}
        </span>
      ) : null}
    </span>
  );
}

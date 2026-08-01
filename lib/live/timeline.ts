/**
 * Sprint 22 — LiveTimeline.
 *
 * Groups normalised events into match segments. Segments that contain no events are omitted
 * rather than rendered empty, and events the feed reported without a minute are surfaced in
 * a dedicated bucket instead of being assigned to a segment by guesswork.
 *
 * Pure module.
 */

import type {
  LiveEvent,
  LiveEvents,
  LiveMatchPhase,
  LiveMatchStatus,
  LiveTimeline,
  LiveTimelineSegment,
  LiveTimelineSegmentKey,
} from "@/types/live";

type SegmentDefinition = {
  key: LiveTimelineSegmentKey;
  label: string;
  fromMinute: number;
  toMinute: number | null;
};

/**
 * `half_time` is a zero-width segment at minute 45: the derived half-time marker belongs
 * there rather than at the end of the first half, so the reading order matches the match.
 */
export const LIVE_TIMELINE_SEGMENTS: readonly SegmentDefinition[] = [
  { key: "first_half", label: "First half", fromMinute: 0, toMinute: 45 },
  { key: "half_time", label: "Half-time", fromMinute: 45, toMinute: 45 },
  { key: "second_half", label: "Second half", fromMinute: 46, toMinute: 90 },
  { key: "extra_time", label: "Extra time", fromMinute: 91, toMinute: 120 },
  { key: "penalty_shootout", label: "Penalty shootout", fromMinute: 121, toMinute: null },
] as const;

function segmentFor(event: LiveEvent): LiveTimelineSegmentKey | null {
  if (event.minute == null) return null;
  if (event.type === "halftime") return "half_time";
  const minute = event.minute;
  if (minute <= 45) return "first_half";
  if (minute <= 90) return "second_half";
  if (minute <= 120) return "extra_time";
  return "penalty_shootout";
}

export function buildLiveTimeline(
  events: LiveEvents,
  status: LiveMatchStatus
): LiveTimeline {
  const grouped = new Map<LiveTimelineSegmentKey, LiveEvent[]>();
  const undated: LiveEvent[] = [];

  for (const event of events.items) {
    const key = segmentFor(event);
    if (!key) {
      undated.push(event);
      continue;
    }
    const bucket = grouped.get(key);
    if (bucket) bucket.push(event);
    else grouped.set(key, [event]);
  }

  const segments: LiveTimelineSegment[] = LIVE_TIMELINE_SEGMENTS.filter((definition) =>
    grouped.has(definition.key)
  ).map((definition) => ({
    key: definition.key,
    label: definition.label,
    fromMinute: definition.fromMinute,
    toMinute: definition.toMinute,
    events: grouped.get(definition.key) ?? [],
  }));

  const totalEvents = events.items.length;

  if (!totalEvents) {
    return {
      availability: events.availability,
      segments: [],
      totalEvents: 0,
      undatedEvents: [],
      message: events.message,
    };
  }

  return {
    availability: "available",
    segments,
    totalEvents,
    undatedEvents: undated,
    message:
      undated.length > 0
        ? `${undated.length} event${undated.length === 1 ? "" : "s"} reported without a match minute.`
        : status.phase === "pre_match"
          ? "Only pre-match markers are available."
          : null,
  };
}

/**
 * Which segments should start expanded. The current segment is open; earlier ones collapse so
 * a 90th-minute view does not open with 40 rows of first-half detail.
 */
export function defaultExpandedSegments(
  timeline: LiveTimeline,
  phase: LiveMatchPhase
): LiveTimelineSegmentKey[] {
  if (!timeline.segments.length) return [];
  const current: LiveTimelineSegmentKey | null =
    phase === "first_half"
      ? "first_half"
      : phase === "half_time"
        ? "first_half"
        : phase === "second_half"
          ? "second_half"
          : phase === "extra_time"
            ? "extra_time"
            : phase === "penalty_shootout"
              ? "penalty_shootout"
              : null;
  if (current && timeline.segments.some((segment) => segment.key === current)) {
    return [current];
  }
  const last = timeline.segments[timeline.segments.length - 1];
  return [last.key];
}

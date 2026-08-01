/**
 * Sprint 22 — screen-reader announcements.
 *
 * Turns the difference between two snapshots into a small, ranked set of sentences. Deliberately
 * conservative: corners and dangerous attacks are *not* announced, because a live region that
 * fires every fifteen seconds is worse for a screen-reader user than one that stays quiet.
 *
 * Pure module.
 */

import type {
  LiveAnnouncement,
  LiveAnnouncementPriority,
  LiveEvent,
  LiveEventType,
  LiveMatchSnapshot,
  LiveTeamSide,
} from "@/types/live";
import { LIVE_EVENT_LABEL } from "./events";

/** Event types worth interrupting for, and at what urgency. */
const ANNOUNCED_EVENTS: Partial<Record<LiveEventType, LiveAnnouncementPriority>> = {
  goal: "assertive",
  penalty: "assertive",
  red_card: "assertive",
  var: "polite",
  yellow_card: "polite",
  substitution: "polite",
  halftime: "polite",
  fulltime: "assertive",
};

/** Never announce more than this per update — a burst of catch-up events must not spam. */
export const MAX_ANNOUNCEMENTS_PER_UPDATE = 4;

function sideName(
  side: LiveTeamSide,
  snapshot: Pick<LiveMatchSnapshot, "homeTeam" | "awayTeam">
): string | null {
  if (side === "home") return snapshot.homeTeam;
  if (side === "away") return snapshot.awayTeam;
  return null;
}

function scoreSentence(snapshot: LiveMatchSnapshot): string | null {
  const { home, away } = snapshot.status.score;
  if (home == null || away == null) return null;
  return `${snapshot.homeTeam} ${home}, ${snapshot.awayTeam} ${away}`;
}

function clockSuffix(event: LiveEvent): string {
  if (event.minute == null) return "";
  return event.addedTime
    ? `, minute ${event.minute} plus ${event.addedTime}`
    : `, minute ${event.minute}`;
}

export function describeLiveEvent(
  event: LiveEvent,
  snapshot: LiveMatchSnapshot
): string {
  const team = sideName(event.side, snapshot);
  const head = LIVE_EVENT_LABEL[event.type];
  const who = team ? ` for ${team}` : "";
  const detail =
    event.label && event.label !== head ? `. ${event.label}` : "";
  return `${head}${who}${clockSuffix(event)}${detail}.`;
}

/**
 * Announcements for the transition `previous -> next`. Ordered assertive-first so the caller
 * can route them into the correct live region without re-sorting.
 */
export function buildLiveAnnouncements(
  previous: LiveMatchSnapshot | null,
  next: LiveMatchSnapshot
): LiveAnnouncement[] {
  if (!previous) return [];

  const out: LiveAnnouncement[] = [];
  const seen = new Set(previous.events.items.map((event) => event.id));

  for (const event of next.events.items) {
    if (seen.has(event.id)) continue;
    const priority = ANNOUNCED_EVENTS[event.type];
    if (!priority) continue;
    const score = priority === "assertive" ? scoreSentence(next) : null;
    out.push({
      id: `event-${event.id}`,
      priority,
      message: score
        ? `${describeLiveEvent(event, next)} ${score}.`
        : describeLiveEvent(event, next),
    });
  }

  // Phase transitions the event feed did not already cover (e.g. a feed with no HT marker).
  if (previous.status.phase !== next.status.phase) {
    const alreadyCovered = out.some(
      (announcement) =>
        announcement.id.includes("halftime") || announcement.id.includes("fulltime")
    );
    if (!alreadyCovered) {
      const score = scoreSentence(next);
      out.push({
        id: `phase-${next.status.phase}-${next.revision}`,
        priority: next.status.phase === "full_time" ? "assertive" : "polite",
        message: score
          ? `${next.status.label}. ${score}.`
          : `${next.status.label}.`,
      });
    }
  }

  // A score change with no corresponding event still has to reach a screen reader.
  const scoreChanged =
    previous.status.score.home !== next.status.score.home ||
    previous.status.score.away !== next.status.score.away;
  if (scoreChanged && !out.some((announcement) => announcement.priority === "assertive")) {
    const score = scoreSentence(next);
    if (score) {
      out.push({
        id: `score-${next.status.score.home}-${next.status.score.away}-${next.revision}`,
        priority: "assertive",
        message: `Score update. ${score}.`,
      });
    }
  }

  return out
    .sort(
      (a, b) =>
        Number(b.priority === "assertive") - Number(a.priority === "assertive")
    )
    .slice(0, MAX_ANNOUNCEMENTS_PER_UPDATE);
}

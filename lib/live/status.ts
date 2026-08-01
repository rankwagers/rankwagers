/**
 * Sprint 22 — LiveMatchStatus.
 *
 * Maps a raw provider status string (plus kickoff/minute) onto a live match phase.
 *
 * Deliberately stricter than `lib/fixtures/status.ts`: that module answers "what lifecycle
 * state is this fixture in?" for the whole match page, this one answers "is the ball in play
 * right now, and at what minute?" for the live layer. It never promotes a fixture to a live
 * phase from a passed kickoff alone — a stale feed must read as `unknown`, not as live.
 *
 * Pure module: the clock is injected, never read from `Date.now()` implicitly.
 */

import type {
  LiveFreshness,
  LiveMatchPhase,
  LiveMatchSource,
  LiveMatchStatus,
  LiveScore,
} from "@/types/live";

export const LIVE_PHASE_LABEL: Record<LiveMatchPhase, string> = {
  pre_match: "Pre-match",
  first_half: "First half",
  half_time: "Half-time",
  second_half: "Second half",
  extra_time: "Extra time",
  penalty_shootout: "Penalty shootout",
  full_time: "Full-time",
  interrupted: "Interrupted",
  unknown: "Status unavailable",
};

/** Phases during which the Live Match section is shown. */
const IN_PLAY_PHASES: ReadonlySet<LiveMatchPhase> = new Set<LiveMatchPhase>([
  "first_half",
  "half_time",
  "second_half",
  "extra_time",
  "penalty_shootout",
]);

/** Data older than this while in play is flagged rather than presented as current. */
export const LIVE_STALE_AFTER_SEC = 180;
export const LIVE_RECENT_AFTER_SEC = 75;

function normalize(raw: string | null | undefined): string {
  return (raw ?? "").toLowerCase().trim();
}

export function resolveLivePhase(input: {
  status?: string | null;
  minute?: number | null;
  kickoffUnix?: number | null;
  nowSec?: number;
}): LiveMatchPhase {
  const status = normalize(input.status);
  const minute = input.minute ?? null;

  if (!status) {
    // No status at all: only a future kickoff is safe to assert.
    if (input.kickoffUnix != null && input.nowSec != null && input.kickoffUnix > input.nowSec) {
      return "pre_match";
    }
    return "unknown";
  }

  if (/abandon|suspend|interrupt|postpon|cancel|delayed/.test(status)) return "interrupted";

  if (/pen(alty)?[\s_-]?shoot|\bpens?\b|\bpso\b/.test(status)) return "penalty_shootout";
  if (/\bet\b|extra[\s_-]?time|\baet\b/.test(status)) {
    // AET means the match is over; ET/extra time means it is ongoing.
    return /\baet\b/.test(status) ? "full_time" : "extra_time";
  }

  if (/^(ht|half[\s_-]?time)$/.test(status) || /half[\s_-]?time/.test(status)) {
    return "half_time";
  }

  if (/(^|[^a-z])(ft|complete|completed|finished|ended|full[\s_-]?time)([^a-z]|$)/.test(status)) {
    return "full_time";
  }

  if (/^(ns|not[\s_-]?started|scheduled|fixture|tbd|upcoming)$/.test(status)) {
    return "pre_match";
  }

  if (/^1h$|first[\s_-]?half/.test(status)) return "first_half";
  if (/^2h$|second[\s_-]?half/.test(status)) return "second_half";

  if (/live|in[\s_-]?play|inplay|playing|progress/.test(status)) {
    // Minute 91+ is far more often second-half stoppage time than extra time, and only an
    // explicit ET status justifies claiming extra time.
    if (minute != null && minute > 0) {
      return minute <= 45 ? "first_half" : "second_half";
    }
    // Live without a minute: real, but the half is unknown. `second_half` would be a guess.
    return "first_half";
  }

  return "unknown";
}

export function isLivePhase(phase: LiveMatchPhase): boolean {
  return IN_PLAY_PHASES.has(phase);
}

/**
 * The single visibility rule for the Live Match section. Exported so the server shell, the
 * client island and the tests all agree on one predicate.
 */
export function shouldRenderLiveSection(status: LiveMatchStatus): boolean {
  return status.isLive;
}

export function formatLiveClock(input: {
  phase: LiveMatchPhase;
  minute: number | null;
  addedTime: number | null;
}): string | null {
  switch (input.phase) {
    case "half_time":
      return "HT";
    case "full_time":
      return "FT";
    case "penalty_shootout":
      return "PENS";
    case "pre_match":
    case "unknown":
      return null;
    default:
      break;
  }
  if (input.minute == null) return null;
  return input.addedTime ? `${input.minute}+${input.addedTime}'` : `${input.minute}'`;
}

export function resolveLiveFreshness(input: {
  isLive: boolean;
  updatedAt: string | null;
  nowSec: number;
}): LiveFreshness {
  if (!input.updatedAt) return "unknown";
  const parsed = Date.parse(input.updatedAt);
  if (!Number.isFinite(parsed)) return "unknown";
  const ageSec = input.nowSec - Math.floor(parsed / 1000);
  if (ageSec < 0) return "unknown";
  if (!input.isLive) return "recent";
  if (ageSec <= LIVE_RECENT_AFTER_SEC) return "live";
  if (ageSec <= LIVE_STALE_AFTER_SEC) return "recent";
  return "stale";
}

function score(home: number | null | undefined, away: number | null | undefined): LiveScore {
  return {
    home: typeof home === "number" && Number.isFinite(home) ? home : null,
    away: typeof away === "number" && Number.isFinite(away) ? away : null,
  };
}

export function buildLiveMatchStatus(source: LiveMatchSource): LiveMatchStatus {
  const nowSec = source.nowSec ?? Math.floor(Date.now() / 1000);
  const phase = resolveLivePhase({
    status: source.status,
    minute: source.minute,
    kickoffUnix: source.kickoffUnix,
    nowSec,
  });
  const isLive = isLivePhase(phase);

  // Minute is only meaningful while the ball is in play; a stale "90" on a finished fixture
  // would read as if the match were still running.
  const minute =
    isLive && phase !== "half_time" && source.minute != null && source.minute > 0
      ? Math.min(Math.floor(source.minute), 150)
      : null;
  const addedTime =
    minute != null && source.addedTime != null && source.addedTime > 0
      ? Math.floor(source.addedTime)
      : null;

  const showScore = isLive || phase === "full_time";
  const updatedAt = source.fetchedAt ?? null;

  return {
    phase,
    isLive,
    label: LIVE_PHASE_LABEL[phase],
    minute,
    addedTime,
    clockLabel: formatLiveClock({ phase, minute, addedTime }),
    score: showScore ? score(source.homeScore, source.awayScore) : { home: null, away: null },
    htScore: score(source.htHome, source.htAway),
    updatedAt,
    freshness: resolveLiveFreshness({ isLive, updatedAt, nowSec }),
    interruptionReason:
      phase === "interrupted"
        ? `Provider reports the fixture as ${normalize(source.status) || "interrupted"}.`
        : null,
  };
}

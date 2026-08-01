/**
 * Sprint 22 — LiveEvents.
 *
 * Normalises a heterogeneous provider event feed into the supported vocabulary. Anything the
 * feed reports that does not map onto a known type is dropped rather than rendered as
 * "other" noise, and anything the feed omits (minute, side, score) stays `null`.
 *
 * Pure module: no I/O, no clock, no React.
 */

import type {
  LiveEvent,
  LiveEventInput,
  LiveEventType,
  LiveEvents,
  LiveMatchStatus,
  LiveScore,
  LiveTeamSide,
} from "@/types/live";

/** Runtime source of truth for the supported vocabulary. */
export const LIVE_EVENT_TYPES = [
  "kickoff",
  "halftime",
  "fulltime",
  "goal",
  "penalty",
  "var",
  "yellow_card",
  "red_card",
  "substitution",
  "corner",
  "dangerous_attack",
] as const satisfies readonly LiveEventType[];

export const LIVE_EVENT_LABEL: Record<LiveEventType, string> = {
  kickoff: "Kick-off",
  halftime: "Half-time",
  fulltime: "Full-time",
  goal: "Goal",
  penalty: "Penalty",
  var: "VAR",
  yellow_card: "Yellow card",
  red_card: "Red card",
  substitution: "Substitution",
  corner: "Corner",
  dangerous_attack: "Dangerous attack",
};

/** Visual + semantic weight. `critical` events are announced assertively to screen readers. */
export type LiveEventTone = "critical" | "warning" | "phase" | "neutral";

export const LIVE_EVENT_TONE: Record<LiveEventType, LiveEventTone> = {
  kickoff: "phase",
  halftime: "phase",
  fulltime: "phase",
  goal: "critical",
  penalty: "critical",
  red_card: "critical",
  var: "warning",
  yellow_card: "warning",
  substitution: "neutral",
  corner: "neutral",
  dangerous_attack: "neutral",
};

/** Short glyph shown inside the badge. Text, not icon fonts — survives SSR and copy/paste. */
export const LIVE_EVENT_GLYPH: Record<LiveEventType, string> = {
  kickoff: "KO",
  halftime: "HT",
  fulltime: "FT",
  goal: "GOAL",
  penalty: "PEN",
  var: "VAR",
  yellow_card: "YC",
  red_card: "RC",
  substitution: "SUB",
  corner: "COR",
  dangerous_attack: "ATT",
};

const EVENT_TYPE_SET = new Set<string>(LIVE_EVENT_TYPES);

/**
 * Ordered longest-token-first so `red card` is not swallowed by a `card` rule and
 * `penalty shootout` does not read as a goal.
 */
const EVENT_ALIASES: Array<[RegExp, LiveEventType]> = [
  [/\bvar\b|video assistant|video review/, "var"],
  [/red[\s_-]?card|sending[\s_-]?off|\bsent off\b|\bdismiss/, "red_card"],
  [/second[\s_-]?yellow/, "red_card"],
  [/yellow[\s_-]?card|\bbooking\b|\bbooked\b|\bcaution/, "yellow_card"],
  [/penalt/, "penalty"],
  [/sub(stitut)?(ion)?\b|\bsub\b/, "substitution"],
  [/corner/, "corner"],
  [/dangerous[\s_-]?attack/, "dangerous_attack"],
  [/kick[\s_-]?off|\bko\b|match started|first half start/, "kickoff"],
  [/half[\s_-]?time|\bht\b/, "halftime"],
  [/full[\s_-]?time|\bft\b|match ended|match finished/, "fulltime"],
  [/goal|scored|scorer/, "goal"],
];

export function normalizeLiveEventType(raw: unknown): LiveEventType | null {
  if (typeof raw !== "string") return null;
  const value = raw.toLowerCase().trim();
  if (!value) return null;
  if (EVENT_TYPE_SET.has(value)) return value as LiveEventType;
  for (const [pattern, type] of EVENT_ALIASES) {
    if (pattern.test(value)) return type;
  }
  return null;
}

function normalizeSide(raw: unknown): LiveTeamSide {
  if (typeof raw !== "string") return "neutral";
  const value = raw.toLowerCase().trim();
  if (value === "home" || value === "h" || value === "team_a") return "home";
  if (value === "away" || value === "a" || value === "team_b") return "away";
  return "neutral";
}

function toMinute(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(/['\s]/g, ""));
  if (!Number.isFinite(n)) return null;
  // Guard against provider junk; a football clock beyond 150 is not a real minute.
  if (n < 0 || n > 150) return null;
  return Math.floor(n);
}

function normalizeScore(raw: unknown): LiveScore | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as { home?: unknown; away?: unknown };
  const home = typeof row.home === "number" && Number.isFinite(row.home) ? row.home : null;
  const away = typeof row.away === "number" && Number.isFinite(row.away) ? row.away : null;
  if (home == null && away == null) return null;
  return { home, away };
}

/**
 * Normalise one raw event. Returns `null` when the event cannot be classified — callers must
 * not substitute a placeholder, because an unclassified marker on a live timeline is worse
 * than an absent one.
 */
export function normalizeLiveEvent(
  input: LiveEventInput,
  index: number
): LiveEvent | null {
  const type =
    normalizeLiveEventType(input.type) ??
    normalizeLiveEventType(input.label) ??
    normalizeLiveEventType(input.detail);
  if (!type) return null;

  const minute = toMinute(input.minute);
  const addedTime = toMinute(input.addedTime);
  const label =
    typeof input.label === "string" && input.label.trim()
      ? input.label.trim().slice(0, 120)
      : LIVE_EVENT_LABEL[type];
  const detail =
    typeof input.detail === "string" && input.detail.trim()
      ? input.detail.trim().slice(0, 200)
      : null;

  const id =
    typeof input.id === "string" && input.id.trim()
      ? input.id.trim()
      : `${type}-${minute ?? "x"}-${index}`;

  return {
    id,
    type,
    minute,
    addedTime: addedTime && addedTime > 0 ? addedTime : null,
    side: normalizeSide(input.side),
    label,
    detail: detail && detail === label ? null : detail,
    origin: input.origin === "derived" ? "derived" : "provider",
    scoreAfter: normalizeScore(input.scoreAfter),
  };
}

/** Chronological, stable. Undated events sink to the end preserving feed order. */
export function sortLiveEvents(events: LiveEvent[]): LiveEvent[] {
  return events
    .map((event, index) => ({ event, index }))
    .sort((a, b) => {
      const am = a.event.minute;
      const bm = b.event.minute;
      if (am == null && bm == null) return a.index - b.index;
      if (am == null) return 1;
      if (bm == null) return -1;
      if (am !== bm) return am - bm;
      const aa = a.event.addedTime ?? 0;
      const ba = b.event.addedTime ?? 0;
      if (aa !== ba) return aa - ba;
      return a.index - b.index;
    })
    .map((row) => row.event);
}

/**
 * Phase markers derived from the observed status. These are `origin: "derived"` because the
 * feed reported the phase, not the event; the minutes are the laws-of-the-game boundaries,
 * not measurements.
 */
export function derivePhaseEvents(status: LiveMatchStatus): LiveEvent[] {
  const out: LiveEvent[] = [];
  const reached = (phase: string) => {
    switch (phase) {
      case "pre_match":
      case "unknown":
        return 0;
      case "first_half":
        return 1;
      case "half_time":
        return 2;
      case "second_half":
        return 3;
      case "extra_time":
      case "penalty_shootout":
        return 4;
      case "full_time":
        return 5;
      case "interrupted":
        // An interrupted match definitely kicked off; nothing beyond that is safe to assume.
        return 1;
      default:
        return 0;
    }
  };
  const level = reached(status.phase);
  if (level >= 1) {
    out.push(derived("kickoff", 0, "Kick-off", null));
  }
  if (level >= 2) {
    const score = status.htScore.home != null ? status.htScore : null;
    out.push(
      derived(
        "halftime",
        45,
        "Half-time",
        score ? `Half-time score ${score.home}–${score.away}` : null,
        score
      )
    );
  }
  if (level >= 5) {
    const score = status.score.home != null ? status.score : null;
    out.push(
      derived(
        "fulltime",
        90,
        "Full-time",
        score ? `Final score ${score.home}–${score.away}` : null,
        score
      )
    );
  }
  return out;
}

function derived(
  type: LiveEventType,
  minute: number,
  label: string,
  detail: string | null,
  scoreAfter: LiveScore | null = null
): LiveEvent {
  return {
    id: `derived-${type}`,
    type,
    minute,
    addedTime: null,
    side: "neutral",
    label,
    detail,
    origin: "derived",
    scoreAfter,
  };
}

/** Deduplicate by id, keeping the first occurrence (provider events precede derived ones). */
export function dedupeLiveEvents(events: LiveEvent[]): LiveEvent[] {
  const seen = new Set<string>();
  const out: LiveEvent[] = [];
  for (const event of events) {
    if (seen.has(event.id)) continue;
    seen.add(event.id);
    out.push(event);
  }
  return out;
}

/** Hard cap so a pathological feed cannot blow up the payload or the DOM. */
export const MAX_LIVE_EVENTS = 120;

export function buildLiveEvents(
  inputs: LiveEventInput[] | undefined,
  options: { status: LiveMatchStatus; includeDerivedPhases?: boolean }
): LiveEvents {
  const hasFeed = Array.isArray(inputs);
  const normalized = (inputs ?? [])
    .map((input, index) => normalizeLiveEvent(input, index))
    .filter((event): event is LiveEvent => event !== null);

  const derivedPhases =
    options.includeDerivedPhases === false ? [] : derivePhaseEvents(options.status);

  const merged = dedupeLiveEvents(sortLiveEvents([...normalized, ...derivedPhases])).slice(
    0,
    MAX_LIVE_EVENTS
  );

  if (!merged.length) {
    return {
      availability: hasFeed ? "empty" : "unavailable",
      items: [],
      message: hasFeed
        ? "No match events have been reported yet."
        : "The provider does not expose an event feed for this fixture.",
    };
  }

  // A timeline containing only derived phase markers is honest but thin — say so.
  const providerCount = merged.filter((event) => event.origin === "provider").length;
  return {
    availability: "available",
    items: merged,
    message:
      providerCount === 0
        ? "Only match-phase markers are available; the provider reported no in-play events."
        : null,
  };
}

export function isCriticalLiveEvent(event: LiveEvent): boolean {
  return LIVE_EVENT_TONE[event.type] === "critical";
}

/** `45+2'` / `63'` / `—` */
export function formatEventClock(event: Pick<LiveEvent, "minute" | "addedTime">): string {
  if (event.minute == null) return "—";
  return event.addedTime ? `${event.minute}+${event.addedTime}'` : `${event.minute}'`;
}

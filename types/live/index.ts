/**
 * Sprint 22 — Live Match Intelligence contracts.
 *
 * Browser-safe: no `server-only`, no provider clients, no node builtins. Every shape here is
 * plain JSON so it can cross the server → client boundary and be diffed structurally.
 *
 * Design rule inherited from the product manifesto: nothing in this layer may invent state.
 * When the upstream feed does not report something, the contract carries an explicit
 * `LiveAvailability` value and a human-readable message instead of a fabricated number.
 */

/** Tri-state availability used by every live section. */
export type LiveAvailability =
  /** Provider reported usable data. */
  | "available"
  /** Provider feed is reachable but has nothing yet (e.g. 3rd minute, no events). */
  | "empty"
  /** Provider does not expose this data for the fixture at all. */
  | "unavailable";

export type LiveTeamSide = "home" | "away" | "neutral";

/* ------------------------------------------------------------------ *
 * LiveEvents
 * ------------------------------------------------------------------ */

/**
 * Supported live event vocabulary. Ordering is not significant; `LIVE_EVENT_TYPES` in
 * `lib/live/events.ts` is the runtime source of truth and is asserted against this union.
 */
export type LiveEventType =
  | "kickoff"
  | "halftime"
  | "fulltime"
  | "goal"
  | "penalty"
  | "var"
  | "yellow_card"
  | "red_card"
  | "substitution"
  | "corner"
  | "dangerous_attack";

/** How an event entered the model. `derived` events are computed from status, never guessed. */
export type LiveEventOrigin = "provider" | "derived";

export type LiveScore = {
  home: number | null;
  away: number | null;
};

export type LiveEvent = {
  /** Stable within a snapshot; used as the React key and for diff identity. */
  id: string;
  type: LiveEventType;
  /** Match minute. `null` when the feed omits it — never back-filled from wall clock. */
  minute: number | null;
  /** Stoppage-time offset (the `+3` in `45+3`), when the feed distinguishes it. */
  addedTime: number | null;
  side: LiveTeamSide;
  /** Short human label, e.g. a scorer name or "VAR review". */
  label: string;
  /** Optional secondary line, e.g. "Penalty awarded". */
  detail: string | null;
  origin: LiveEventOrigin;
  /** Scoreline immediately after this event, when the feed reports it. */
  scoreAfter: LiveScore | null;
};

/** Raw, pre-normalisation event as handed in by an adapter. */
export type LiveEventInput = {
  id?: string | null;
  type?: string | null;
  minute?: number | string | null;
  addedTime?: number | string | null;
  side?: string | null;
  label?: string | null;
  detail?: string | null;
  origin?: LiveEventOrigin;
  scoreAfter?: LiveScore | null;
};

export type LiveEvents = {
  availability: LiveAvailability;
  items: LiveEvent[];
  message: string | null;
};

/* ------------------------------------------------------------------ *
 * LiveMatchStatus
 * ------------------------------------------------------------------ */

export type LiveMatchPhase =
  | "pre_match"
  | "first_half"
  | "half_time"
  | "second_half"
  | "extra_time"
  | "penalty_shootout"
  | "full_time"
  | "interrupted"
  | "unknown";

/** How much the displayed data can be trusted as "now". */
export type LiveFreshness = "live" | "recent" | "stale" | "unknown";

export type LiveMatchStatus = {
  phase: LiveMatchPhase;
  /** True only for phases where the ball is (or can be) in play. Drives section visibility. */
  isLive: boolean;
  label: string;
  minute: number | null;
  addedTime: number | null;
  /** Pre-formatted clock, e.g. `63'`, `45+2'`, `HT`, `FT`, or null when unknown. */
  clockLabel: string | null;
  score: LiveScore;
  htScore: LiveScore;
  updatedAt: string | null;
  freshness: LiveFreshness;
  /** Set when the fixture is interrupted (suspended / abandoned / postponed). */
  interruptionReason: string | null;
};

/* ------------------------------------------------------------------ *
 * LiveStatistics
 * ------------------------------------------------------------------ */

export type LiveStatisticKey =
  | "possession"
  | "shots"
  | "shots_on_target"
  | "corners"
  | "dangerous_attacks"
  | "yellow_cards"
  | "red_cards"
  | "expected_goals";

export type LiveStatisticUnit = "percent" | "count" | "xg";

export type LiveStatistic = {
  key: LiveStatisticKey;
  label: string;
  unit: LiveStatisticUnit;
  home: number | null;
  away: number | null;
  availability: LiveAvailability;
  /**
   * Home share of the pair, 0..1, for bar rendering. `null` when the pair sums to zero or
   * either side is missing — the UI must render "—" rather than a 50/50 bar in that case.
   */
  homeShare: number | null;
};

export type LiveStatistics = {
  availability: LiveAvailability;
  items: LiveStatistic[];
  message: string | null;
};

export type LiveStatisticInput = {
  home: number | null;
  away: number | null;
};

/* ------------------------------------------------------------------ *
 * LiveTimeline
 * ------------------------------------------------------------------ */

export type LiveTimelineSegmentKey =
  | "first_half"
  | "half_time"
  | "second_half"
  | "extra_time"
  | "penalty_shootout";

export type LiveTimelineSegment = {
  key: LiveTimelineSegmentKey;
  label: string;
  /** Inclusive minute bounds; `to` is null for open-ended segments. */
  fromMinute: number;
  toMinute: number | null;
  events: LiveEvent[];
};

export type LiveTimeline = {
  availability: LiveAvailability;
  segments: LiveTimelineSegment[];
  totalEvents: number;
  /** Events the feed reported without a minute; surfaced separately, never silently dropped. */
  undatedEvents: LiveEvent[];
  message: string | null;
};

/* ------------------------------------------------------------------ *
 * LiveMomentum
 * ------------------------------------------------------------------ */

export type LiveMomentumCoverage = "observed" | "sparse" | "none";

export type LiveMomentumPoint = {
  /** Bucket start minute, inclusive. */
  fromMinute: number;
  /** Bucket end minute, inclusive. */
  toMinute: number;
  label: string;
  /** Weighted pressure share 0..100. `home + away === 100` when any weight exists. */
  home: number;
  away: number;
  /** Signed −100..100; positive favours home. */
  swing: number;
  /** Number of weighted events observed in this bucket. */
  eventCount: number;
  coverage: LiveMomentumCoverage;
};

export type LiveMomentum = {
  availability: LiveAvailability;
  points: LiveMomentumPoint[];
  leader: LiveTeamSide;
  /** Overall home pressure share 0..100, or null when nothing measurable exists. */
  homeSharePct: number | null;
  /**
   * Plain-language statement of exactly which observations produced this reading.
   * Required by the evidence discipline — momentum is derived, never provider-reported.
   */
  method: string;
  message: string | null;
};

/* ------------------------------------------------------------------ *
 * Snapshot
 * ------------------------------------------------------------------ */

/** Diffable top-level sections. Each is replaced wholesale or not at all. */
export type LiveSliceKey = "status" | "events" | "timeline" | "momentum" | "statistics";

export type LiveMatchSnapshot = {
  matchId: number;
  homeTeam: string;
  awayTeam: string;
  homeLogo: string | null;
  awayLogo: string | null;
  competition: string | null;
  country: string | null;
  status: LiveMatchStatus;
  events: LiveEvents;
  timeline: LiveTimeline;
  momentum: LiveMomentum;
  statistics: LiveStatistics;
  /** Monotonic; only incremented when at least one slice actually changed. */
  revision: number;
  generatedAt: string;
};

/** Provider-neutral input consumed by `buildLiveMatchSnapshot`. */
export type LiveMatchSource = {
  matchId: number;
  homeTeam: string;
  awayTeam: string;
  homeLogo?: string | null;
  awayLogo?: string | null;
  competition?: string | null;
  country?: string | null;
  /** Raw provider status string; interpreted, never trusted verbatim. */
  status?: string | null;
  kickoffUnix?: number | null;
  minute?: number | null;
  addedTime?: number | null;
  homeScore?: number | null;
  awayScore?: number | null;
  htHome?: number | null;
  htAway?: number | null;
  events?: LiveEventInput[];
  statistics?: Partial<Record<LiveStatisticKey, LiveStatisticInput>>;
  fetchedAt?: string | null;
  /** Injectable clock for deterministic tests. Seconds since epoch. */
  nowSec?: number;
};

/* ------------------------------------------------------------------ *
 * Incremental update contracts
 * ------------------------------------------------------------------ */

export type LiveAnnouncementPriority = "assertive" | "polite";

export type LiveAnnouncement = {
  id: string;
  priority: LiveAnnouncementPriority;
  message: string;
};

export type LiveUpdateResult = {
  /** Unchanged slices keep their previous object identity so consumers can bail out. */
  snapshot: LiveMatchSnapshot;
  changed: LiveSliceKey[];
  announcements: LiveAnnouncement[];
};

export type LiveStoreListener = (result: LiveUpdateResult) => void;

export type LiveStore = {
  getSnapshot(): LiveMatchSnapshot;
  getSlice<K extends LiveSliceKey>(key: K): LiveMatchSnapshot[K];
  subscribe(listener: LiveStoreListener): () => void;
  apply(next: LiveMatchSnapshot): LiveUpdateResult;
  getAnnouncements(): LiveAnnouncement[];
};

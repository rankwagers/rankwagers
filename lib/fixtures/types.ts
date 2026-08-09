/**
 * Shared match-detail contracts (browser-safe).
 * No node:crypto, no secrets, no provider clients.
 */

export type MatchLifecycleStatus =
  | "scheduled"
  | "pre_match"
  | "live"
  | "half_time"
  | "finished"
  | "postponed"
  | "cancelled"
  | "abandoned"
  | "suspended"
  | "unavailable";

export type PredictionSettlementStatus =
  | "pending"
  | "won"
  | "lost"
  | "void"
  | "push"
  | "cancelled";

/** Markets with deterministic settlement from available score fields. */
export type SettledMarketKey =
  | "over15"
  | "over25"
  | "fh"
  | "sh"
  | "btts"
  | "match_winner"
  | "double_chance"
  | "draw_no_bet";

export type MatchScoreline = {
  home: number | null;
  away: number | null;
};

export type MatchEventType = "goal" | "red_card" | "other";

export type MatchEvent = {
  id: string;
  type: MatchEventType;
  minute: number | null;
  team: "home" | "away" | "unknown";
  label: string;
};

export type MatchStatisticAvailability = "available" | "unavailable" | "empty";

export type MatchStatistic = {
  key: string;
  label: string;
  home: number | null;
  away: number | null;
  availability: MatchStatisticAvailability;
};

export type MatchPredictionView = {
  id: string;
  marketKey: SettledMarketKey;
  marketLabel: string;
  selection: string;
  confidence: number | null;
  publishedAt: string | null;
  originalOdds: number | null;
  currentOdds: number | null;
  status: PredictionSettlementStatus;
  unitProfit: number | null;
  settlementReason: string;
  evidenceSummary: string[];
  timeline: PredictionTimelineItem[];
  /** True when this row was derived at or after kickoff — labeled and excluded from settlement. */
  capturedAfterKickoff: boolean;
};

export type PredictionTimelineItem = {
  id: string;
  at: string | null;
  label: string;
  detail?: string;
};

export type MatchPageHeader = {
  matchId: number;
  homeTeam: string;
  awayTeam: string;
  homeLogo?: string;
  awayLogo?: string;
  competition: string;
  competitionSlug: string | null;
  country: string;
  venue: string | null;
  kickoffAt: string | null;
  lifecycle: MatchLifecycleStatus;
  statusLabel: string;
  minute: number | null;
  score: MatchScoreline;
  htScore: MatchScoreline;
  ftScore: MatchScoreline;
  isLive: boolean;
  isFinished: boolean;
  dataFreshness: "live_ok" | "stale_risk" | "snapshot" | "unavailable";
  lastUpdatedAt: string | null;
};

export type MatchPageSections = {
  events: {
    availability: MatchStatisticAvailability;
    items: MatchEvent[];
    message: string | null;
  };
  statistics: {
    availability: MatchStatisticAvailability;
    items: MatchStatistic[];
    message: string | null;
  };
};

export type MatchPageModel = {
  header: MatchPageHeader;
  sections: MatchPageSections;
  predictions: MatchPredictionView[];
  /** Markets intentionally not settled/published on this page. */
  deferredMarkets: string[];
  related: {
    competitionHref: string | null;
    homeTeamHref: string | null;
    awayTeamHref: string | null;
    homeHref: string;
  };
  indexable: boolean;
  refreshPolicy: {
    mode: "none" | "live_soft";
    intervalSec: number | null;
  };
};

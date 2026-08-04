import type { ResearchRun } from "@/lib/research/researchRun";

export type MatchListKind = "fh" | "over15" | "over25" | "sh";

export type FootyMatchRow = {
  matchId: number;
  homeTeam: string;
  awayTeam: string;
  homeImage?: string;
  awayImage?: string;
  leagueImage?: string;
  competition: string;
  country: string;
  countryCode?: string;
  flag: string;
  kickoffTime: number;
  kickoff: string;
  over15Pct: number;
  fhOver05Pct: number;
  over25Pct: number;
  shOver05Pct: number;
  status: string;
  isLive: boolean;
  isFinished: boolean;
  homeScore: number;
  awayScore: number;
  htHome?: number | null;
  htAway?: number | null;
  htGoalCount?: number | null;
  minute: number;
  /** Primary % for the active list tab */
  highlightPct: number;
  /** Set when loaded from daily archive */
  listResult?: "won" | "lost" | "pending" | "postponed";
};

/**
 * Where a day's lists actually came from.
 *
 * `fresh_provider` covers a successful provider response INCLUDING a successful empty one — an
 * empty day is a fact, not a failure, and must never be replaced by archived data.
 */
export type DailyListsSource =
  | "fresh_provider"
  /**
   * The last successful fetch of THIS date's lists, replayed from disk because the provider is
   * failing now. Carries its original `fetchedAt`, so the page states when it was true. A display
   * fallback only — capture refuses it (`assertLiveSource`).
   */
  | "last_good"
  | "stale_daily_archive"
  | "unavailable";

/**
 * Bounded provenance for a day's lists. Reason codes come from the fixed `ProviderErrorCode` set,
 * so nothing here has unbounded cardinality and nothing carries a key, URL, credential or payload.
 */
export type DailyListsProvenance = {
  source: DailyListsSource;
  requestedDate: string;
  /** `savedAt` of the archive actually served. Only set for `stale_daily_archive`. */
  archiveCapturedAt?: string;
  /** Age of that archive in whole seconds at read time. Only set for `stale_daily_archive`. */
  archiveAgeSeconds?: number;
  /** Provider failure code that forced the fallback, e.g. `circuit_open`, `timeout`. */
  providerFailureReasonCode?: string;
};

export type DailyMatchLists = {
  date: string;
  over15: FootyMatchRow[];
  fh: FootyMatchRow[];
  over25: FootyMatchRow[];
  sh: FootyMatchRow[];
  fetchedAt: string;
  /**
   * Optional so every existing consumer and every stored archive stays valid unchanged. Absent
   * means "not recorded" and is treated as fresh by consumers that care.
   */
  provenance?: DailyListsProvenance;
  /**
   * Stage counts observed while these lists were built (rwdesign §6).
   *
   * Optional for the same reason as `provenance`: every stored archive predates it and stays
   * valid. Absent means the run was not instrumented — which is NOT the same as a run whose
   * stages were all null, and consumers must treat both as "no observation" rather than as zero.
   */
  researchRun?: ResearchRun;
};

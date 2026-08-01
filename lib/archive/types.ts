/**
 * Archive & transparency contracts (browser-safe, Flutter-ready).
 * Sourced from durable daily list archives — never invents ROI or odds.
 */

import type { MatchListKind } from "@/lib/footystats/types";

export type ArchiveResultStatus = "won" | "lost" | "void" | "pending";

export type ArchiveMarketKey = MatchListKind;

/** One archived qualified-list prediction (immutable for display once settled). */
export type ArchivePredictionRecord = {
  id: string;
  date: string;
  matchId: number;
  homeTeam: string;
  awayTeam: string;
  competition: string;
  country: string | null;
  countryCode: string | null;
  marketKey: ArchiveMarketKey;
  marketLabel: string;
  selectionLabel: string;
  /** Model probability at list qualification (0–100). */
  confidence: number | null;
  kickoffAt: string | null;
  /** Best available publication proxy — archive save time for the day. */
  publishedAt: string | null;
  status: ArchiveResultStatus;
  scoreLabel: string;
  settlementReason: string;
  evidenceSummary: string[];
  matchHref: string;
  /** Not available in daily list archives — never fabricated. */
  originalOdds: number | null;
  unitProfit: number | null;
};

export type TransparencyMetrics = {
  availability: "available" | "unavailable";
  windowLabel: string;
  lastUpdatedAt: string | null;
  totalPredictions: number;
  settledPredictions: number;
  pendingPredictions: number;
  voidPredictions: number;
  won: number;
  lost: number;
  hitRatePct: number | null;
  sampleNote: string;
  /** Omitted until durable publication odds exist. */
  averageOdds: null;
  byMarket: Array<{
    marketKey: ArchiveMarketKey;
    marketLabel: string;
    total: number;
    won: number;
    lost: number;
    pending: number;
    voided: number;
    hitRatePct: number | null;
  }>;
  byCompetition: Array<{
    competition: string;
    total: number;
    won: number;
    lost: number;
    hitRatePct: number | null;
  }>;
};

export type ArchiveFilters = {
  market?: ArchiveMarketKey | "all";
  status?: ArchiveResultStatus | "all";
  competition?: string;
  team?: string;
  q?: string;
};

export type ArchivePageResult = {
  records: ArchivePredictionRecord[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  filters: ArchiveFilters;
};

export type ArchiveDayModel = {
  date: string;
  savedAt: string;
  metrics: TransparencyMetrics;
  records: ArchivePredictionRecord[];
  indexable: boolean;
};

export type ArchiveHubModel = {
  dates: string[];
  metrics: TransparencyMetrics;
  recentRecords: ArchivePredictionRecord[];
  indexable: boolean;
};

export const ARCHIVE_PAGE_SIZE = 25;
export const ARCHIVE_MIN_DAY_ROWS = 3;

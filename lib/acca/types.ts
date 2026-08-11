/**
 * Acca Studio domain contracts (browser-safe, Flutter-ready).
 * No React, no node:crypto, no secrets.
 */

/** Markets Acca may expose — must have deterministic settlement support. */
export type AccaMarketKey =
  | "over15"
  | "over25"
  | "btts"
  | "fh"
  | "sh"
  | "match_winner";

export type AccaSelectionStatus =
  | "pending"
  | "won"
  | "lost"
  | "void"
  | "push"
  | "cancelled"
  | "unknown";

export type AccaSelectionSource =
  | "homepage"
  | "top_picks"
  | "explorer"
  | "match_detail"
  | "competition"
  | "team"
  | "country"
  | "search"
  | "recent_results"
  | "studio"
  | "share"
  | "builder"
  | "other";

export type AccaSelection = {
  /** Stable id: `{matchId}:{marketKey}:{selectionKey}` */
  id: string;
  matchId: number;
  homeTeam: string;
  awayTeam: string;
  competition: string;
  competitionSlug: string | null;
  countryCode: string | null;
  kickoffAt: string | null;
  marketKey: AccaMarketKey;
  marketLabel: string;
  /** Human selection label e.g. "Over 2.5", "Yes", "Home" */
  selectionLabel: string;
  selectionKey: string;
  /** Decimal odds when observed; null if unavailable (never invent). */
  odds: number | null;
  /** Model / publication confidence 0–100 when known. */
  confidence: number | null;
  evidenceSummary: string[];
  publishedAt: string | null;
  status: AccaSelectionStatus;
  matchHref: string;
  source: AccaSelectionSource;
  addedAt: string;
};

export type AccaRiskClass =
  | "low_risk"
  | "balanced"
  | "aggressive"
  | "very_aggressive";

export type AccaRiskAssessment = {
  class: AccaRiskClass;
  label: string;
  reasons: string[];
  /** Average selection confidence when available; null otherwise. */
  averageConfidence: number | null;
  limitations: string[];
};

export type AccaStakeModel = {
  /** Currency-neutral stake units (not a real wallet). */
  stake: number;
  combinedOdds: number | null;
  potentialReturn: number | null;
  potentialProfit: number | null;
  oddsComplete: boolean;
  missingOddsCount: number;
};

export type AccaSlip = {
  /** Stable slip id for share / future sync. */
  id: string;
  name: string | null;
  selections: AccaSelection[];
  stake: number;
  locale: string;
  updatedAt: string;
  createdAt: string;
};

export type NamedAcca = {
  id: string;
  name: string;
  slip: AccaSlip;
  savedAt: string;
};

export type AccaAddResult =
  | { ok: true; slip: AccaSlip; action: "added" | "replaced" | "already_present" }
  | {
      ok: false;
      code: "duplicate_fixture" | "unsupported_market" | "max_selections" | "invalid";
      message: string;
      slip: AccaSlip;
    };

export type AccaSharePayloadV1 = {
  v: 1;
  id: string;
  name: string | null;
  stake: number;
  selections: Array<{
    matchId: number;
    marketKey: AccaMarketKey;
    selectionKey: string;
    selectionLabel: string;
    homeTeam: string;
    awayTeam: string;
    competition: string;
    odds: number | null;
    confidence: number | null;
    kickoffAt: string | null;
  }>;
};

export type AccaOperatorOffer = {
  slug: string;
  name: string;
  rank: number;
  /** Availability is a precondition: no signedHref without it. */
  available: boolean;
  verified: boolean;
  /** Stored publication odds for the slip's fixtures — empty means not observed. */
  observedOdds: Array<{ market: string; decimal: number; observedAt: string }>;
  signedHref: string | null;
  /** The canonical operator page (the reviews route is retired). */
  detailHref: string;
};

export const ACCA_STORAGE_EVENT = "rankwagers:acca-changed";
export const ACCA_MAX_SELECTIONS = 8;
export const ACCA_DEFAULT_STAKE = 10;
export const ACCA_UNDO_LIMIT = 12;

/**
 * Evidence-Based Acca Builder contracts (browser-safe, Flutter-ready).
 * Reuses Acca Studio selection identity — does not duplicate the slip model.
 */

import type { AccaMarketKey, AccaSelectionDraft } from "@/lib/acca";

export type AccaBuilderRiskMode = "conservative" | "balanced" | "aggressive";

/** Markets the builder may select from daily published lists. */
export type AccaBuilderMarketKey = Extract<
  AccaMarketKey,
  "over15" | "over25" | "fh" | "sh"
>;

export type AccaBuilderConfig = {
  locale: string;
  riskMode: AccaBuilderRiskMode;
  legCount: number;
  minConfidence: number;
  markets: AccaBuilderMarketKey[];
  competitions: string[];
  countries: string[];
  excludedTeams: string[];
  excludedCompetitions: string[];
  /** Inclusive decimal range; only used when real odds exist. */
  targetOddsMin: number | null;
  targetOddsMax: number | null;
  preMatchOnly: boolean;
  includeLive: boolean;
  oneSelectionPerFixture: boolean;
};

export type AccaBuilderCandidate = {
  id: string;
  matchId: number;
  homeTeam: string;
  awayTeam: string;
  competition: string;
  countryCode: string | null;
  kickoffAt: string;
  marketKey: AccaBuilderMarketKey;
  marketLabel: string;
  selectionKey: string;
  selectionLabel: string;
  confidence: number;
  odds: number | null;
  oddsFetchedAt: string | null;
  oddsFreshness: "current" | "stale" | "unavailable";
  evidenceSummary: string[];
  evidenceCompleteness: number;
  matchHref: string;
  score: number;
  scoreParts: Record<string, number>;
  exclusionReasons: string[];
  eligible: boolean;
};

export type AccaBuilderCombination = {
  id: string;
  label: "recommended" | "safer" | "higher_risk";
  riskMode: AccaBuilderRiskMode;
  legCount: number;
  combinedOdds: number | null;
  oddsComplete: boolean;
  averageConfidence: number | null;
  evidenceCompleteness: number;
  freshnessSummary: string;
  correlationWarnings: string[];
  limitations: string[];
  legs: AccaBuilderCandidate[];
  score: number;
  /** Ready for Acca Studio transfer */
  drafts: AccaSelectionDraft[];
};

export type AccaBuilderProviderAvailability = {
  footystatsLists: "ok" | "empty" | "error";
  oddsEnrichment: "ok" | "partial" | "unavailable" | "skipped";
  archiveHistory: "ok" | "unavailable" | "skipped";
};

export type AccaBuilderResult = {
  status: "success" | "no_candidates" | "no_combination" | "error";
  snapshotId: string;
  generatedAt: string;
  requestId: string;
  configuration: AccaBuilderConfig;
  providerAvailability: AccaBuilderProviderAvailability;
  dataFreshness: {
    listsFetchedAt: string | null;
    listsDate: string | null;
  };
  candidateCount: number;
  eligibleCount: number;
  excludedCount: number;
  exclusionSummary: Record<string, number>;
  combinations: AccaBuilderCombination[];
  warnings: string[];
  diagnostics: {
    message: string;
    details?: string[];
  };
};

export const ACCA_BUILDER_MIN_LEGS = 2;
export const ACCA_BUILDER_MAX_LEGS = 8;
export const ACCA_BUILDER_MAX_CANDIDATES = 80;
export const ACCA_BUILDER_MAX_COMBINATIONS = 3;

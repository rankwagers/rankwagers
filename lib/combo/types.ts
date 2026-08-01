import type { EvidenceStrength } from "@/lib/evidence-ui";
import type { MatchListKind } from "@/lib/footystats/types";
import type { OddsMarketKey } from "@/lib/api-football/odds";

export type ComboRiskProfile = "conservative" | "balanced" | "value";

/** User-facing preference IDs. Only enabled markets participate in generation. */
export type ComboMarketPreference =
  | "over_1_5"
  | "over_2_5"
  | "first_half_goals"
  | "second_half_goals"
  | "btts"
  | "home_win"
  | "away_win"
  | "double_chance"
  | "draw_no_bet"
  | "mixed";

export type ComboReasonCode =
  | "list_qualified"
  | "evidence_strength"
  | "coverage"
  | "sample"
  | "baseline_above"
  | "baseline_near"
  | "odds_available"
  | "market_preference"
  | "risk_profile"
  | "correlation_ok"
  | "target_fit";

export type ComboReason = {
  code: ComboReasonCode;
  label: string;
  detail?: string;
};

export type ComboRequest = {
  locale: string;
  country?: string;
  rankingCountry?: string;
  targetOddsMin: number;
  targetOddsMax: number;
  riskProfile: ComboRiskProfile;
  marketPreferences: ComboMarketPreference[];
  maxSelections: number;
  minEvidenceStrength?: EvidenceStrength;
  minCoverage?: number;
  minQualifiedSample?: number;
  excludeSameCompetition?: boolean;
  excludeSameCountry?: boolean;
  limitSameKickoffWindow?: boolean;
};

export type ComboSelection = {
  fixtureId: string;
  fixtureSlug: string;
  matchId: number;
  competitionId: string;
  competitionName: string;
  seasonId?: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeam: string;
  awayTeam: string;
  countryCode?: string;
  kickoffAt: string;
  marketId: ComboMarketPreference;
  marketKind: MatchListKind;
  oddsMarketKey: OddsMarketKey;
  marketLabel: string;
  odds: number;
  oddsFetchedAt?: string;
  oddsFreshness: OddsFreshness;
  modelProbability: number;
  evidenceStrength: EvidenceStrength;
  coverage: number;
  qualifiedSample: number;
  baselineDifference?: number;
  qualificationStatus: "passed";
  reasoning: ComboReason[];
  evidenceSource: "daily_list" | "fixture_research";
};

export type OddsFreshness =
  | "current"
  | "recently_updated"
  | "refresh_recommended"
  | "unavailable";

export type EvidenceCombo = {
  id: string;
  request: ComboRequest;
  selections: ComboSelection[];
  combinedOdds: number;
  targetDistance: number;
  inTargetRange: boolean;
  averageCoverage: number;
  aggregateEvidenceStrength: EvidenceStrength;
  totalQualifiedSample: number;
  score: number;
  generatedAt: string;
  expiresAt?: string;
  oddsFreshness: OddsFreshness;
};

export type ComboCandidate = {
  id: string;
  fixtureId: string;
  fixtureSlug: string;
  matchId: number;
  competitionId: string;
  competitionName: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeam: string;
  awayTeam: string;
  countryCode?: string;
  kickoffAt: string;
  marketId: ComboMarketPreference;
  marketKind: MatchListKind;
  oddsMarketKey: OddsMarketKey;
  marketLabel: string;
  /** Null until odds enrichment; gated out of optimizer when missing. */
  odds: number | null;
  oddsFetchedAt?: string;
  oddsFreshness: OddsFreshness;
  modelProbability: number;
  evidenceStrength: EvidenceStrength;
  coverage: number;
  qualifiedSample: number;
  baselineDifference?: number;
  qualificationStatus: "passed" | "failed";
  rejectionReasons: string[];
  reasoning: ComboReason[];
  evidenceSource: "daily_list" | "fixture_research";
  score: number;
  scoreBreakdown: CandidateScoreBreakdown;
};

export type CandidateScoreBreakdown = {
  evidenceStrength: number;
  coverage: number;
  sample: number;
  baseline: number;
  marketSuitability: number;
  oddsSuitability: number;
  providerCompleteness: number;
  volatilityPenalty: number;
  freshnessPenalty: number;
  total: number;
};

export type ComboFailureReason =
  | "invalid_request"
  | "unsupported_market"
  | "no_fixtures"
  | "no_qualified_candidates"
  | "no_odds"
  | "target_range_unavailable"
  | "correlation_blocked"
  | "no_replacement"
  | "stale_odds"
  | "provider_unavailable";

export type ComboGenerateSuccess = {
  status: "success";
  combo: EvidenceCombo;
  alternatives: EvidenceCombo[];
  operators: ComboOperatorMatch[];
  diagnostics?: ComboEngineDiagnosticsSummary;
};

export type ComboGenerateFailure = {
  status: "no_qualified_combo" | "error";
  reason: ComboFailureReason;
  message: string;
  closestQualifiedOption?: { combinedOdds: number; combo?: EvidenceCombo };
  suggestedRange?: { min: number; max: number };
  operators?: ComboOperatorMatch[];
};

export type ComboGenerateResult = ComboGenerateSuccess | ComboGenerateFailure;

export type ReplacementMode =
  | "same_market"
  | "similar_odds"
  | "stronger_evidence"
  | "different_competition";

export type ComboDeeplinkType =
  | "betslip"
  | "market"
  | "fixture"
  | "football_landing"
  | "homepage"
  | "unavailable";

export type OperatorAvailabilityKind = "full" | "partial" | "none" | "unknown";

export type ComboOperatorMatch = {
  operatorId: string;
  slug: string;
  displayName: string;
  logo?: string;
  availability: OperatorAvailabilityKind;
  availableSelectionCount: number;
  totalSelections: number;
  missingMarketIds: string[];
  combinedOdds?: number;
  countryEligible: boolean;
  deeplinkType: ComboDeeplinkType;
  outboundPath: string;
  offerSummary?: string;
  mobileSupported: boolean;
  reasons: string[];
  badge?: "best_match" | "full_combo" | "highest_odds" | "direct_link" | "partial";
  matchScore: number;
  rank: number;
};

export type ComboEngineDiagnosticsSummary = {
  status: "healthy" | "degraded" | "unhealthy";
  candidateFixtures: number;
  qualifiedSelections: number;
  rejectedSelections: number;
  marketCoverage: number;
  operatorFullMatchCoverage: number;
  staleOdds: number;
  cache: "healthy" | "cold" | "error";
};

export type RiskProfileConfig = {
  id: ComboRiskProfile;
  minimumStrength: EvidenceStrength;
  minimumCoverage: number;
  minimumSample: number;
  preferredSelectionMin: number;
  preferredSelectionMax: number;
};

export type EnabledMarketConfig = {
  preference: Exclude<ComboMarketPreference, "mixed" | "btts" | "home_win" | "away_win" | "double_chance" | "draw_no_bet">;
  listKind: MatchListKind;
  oddsKey: OddsMarketKey;
  label: string;
  enabled: true;
};

export type UnsupportedMarketConfig = {
  preference: Exclude<ComboMarketPreference, "mixed" | "over_1_5" | "over_2_5" | "first_half_goals" | "second_half_goals">;
  enabled: false;
  reason: string;
};

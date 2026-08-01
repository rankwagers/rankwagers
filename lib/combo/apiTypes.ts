import type {
  ComboFailureReason,
  ComboOperatorMatch,
  EvidenceCombo,
  OddsFreshness,
  ReplacementMode,
} from "./types";

export type ComboApiFieldError = {
  field: string;
  code: string;
  message: string;
};

export type ComboApiMeta = {
  generatedAt: string;
  oddsFreshness?: OddsFreshness;
  dataSnapshot: string;
  inTargetRange?: boolean;
};

export type ComboApiSuccess = {
  status: "success";
  requestId: string;
  combo: PublicEvidenceCombo;
  operators: PublicOperatorMatch[];
  alternatives: PublicEvidenceCombo[];
  meta: ComboApiMeta;
  explanation?: string;
};

export type ComboApiNoResult = {
  status: "no_qualified_combo";
  requestId: string;
  reason: ComboFailureReason;
  message: string;
  closestQualifiedOption?: {
    combinedOdds: number;
    combo?: PublicEvidenceCombo;
  };
  suggestedRange?: { min: number; max: number };
  operators?: PublicOperatorMatch[];
  meta: ComboApiMeta;
};

export type ComboApiInvalid = {
  status: "invalid_request";
  requestId: string;
  errors: ComboApiFieldError[];
};

export type ComboApiReplaceUnavailable = {
  status: "no_replacement";
  requestId: string;
  reason: "no_replacement";
  message: string;
  combo: PublicEvidenceCombo;
  operators: PublicOperatorMatch[];
  meta: ComboApiMeta;
};

export type ComboApiRateLimited = {
  status: "rate_limited";
  requestId: string;
  message: string;
  retryAfterSec: number;
};

export type ComboApiResponse =
  | ComboApiSuccess
  | ComboApiNoResult
  | ComboApiInvalid
  | ComboApiReplaceUnavailable
  | ComboApiRateLimited;

/** Public combo — no score breakdown / candidate internals. */
export type PublicEvidenceCombo = {
  id: string;
  request: EvidenceCombo["request"];
  selections: Array<{
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
    marketId: string;
    marketKind: string;
    marketLabel: string;
    odds: number;
    oddsFetchedAt?: string;
    oddsFreshness: OddsFreshness;
    modelProbability: number;
    evidenceStrength: string;
    coverage: number;
    qualifiedSample: number;
    baselineDifference?: number;
    qualificationStatus: "passed";
    reasoning: EvidenceCombo["selections"][number]["reasoning"];
    evidenceSource: string;
  }>;
  combinedOdds: number;
  targetDistance: number;
  inTargetRange: boolean;
  averageCoverage: number;
  aggregateEvidenceStrength: string;
  totalQualifiedSample: number;
  score: number;
  generatedAt: string;
  expiresAt?: string;
  oddsFreshness: OddsFreshness;
};

export type PublicOperatorMatch = {
  operatorId: string;
  slug: string;
  displayName: string;
  logo?: string;
  availability: ComboOperatorMatch["availability"];
  availableSelectionCount: number;
  totalSelections: number;
  missingMarketIds: string[];
  combinedOdds?: number;
  countryEligible: boolean;
  deeplinkType: ComboOperatorMatch["deeplinkType"];
  outboundPath: string;
  offerSummary?: string;
  mobileSupported: boolean;
  reasons: string[];
  badge?: ComboOperatorMatch["badge"];
  rank: number;
};

export type ComboReplaceBody = {
  combo?: unknown;
  comboId?: string;
  selection: { matchId: number; marketId: string };
  mode: ReplacementMode;
  locale?: string;
  country?: string;
  fixtures?: unknown;
  odds?: unknown;
  dataSnapshot?: string;
};

export type ComboRemoveBody = {
  combo?: unknown;
  comboId?: string;
  selection: { matchId: number; marketId: string };
  locale?: string;
  country?: string;
  fixtures?: unknown;
  odds?: unknown;
  dataSnapshot?: string;
};

export type ComboOperatorsBody = {
  combo?: unknown;
  comboId?: string;
  locale?: string;
  country?: string;
};

export type PublicDiagnostics = {
  status: "healthy" | "degraded" | "unhealthy";
  requestId: string;
  candidateFixtures: number;
  qualifiedSelections: number;
  rejectedSelections: number;
  rejectionReasons: Record<string, number>;
  marketCoverage: number;
  targetRangeCoverage: Record<string, number>;
  operatorFullMatchCoverage: number;
  unknownAvailabilityCount: number;
  staleOdds: number;
  cache: "healthy" | "cold" | "error";
  optimizer: {
    exploredSample: number;
    durationMs: number;
  };
  generatedAt: string;
};

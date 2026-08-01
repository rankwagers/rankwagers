import type { EvidenceStrength } from "@/lib/evidence-ui";
import {
  DEFAULT_MAX_SELECTIONS,
  DEFAULT_MIN_COVERAGE,
  DEFAULT_MIN_QUALIFIED_SAMPLE,
  DEFAULT_TARGET_ODDS_MAX,
  DEFAULT_TARGET_ODDS_MIN,
  STRENGTH_RANK,
} from "./config";
import type { ComboRequest, ComboRiskProfile, RiskProfileConfig } from "./types";

export const RISK_PROFILES: Record<ComboRiskProfile, RiskProfileConfig> = {
  conservative: {
    id: "conservative",
    minimumStrength: "strong",
    minimumCoverage: 85,
    minimumSample: 20,
    preferredSelectionMin: 2,
    preferredSelectionMax: 3,
  },
  balanced: {
    id: "balanced",
    minimumStrength: "moderate",
    minimumCoverage: 75,
    minimumSample: 12,
    preferredSelectionMin: 2,
    preferredSelectionMax: 4,
  },
  value: {
    id: "value",
    minimumStrength: "moderate",
    minimumCoverage: 70,
    minimumSample: 10,
    preferredSelectionMin: 3,
    preferredSelectionMax: 5,
  },
};

export function getRiskProfile(id: ComboRiskProfile): RiskProfileConfig {
  return RISK_PROFILES[id];
}

export function meetsStrengthFloor(
  actual: EvidenceStrength,
  minimum: EvidenceStrength
): boolean {
  return STRENGTH_RANK[actual] >= STRENGTH_RANK[minimum];
}

/** Merge request overrides with risk-profile floors (stricter wins). */
export function resolveEffectiveGates(request: ComboRequest): {
  minStrength: EvidenceStrength;
  minCoverage: number;
  minSample: number;
  profile: RiskProfileConfig;
} {
  const profile = getRiskProfile(request.riskProfile);
  const minStrength = request.minEvidenceStrength
    ? STRENGTH_RANK[request.minEvidenceStrength] >= STRENGTH_RANK[profile.minimumStrength]
      ? request.minEvidenceStrength
      : profile.minimumStrength
    : profile.minimumStrength;

  const minCoverage = Math.max(
    profile.minimumCoverage,
    request.minCoverage ?? DEFAULT_MIN_COVERAGE
  );
  const minSample = Math.max(
    profile.minimumSample,
    request.minQualifiedSample ?? DEFAULT_MIN_QUALIFIED_SAMPLE
  );

  return { minStrength, minCoverage, minSample, profile };
}

export function defaultComboRequest(
  overrides: Partial<ComboRequest> = {}
): ComboRequest {
  return {
    locale: "en",
    targetOddsMin: DEFAULT_TARGET_ODDS_MIN,
    targetOddsMax: DEFAULT_TARGET_ODDS_MAX,
    riskProfile: "balanced",
    marketPreferences: ["mixed"],
    maxSelections: DEFAULT_MAX_SELECTIONS,
    excludeSameCompetition: false,
    excludeSameCountry: false,
    limitSameKickoffWindow: true,
    ...overrides,
  };
}

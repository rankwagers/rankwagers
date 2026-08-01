import type { EvidenceStrength } from "@/lib/evidence-ui";
import { SCORING_WEIGHTS, STRENGTH_RANK } from "./config";
import type {
  CandidateScoreBreakdown,
  ComboCandidate,
  ComboRequest,
  ComboSelection,
  EvidenceCombo,
} from "./types";

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function scoreCandidate(
  candidate: Omit<ComboCandidate, "score" | "scoreBreakdown">,
  request: ComboRequest
): { score: number; scoreBreakdown: CandidateScoreBreakdown } {
  const strengthScore =
    (STRENGTH_RANK[candidate.evidenceStrength] / 4) * SCORING_WEIGHTS.evidenceStrength;
  const coverageScore =
    clamp01(candidate.coverage / 100) * SCORING_WEIGHTS.coverage;
  const sampleScore =
    clamp01(candidate.qualifiedSample / 30) * SCORING_WEIGHTS.sample;

  const baselineRaw =
    candidate.baselineDifference == null
      ? 0.4
      : candidate.baselineDifference >= 0
        ? 0.7 + clamp01(candidate.baselineDifference / 20) * 0.3
        : 0.2;
  const baseline = baselineRaw * SCORING_WEIGHTS.baseline;

  const pref = request.marketPreferences;
  const marketSuitability =
    pref.includes("mixed") || pref.includes(candidate.marketId)
      ? SCORING_WEIGHTS.marketSuitability
      : SCORING_WEIGHTS.marketSuitability * 0.4;

  const midpoint = (request.targetOddsMin + request.targetOddsMax) / 2;
  let oddsSuitability = 0;
  if (candidate.odds != null && candidate.odds > 1) {
    const dist = Math.abs(Math.log(candidate.odds) - Math.log(midpoint / Math.max(2, request.maxSelections)));
    oddsSuitability = (1 - clamp01(dist)) * SCORING_WEIGHTS.oddsSuitability;
  }

  const providerCompleteness =
    candidate.evidenceSource === "fixture_research"
      ? SCORING_WEIGHTS.providerCompleteness
      : SCORING_WEIGHTS.providerCompleteness * 0.7;

  const volatilityPenalty =
    candidate.marketKind === "over25" || candidate.marketKind === "sh"
      ? SCORING_WEIGHTS.volatilityPenalty * 0.35
      : SCORING_WEIGHTS.volatilityPenalty * 0.15;

  const freshnessPenalty =
    candidate.oddsFreshness === "current"
      ? 0
      : candidate.oddsFreshness === "recently_updated"
        ? SCORING_WEIGHTS.freshnessPenalty * 0.25
        : candidate.oddsFreshness === "refresh_recommended"
          ? SCORING_WEIGHTS.freshnessPenalty * 0.6
          : SCORING_WEIGHTS.freshnessPenalty;

  const total =
    strengthScore +
    coverageScore +
    sampleScore +
    baseline +
    marketSuitability +
    oddsSuitability +
    providerCompleteness -
    volatilityPenalty -
    freshnessPenalty;

  const scoreBreakdown: CandidateScoreBreakdown = {
    evidenceStrength: round2(strengthScore),
    coverage: round2(coverageScore),
    sample: round2(sampleScore),
    baseline: round2(baseline),
    marketSuitability: round2(marketSuitability),
    oddsSuitability: round2(oddsSuitability),
    providerCompleteness: round2(providerCompleteness),
    volatilityPenalty: round2(volatilityPenalty),
    freshnessPenalty: round2(freshnessPenalty),
    total: round2(total),
  };

  return { score: scoreBreakdown.total, scoreBreakdown };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Deterministic sort: score desc, then tie-breakers. */
export function compareCandidates(a: ComboCandidate, b: ComboCandidate): number {
  if (b.score !== a.score) return b.score - a.score;
  const strengthDiff =
    STRENGTH_RANK[b.evidenceStrength] - STRENGTH_RANK[a.evidenceStrength];
  if (strengthDiff) return strengthDiff;
  if (b.coverage !== a.coverage) return b.coverage - a.coverage;
  if (b.qualifiedSample !== a.qualifiedSample) return b.qualifiedSample - a.qualifiedSample;
  const kickA = Date.parse(a.kickoffAt) || 0;
  const kickB = Date.parse(b.kickoffAt) || 0;
  if (kickA !== kickB) return kickA - kickB;
  return a.id.localeCompare(b.id);
}

export function sortCandidates(candidates: ComboCandidate[]): ComboCandidate[] {
  return [...candidates].sort(compareCandidates);
}

export function aggregateEvidenceStrength(
  strengths: readonly EvidenceStrength[]
): EvidenceStrength {
  if (!strengths.length) return "insufficient";
  let min = strengths[0];
  for (const s of strengths) {
    if (STRENGTH_RANK[s] < STRENGTH_RANK[min]) min = s;
  }
  return min;
}

export function scoreCombo(
  selections: readonly ComboSelection[],
  request: ComboRequest,
  options?: {
    correlationPenalty?: number;
    operatorAvailabilityBonus?: number;
  }
): number {
  if (!selections.length) return 0;
  const avgStrength =
    selections.reduce((sum, s) => sum + STRENGTH_RANK[s.evidenceStrength], 0) /
    selections.length;
  const minStrength = Math.min(
    ...selections.map((s) => STRENGTH_RANK[s.evidenceStrength])
  );
  const avgCoverage =
    selections.reduce((sum, s) => sum + s.coverage, 0) / selections.length;
  const avgSample =
    selections.reduce((sum, s) => sum + s.qualifiedSample, 0) / selections.length;

  const combined = selections.reduce((prod, s) => prod * s.odds, 1);
  const mid = (request.targetOddsMin + request.targetOddsMax) / 2;
  const inRange =
    combined >= request.targetOddsMin && combined <= request.targetOddsMax;
  const targetFit = inRange
    ? 20
    : Math.max(0, 12 - Math.abs(Math.log(combined) - Math.log(mid)) * 8);

  const markets = new Set(selections.map((s) => s.marketId));
  const diversity = Math.min(10, markets.size * 3);

  const correlationPenalty = options?.correlationPenalty ?? 0;
  const operatorBonus = options?.operatorAvailabilityBonus ?? 0;

  return round2(
    avgStrength * 8 +
      minStrength * 10 +
      avgCoverage * 0.15 +
      clamp01(avgSample / 30) * 12 +
      targetFit +
      diversity +
      operatorBonus -
      correlationPenalty
  );
}

export function targetDistance(combinedOdds: number, request: ComboRequest): number {
  if (
    combinedOdds >= request.targetOddsMin &&
    combinedOdds <= request.targetOddsMax
  ) {
    const mid = (request.targetOddsMin + request.targetOddsMax) / 2;
    return Math.abs(combinedOdds - mid);
  }
  if (combinedOdds < request.targetOddsMin) {
    return request.targetOddsMin - combinedOdds + 10;
  }
  return combinedOdds - request.targetOddsMax + 10;
}

export function compareCombos(a: EvidenceCombo, b: EvidenceCombo): number {
  if (a.inTargetRange !== b.inTargetRange) return a.inTargetRange ? -1 : 1;
  if (b.score !== a.score) return b.score - a.score;
  if (a.targetDistance !== b.targetDistance) return a.targetDistance - b.targetDistance;
  if (b.averageCoverage !== a.averageCoverage) {
    return b.averageCoverage - a.averageCoverage;
  }
  if (b.totalQualifiedSample !== a.totalQualifiedSample) {
    return b.totalQualifiedSample - a.totalQualifiedSample;
  }
  if (a.selections.length !== b.selections.length) {
    return a.selections.length - b.selections.length;
  }
  return a.id.localeCompare(b.id);
}

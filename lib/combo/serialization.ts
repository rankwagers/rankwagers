import { createHash } from "node:crypto";
import {
  aggregateEvidenceStrength,
  scoreCombo,
  targetDistance,
} from "./scoring";
import { correlationPenaltyForCombo, selectionToLeg } from "./correlation";
import type {
  ComboCandidate,
  ComboRequest,
  ComboSelection,
  EvidenceCombo,
  OddsFreshness,
} from "./types";

export function candidateToSelection(candidate: ComboCandidate): ComboSelection {
  if (candidate.odds == null || !(candidate.odds > 1)) {
    throw new Error(`Cannot serialize candidate without odds: ${candidate.id}`);
  }
  return {
    fixtureId: candidate.fixtureId,
    fixtureSlug: candidate.fixtureSlug,
    matchId: candidate.matchId,
    competitionId: candidate.competitionId,
    competitionName: candidate.competitionName,
    homeTeamId: candidate.homeTeamId,
    awayTeamId: candidate.awayTeamId,
    homeTeam: candidate.homeTeam,
    awayTeam: candidate.awayTeam,
    countryCode: candidate.countryCode,
    kickoffAt: candidate.kickoffAt,
    marketId: candidate.marketId,
    marketKind: candidate.marketKind,
    oddsMarketKey: candidate.oddsMarketKey,
    marketLabel: candidate.marketLabel,
    odds: candidate.odds,
    oddsFetchedAt: candidate.oddsFetchedAt,
    oddsFreshness: candidate.oddsFreshness,
    modelProbability: candidate.modelProbability,
    evidenceStrength: candidate.evidenceStrength,
    coverage: candidate.coverage,
    qualifiedSample: candidate.qualifiedSample,
    baselineDifference: candidate.baselineDifference,
    qualificationStatus: "passed",
    reasoning: candidate.reasoning,
    evidenceSource: candidate.evidenceSource,
  };
}

export function combinedOddsOf(selections: readonly ComboSelection[]): number {
  return selections.reduce((prod, s) => prod * s.odds, 1);
}

export function worstOddsFreshness(
  selections: readonly { oddsFreshness: OddsFreshness }[]
): OddsFreshness {
  const order: OddsFreshness[] = [
    "unavailable",
    "refresh_recommended",
    "recently_updated",
    "current",
  ];
  let worst: OddsFreshness = "current";
  for (const s of selections) {
    if (order.indexOf(s.oddsFreshness) < order.indexOf(worst)) {
      worst = s.oddsFreshness;
    }
  }
  return worst;
}

export function buildComboId(
  request: ComboRequest,
  selectionIds: readonly string[]
): string {
  const payload = JSON.stringify({
    r: [
      request.riskProfile,
      request.targetOddsMin,
      request.targetOddsMax,
      request.maxSelections,
      [...request.marketPreferences].sort(),
    ],
    s: [...selectionIds].sort(),
  });
  const hash = createHash("sha256").update(payload).digest("hex").slice(0, 16);
  return `combo_${hash}`;
}

export function buildEvidenceCombo(
  candidates: readonly ComboCandidate[],
  request: ComboRequest,
  generatedAt = new Date().toISOString()
): EvidenceCombo {
  const selections = candidates.map(candidateToSelection);
  const combinedOdds =
    Math.round(combinedOddsOf(selections) * 1000) / 1000;
  const inTargetRange =
    combinedOdds >= request.targetOddsMin &&
    combinedOdds <= request.targetOddsMax;
  const averageCoverage =
    Math.round(
      (selections.reduce((sum, s) => sum + s.coverage, 0) / selections.length) * 10
    ) / 10;
  const totalQualifiedSample = selections.reduce(
    (sum, s) => sum + s.qualifiedSample,
    0
  );
  const corrPenalty = correlationPenaltyForCombo(
    selections.map(selectionToLeg),
    request
  );
  const score = scoreCombo(selections, request, {
    correlationPenalty: corrPenalty,
  });
  const selectionIds = candidates.map((c) => c.id);

  return {
    id: buildComboId(request, selectionIds),
    request,
    selections,
    combinedOdds,
    targetDistance: targetDistance(combinedOdds, request),
    inTargetRange,
    averageCoverage,
    aggregateEvidenceStrength: aggregateEvidenceStrength(
      selections.map((s) => s.evidenceStrength)
    ),
    totalQualifiedSample,
    score,
    generatedAt,
    expiresAt: new Date(Date.parse(generatedAt) + 30 * 60 * 1000).toISOString(),
    oddsFreshness: worstOddsFreshness(selections),
  };
}

/** Public-safe combo for API (no score breakdown internals on candidates). */
export function toPublicCombo(combo: EvidenceCombo): EvidenceCombo {
  return {
    ...combo,
    request: { ...combo.request },
    selections: combo.selections.map((s) => ({ ...s, reasoning: [...s.reasoning] })),
  };
}

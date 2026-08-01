import { combinedDecimalOdds } from "@/lib/acca/odds";
import type { AccaSelectionDraft } from "@/lib/acca/rules";
import type {
  AccaBuilderCandidate,
  AccaBuilderCombination,
  AccaBuilderConfig,
} from "./contracts";
import { canAddToCombo, correlationWarning } from "./conflicts";
import { sortByScore } from "./scoring";

function toDraft(leg: AccaBuilderCandidate): AccaSelectionDraft {
  return {
    matchId: leg.matchId,
    homeTeam: leg.homeTeam,
    awayTeam: leg.awayTeam,
    competition: leg.competition,
    countryCode: leg.countryCode,
    kickoffAt: leg.kickoffAt,
    marketKey: leg.marketKey,
    selectionKey: leg.selectionKey,
    selectionLabel: leg.selectionLabel,
    odds: leg.odds,
    confidence: leg.confidence,
    evidenceSummary: leg.evidenceSummary,
    publishedAt: null,
    matchHref: leg.matchHref,
    source: "builder",
  };
}

function comboScore(legs: AccaBuilderCandidate[]): number {
  const avg =
    legs.reduce((s, l) => s + l.score, 0) / Math.max(1, legs.length);
  const corrPenalty = correlationWarning(legs).length * 4;
  return Math.round((avg - corrPenalty) * 10) / 10;
}

function buildCombination(
  legs: AccaBuilderCandidate[],
  label: AccaBuilderCombination["label"],
  config: AccaBuilderConfig
): AccaBuilderCombination {
  const oddsModel = combinedDecimalOdds(legs.map((l) => ({ odds: l.odds })));
  const odds = oddsModel.combinedOdds;
  const confidences = legs
    .map((l) => l.confidence)
    .filter((n) => Number.isFinite(n));
  const averageConfidence = confidences.length
    ? Math.round(
        confidences.reduce((a, b) => a + b, 0) / confidences.length
      )
    : null;
  const evidenceCompleteness = Math.round(
    legs.reduce((s, l) => s + l.evidenceCompleteness, 0) / legs.length
  );
  const oddsComplete = oddsModel.oddsComplete;
  const warnings = correlationWarning(legs);
  const limitations = [
    "Risk labels are not guarantees.",
    "Model probabilities are not tipster certainty.",
    ...(oddsComplete ? [] : ["Combined odds unavailable — one or more legs lack observed odds."]),
  ];

  return {
    id: `combo_${label}_${legs.map((l) => l.id).join("__")}`,
    label,
    riskMode: config.riskMode,
    legCount: legs.length,
    combinedOdds: odds,
    oddsComplete,
    averageConfidence,
    evidenceCompleteness,
    freshnessSummary: oddsComplete
      ? "Odds observed for all legs at generation time"
      : "One or more legs missing observed odds",
    correlationWarnings: warnings,
    limitations,
    legs,
    score: comboScore(legs),
    drafts: legs.map(toDraft),
  };
}

/**
 * Greedy bounded builder: pick top-scoring eligible legs under conflict rules.
 * Deterministic given sorted input.
 */
export function generateCombinations(
  eligible: readonly AccaBuilderCandidate[],
  config: AccaBuilderConfig
): AccaBuilderCombination[] {
  const sorted = sortByScore(eligible.filter((c) => c.eligible));
  if (sorted.length < config.legCount) return [];

  const primary = pickLegs(sorted, config);
  if (!primary) return [];

  const out: AccaBuilderCombination[] = [
    buildCombination(primary, "recommended", config),
  ];

  const saferPool = sortByScore(
    sorted.filter((c) => c.confidence >= config.minConfidence + 4)
  );
  const safer = pickLegs(saferPool.length ? saferPool : sorted, config);
  if (safer && !sameCombo(safer, primary)) {
    out.push(buildCombination(safer, "safer", config));
  }

  const riskierPool = sortByScore(
    sorted.filter((c) => !primary.some((p) => p.id === c.id))
  );
  const riskier = pickLegs(
    riskierPool.length >= config.legCount ? riskierPool : sorted,
    { ...config, legCount: Math.min(config.legCount + 1, 8) }
  );
  if (riskier && !sameCombo(riskier, primary) && !safer?.every((s, i) => s.id === riskier[i]?.id)) {
    out.push(buildCombination(riskier, "higher_risk", config));
  }

  return filterTargetOdds(out, config).slice(0, 3);
}

function pickLegs(
  pool: AccaBuilderCandidate[],
  config: AccaBuilderConfig
): AccaBuilderCandidate[] | null {
  const picked: AccaBuilderCandidate[] = [];
  for (const cand of pool) {
    if (picked.length >= config.legCount) break;
    const check = canAddToCombo(
      picked,
      cand,
      config.oneSelectionPerFixture
    );
    if (!check.ok) continue;
    if (
      (config.targetOddsMin != null || config.targetOddsMax != null) &&
      cand.odds == null
    ) {
      continue;
    }
    picked.push(cand);
  }
  return picked.length === config.legCount ? picked : null;
}

function sameCombo(a: AccaBuilderCandidate[], b: AccaBuilderCandidate[]): boolean {
  if (a.length !== b.length) return false;
  const ids = new Set(a.map((x) => x.id));
  return b.every((x) => ids.has(x.id));
}

function filterTargetOdds(
  combos: AccaBuilderCombination[],
  config: AccaBuilderConfig
): AccaBuilderCombination[] {
  if (config.targetOddsMin == null && config.targetOddsMax == null) return combos;
  const inRange = combos.filter((c) => {
    if (c.combinedOdds == null) return false;
    if (config.targetOddsMin != null && c.combinedOdds < config.targetOddsMin) {
      return false;
    }
    if (config.targetOddsMax != null && c.combinedOdds > config.targetOddsMax) {
      return false;
    }
    return true;
  });
  if (inRange.length) return inRange;
  // Closest valid still returned with limitation note
  return combos
    .map((c) => ({
      ...c,
      limitations: [
        ...c.limitations,
        "No combination met the target odds range without lowering quality gates; showing closest quality-first result.",
      ],
    }))
    .slice(0, 1);
}

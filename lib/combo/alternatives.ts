import { MAX_ALTERNATIVES } from "./config";
import { canAddSelection, selectionToLeg } from "./correlation";
import { compareCombos, sortCandidates } from "./scoring";
import { buildEvidenceCombo } from "./serialization";
import { optimizeCombo } from "./optimizer";
import type { ComboCandidate, ComboRequest, EvidenceCombo } from "./types";

function materialDifference(a: EvidenceCombo, b: EvidenceCombo): boolean {
  const idsA = new Set(a.selections.map((s) => `${s.matchId}:${s.marketId}`));
  const idsB = b.selections.map((s) => `${s.matchId}:${s.marketId}`);
  const overlap = idsB.filter((id) => idsA.has(id)).length;
  return overlap < Math.min(idsA.size, idsB.length);
}

function buildGreedyCombo(
  pool: ComboCandidate[],
  request: ComboRequest,
  prefer: "strength" | "odds" | "target"
): EvidenceCombo | null {
  const sorted = sortCandidates(
    pool.filter((c) => c.odds != null && c.odds > 1)
  ).sort((a, b) => {
    if (prefer === "strength") {
      return b.score - a.score || b.coverage - a.coverage;
    }
    if (prefer === "odds") {
      return (b.odds ?? 0) - (a.odds ?? 0);
    }
    const mid = (request.targetOddsMin + request.targetOddsMax) / 2;
    const per = Math.pow(mid, 1 / Math.max(2, request.maxSelections));
    return Math.abs((a.odds ?? 0) - per) - Math.abs((b.odds ?? 0) - per);
  });

  const chosen: ComboCandidate[] = [];
  for (const candidate of sorted) {
    if (chosen.length >= request.maxSelections) break;
    if (!canAddSelection(chosen.map(selectionToLeg), selectionToLeg(candidate), request)) {
      continue;
    }
    chosen.push(candidate);
    if (chosen.length >= 2) {
      const odds = chosen.reduce((p, c) => p * (c.odds ?? 1), 1);
      if (prefer === "target" && odds >= request.targetOddsMin && odds <= request.targetOddsMax) {
        break;
      }
      if (prefer === "strength" && chosen.length >= 2) break;
      if (prefer === "odds" && odds >= request.targetOddsMax * 0.9) break;
    }
  }
  if (chosen.length < 2) return null;
  return buildEvidenceCombo(chosen, request);
}

/**
 * Up to 3 material alternatives: stronger evidence, closest target, higher odds.
 */
export function buildAlternatives(
  primary: EvidenceCombo,
  candidates: readonly ComboCandidate[],
  request: ComboRequest
): EvidenceCombo[] {
  const pool = candidates.filter((c) => c.odds != null && c.odds > 1);
  const out: EvidenceCombo[] = [];

  const strongerReq: ComboRequest = {
    ...request,
    riskProfile: request.riskProfile === "value" ? "balanced" : "conservative",
    targetOddsMin: Math.max(1.2, request.targetOddsMin * 0.85),
    targetOddsMax: request.targetOddsMax,
  };
  const strongerOpt = optimizeCombo(pool, strongerReq);
  if (strongerOpt.status === "success" && materialDifference(primary, strongerOpt.combo)) {
    out.push(strongerOpt.combo);
  } else {
    const greedy = buildGreedyCombo(pool, request, "strength");
    if (greedy && materialDifference(primary, greedy)) out.push(greedy);
  }

  const closest = buildGreedyCombo(pool, request, "target");
  if (closest && materialDifference(primary, closest) && !out.some((c) => c.id === closest.id)) {
    out.push(closest);
  }

  const higherReq: ComboRequest = {
    ...request,
    targetOddsMin: request.targetOddsMax,
    targetOddsMax: Math.min(25, request.targetOddsMax * 1.8),
    maxSelections: Math.min(6, request.maxSelections + 1),
  };
  const higherOpt = optimizeCombo(pool, higherReq);
  if (
    higherOpt.status === "success" &&
    materialDifference(primary, higherOpt.combo) &&
    !out.some((c) => c.id === higherOpt.combo.id)
  ) {
    out.push(higherOpt.combo);
  } else {
    const greedyHigh = buildGreedyCombo(pool, higherReq, "odds");
    if (
      greedyHigh &&
      materialDifference(primary, greedyHigh) &&
      !out.some((c) => c.id === greedyHigh.id)
    ) {
      out.push(greedyHigh);
    }
  }

  return out
    .filter((combo, index, arr) => arr.findIndex((c) => c.id === combo.id) === index)
    .sort(compareCombos)
    .slice(0, MAX_ALTERNATIVES);
}

export type FeaturedComboVariant = {
  id: "stronger_evidence" | "balanced" | "higher_target";
  label: string;
  combo: EvidenceCombo | null;
};

export function buildFeaturedVariants(
  candidates: readonly ComboCandidate[],
  baseRequest: ComboRequest
): FeaturedComboVariant[] {
  const pool = candidates.filter((c) => c.odds != null && c.odds > 1);

  const saferReq: ComboRequest = {
    ...baseRequest,
    riskProfile: "conservative",
    targetOddsMin: 1.5,
    targetOddsMax: 2.2,
    maxSelections: 3,
  };
  const balancedReq: ComboRequest = {
    ...baseRequest,
    riskProfile: "balanced",
    targetOddsMin: 2.0,
    targetOddsMax: 3.0,
    maxSelections: 3,
  };
  const higherReq: ComboRequest = {
    ...baseRequest,
    riskProfile: "value",
    targetOddsMin: 3.0,
    targetOddsMax: 5.0,
    maxSelections: 4,
  };

  const pick = (req: ComboRequest): EvidenceCombo | null => {
    const result = optimizeCombo(pool, req);
    if (result.status === "success") return result.combo;
    return result.closest ?? null;
  };

  return [
    { id: "stronger_evidence", label: "Stronger Evidence", combo: pick(saferReq) },
    { id: "balanced", label: "Balanced", combo: pick(balancedReq) },
    { id: "higher_target", label: "Higher Target Odds", combo: pick(higherReq) },
  ];
}

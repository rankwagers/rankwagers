import { getRiskProfile } from "./profiles";
import { canAddSelection, checkCorrelation, selectionToLeg } from "./correlation";
import { compareCombos } from "./scoring";
import { boundCandidatePool } from "./candidates";
import { buildEvidenceCombo } from "./serialization";
import type {
  ComboCandidate,
  ComboGenerateFailure,
  ComboRequest,
  EvidenceCombo,
} from "./types";

export type OptimizeResult =
  | { status: "success"; combo: EvidenceCombo; explored: number }
  | {
      status: "no_qualified_combo";
      failure: ComboGenerateFailure;
      closest?: EvidenceCombo;
      explored: number;
    };

function productOdds(legs: readonly ComboCandidate[]): number {
  return legs.reduce((prod, leg) => prod * (leg.odds ?? 1), 1);
}

/**
 * Bounded DFS/BFS hybrid: try selection counts within profile preference,
 * prune when product already exceeds max or cannot reach min.
 */
export function optimizeCombo(
  candidates: readonly ComboCandidate[],
  request: ComboRequest
): OptimizeResult {
  const pool = boundCandidatePool(candidates).filter(
    (c) => c.odds != null && c.odds > 1
  );
  if (!pool.length) {
    return {
      status: "no_qualified_combo",
      explored: 0,
      failure: {
        status: "no_qualified_combo",
        reason: "no_odds",
        message: "No qualified combination was found — odds unavailable for candidates",
      },
    };
  }

  const profile = getRiskProfile(request.riskProfile);
  const minLegs = Math.max(2, Math.min(request.maxSelections, profile.preferredSelectionMin));
  const maxLegs = Math.min(request.maxSelections, profile.preferredSelectionMax, pool.length);

  let explored = 0;
  const MAX_EXPLORED = 8000;
  const found: EvidenceCombo[] = [];
  let closest: EvidenceCombo | undefined;

  function consider(legs: ComboCandidate[]) {
    if (legs.length < 2) return;
    const combo = buildEvidenceCombo(legs, request);
    explored += 1;
    if (!closest || compareCombos(combo, closest) < 0) {
      closest = combo;
    }
    if (combo.inTargetRange) {
      found.push(combo);
    }
  }

  function dfs(start: number, chosen: ComboCandidate[]) {
    if (explored >= MAX_EXPLORED) return;
    if (chosen.length >= minLegs && chosen.length <= maxLegs) {
      consider(chosen);
    }
    if (chosen.length >= maxLegs) return;

    const currentOdds = productOdds(chosen);
    if (currentOdds > request.targetOddsMax * 1.35 && chosen.length >= 2) {
      return;
    }

    for (let i = start; i < pool.length; i++) {
      if (explored >= MAX_EXPLORED) return;
      const next = pool[i];
      const check = checkCorrelation(
        chosen.map(selectionToLeg),
        selectionToLeg(next),
        request
      );
      if (!check.ok) continue;

      const nextOdds = currentOdds * (next.odds ?? 1);
      const remainingSlots = maxLegs - chosen.length - 1;
      // Prune if even multiplying by 1.01^remaining cannot reach min (too low) — skip
      if (
        chosen.length + 1 >= minLegs &&
        nextOdds < request.targetOddsMin &&
        remainingSlots === 0
      ) {
        // still consider as near-range via consider()
      }

      chosen.push(next);
      dfs(i + 1, chosen);
      chosen.pop();
    }
  }

  // Prefer starting from highest-scored candidates
  dfs(0, []);

  // Also try greedy seed paths for coverage when DFS is sparse
  for (let seed = 0; seed < Math.min(12, pool.length); seed++) {
    const chosen: ComboCandidate[] = [pool[seed]];
    for (let i = 0; i < pool.length && chosen.length < maxLegs; i++) {
      if (i === seed) continue;
      const next = pool[i];
      if (!canAddSelection(chosen.map(selectionToLeg), selectionToLeg(next), request)) {
        continue;
      }
      const trial = [...chosen, next];
      const odds = productOdds(trial);
      if (odds > request.targetOddsMax * 1.5) continue;
      chosen.push(next);
      if (chosen.length >= minLegs) consider(chosen);
    }
  }

  if (found.length) {
    found.sort(compareCombos);
    return { status: "success", combo: found[0], explored };
  }

  if (closest) {
    const suggested = suggestWiderRange(request, closest.combinedOdds);
    return {
      status: "no_qualified_combo",
      explored,
      closest,
      failure: {
        status: "no_qualified_combo",
        reason: "target_range_unavailable",
        message:
          "No qualified combination was found in your requested range.",
        closestQualifiedOption: {
          combinedOdds: closest.combinedOdds,
          combo: closest,
        },
        suggestedRange: suggested,
      },
    };
  }

  return {
    status: "no_qualified_combo",
    explored,
    failure: {
      status: "no_qualified_combo",
      reason: "no_qualified_candidates",
      message: "No qualified combination is currently available.",
    },
  };
}

export function suggestWiderRange(
  request: ComboRequest,
  actualOdds: number
): { min: number; max: number } {
  if (actualOdds < request.targetOddsMin) {
    return {
      min: Math.max(1.2, Math.floor(actualOdds * 10) / 10),
      max: request.targetOddsMax,
    };
  }
  return {
    min: request.targetOddsMin,
    max: Math.ceil(actualOdds * 10) / 10 + 0.2,
  };
}

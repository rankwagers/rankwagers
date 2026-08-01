import { canAddSelection, selectionToLeg } from "./correlation";
import { compareCandidates, sortCandidates } from "./scoring";
import { buildEvidenceCombo } from "./serialization";
import { STRENGTH_RANK } from "./config";
import type {
  ComboCandidate,
  ComboRequest,
  ComboSelection,
  EvidenceCombo,
  ReplacementMode,
} from "./types";

function selectionKey(s: Pick<ComboSelection, "matchId" | "marketId">): string {
  return `${s.matchId}:${s.marketId}`;
}

function findSelectionIndex(combo: EvidenceCombo, matchId: number, marketId: string): number {
  return combo.selections.findIndex(
    (s) => s.matchId === matchId && s.marketId === marketId
  );
}

function remainingAsCandidates(
  combo: EvidenceCombo,
  skipIndex: number,
  pool: readonly ComboCandidate[]
): ComboCandidate[] {
  const keptKeys = combo.selections
    .filter((_, i) => i !== skipIndex)
    .map(selectionKey);
  const fromPool: ComboCandidate[] = [];
  for (const key of keptKeys) {
    const found = pool.find((c) => c.id === key || selectionKey(c) === key);
    if (found) fromPool.push(found);
  }
  return fromPool;
}

function scoreReplacement(
  candidate: ComboCandidate,
  removed: ComboSelection,
  mode: ReplacementMode
): number {
  let score = candidate.score;
  if (mode === "same_market" && candidate.marketId === removed.marketId) score += 20;
  if (mode === "similar_odds" && candidate.odds != null) {
    score += Math.max(0, 15 - Math.abs(candidate.odds - removed.odds) * 8);
  }
  if (mode === "stronger_evidence") {
    score +=
      (STRENGTH_RANK[candidate.evidenceStrength] -
        STRENGTH_RANK[removed.evidenceStrength]) *
      10;
  }
  if (
    mode === "different_competition" &&
    candidate.competitionId !== removed.competitionId
  ) {
    score += 15;
  }
  return score;
}

export type ReplaceResult =
  | {
      status: "success";
      combo: EvidenceCombo;
      replacedWith: ComboSelection;
      explanation: string;
    }
  | { status: "failure"; message: string };

export function replaceSelection(
  combo: EvidenceCombo,
  target: { matchId: number; marketId: string },
  mode: ReplacementMode,
  candidates: readonly ComboCandidate[],
  request: ComboRequest = combo.request
): ReplaceResult {
  const index = findSelectionIndex(combo, target.matchId, target.marketId);
  if (index < 0) {
    return { status: "failure", message: "Selection to replace was not found in the combo" };
  }

  const removed = combo.selections[index];
  const kept = remainingAsCandidates(combo, index, candidates);
  const excludedKey = selectionKey(removed);

  const pool = sortCandidates(
    candidates.filter(
      (c) =>
        c.odds != null &&
        c.odds > 1 &&
        selectionKey(c) !== excludedKey &&
        canAddSelection(kept.map(selectionToLeg), selectionToLeg(c), request)
    )
  ).sort(
    (a, b) =>
      scoreReplacement(b, removed, mode) - scoreReplacement(a, removed, mode) ||
      compareCandidates(a, b)
  );

  if (!pool.length) {
    return {
      status: "failure",
      message: "No valid replacement exists without weakening evidence gates",
    };
  }

  const replacement = pool[0];
  const nextLegs = [...kept, replacement];
  const nextCombo = buildEvidenceCombo(nextLegs, request);

  return {
    status: "success",
    combo: nextCombo,
    replacedWith: nextCombo.selections[nextCombo.selections.length - 1],
    explanation: `Replaced ${removed.homeTeam} vs ${removed.awayTeam} (${removed.marketLabel}) using ${mode.replace(/_/g, " ")} mode`,
  };
}

export type RemoveResult =
  | { status: "success"; combo: EvidenceCombo }
  | { status: "failure"; message: string };

export function removeSelection(
  combo: EvidenceCombo,
  target: { matchId: number; marketId: string },
  candidates: readonly ComboCandidate[]
): RemoveResult {
  const index = findSelectionIndex(combo, target.matchId, target.marketId);
  if (index < 0) {
    return { status: "failure", message: "Selection to remove was not found" };
  }
  if (combo.selections.length <= 2) {
    return {
      status: "failure",
      message: "A combination must keep at least two selections — remove cancelled",
    };
  }

  const kept = remainingAsCandidates(combo, index, candidates);
  if (kept.length < 2) {
    return {
      status: "failure",
      message: "Could not reconstruct remaining selections from the candidate pool",
    };
  }

  return {
    status: "success",
    combo: buildEvidenceCombo(kept, combo.request),
  };
}

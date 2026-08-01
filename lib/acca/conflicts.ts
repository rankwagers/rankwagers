import type { AccaSelection } from "./types";

export type AccaConflict =
  | { code: "duplicate_selection"; existingId: string }
  | { code: "duplicate_fixture"; existingId: string; matchId: number }
  | { code: "market_conflict"; existingId: string; reason: string };

/**
 * Hard rules for manual Acca building:
 * - Exact same selection → already present
 * - Same fixture twice (any market) → blocked (correlated legs)
 */
export function findAddConflict(
  existing: readonly AccaSelection[],
  next: Pick<AccaSelection, "id" | "matchId" | "marketKey" | "selectionKey">
): AccaConflict | null {
  for (const leg of existing) {
    if (leg.id === next.id) {
      return { code: "duplicate_selection", existingId: leg.id };
    }
    if (leg.matchId === next.matchId) {
      return {
        code: "duplicate_fixture",
        existingId: leg.id,
        matchId: next.matchId,
      };
    }
  }
  return null;
}

export function describeConflict(conflict: AccaConflict): string {
  switch (conflict.code) {
    case "duplicate_selection":
      return "This selection is already in your Acca.";
    case "duplicate_fixture":
      return "This fixture is already in your Acca. Remove it first to change the market.";
    case "market_conflict":
      return conflict.reason;
  }
}

import type { CombinationSettlement } from "./contracts";

export type LegSettlement = "won" | "lost" | "void" | "pending" | "unresolved";

/**
 * Deterministic combination settlement (Sprint 24 methodology).
 *
 * Rules:
 * - INVALID if no legs
 * - UNRESOLVED if any leg unresolved
 * - PENDING if any leg pending (and none unresolved/lost)
 * - LOST if any leg lost
 * - WON if all remaining non-void legs won and at least one won
 * - VOID if all legs void
 * - PARTIAL_VOID if some void and rest all won
 */
export function settleCombination(legs: LegSettlement[]): CombinationSettlement {
  if (legs.length === 0) return "INVALID";
  if (legs.some((l) => l === "unresolved")) return "UNRESOLVED";
  if (legs.some((l) => l === "pending")) return "PENDING";
  if (legs.some((l) => l === "lost")) return "LOST";
  const nonVoid = legs.filter((l) => l !== "void");
  if (nonVoid.length === 0) return "VOID";
  if (nonVoid.every((l) => l === "won")) {
    return legs.some((l) => l === "void") ? "PARTIAL_VOID" : "WON";
  }
  return "UNRESOLVED";
}

/** Financial ROI requires complete historical odds — never fabricate. */
export function financialMetricsAvailable(oddsPresent: boolean[]): boolean {
  return oddsPresent.length > 0 && oddsPresent.every(Boolean);
}

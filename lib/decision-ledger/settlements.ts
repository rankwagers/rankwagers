import type { SettlementOutcome } from "./contracts";
import { COMBINATION_SETTLEMENT_RULE_VERSION } from "./versions";

export type LegOutcome =
  | "WON"
  | "LOST"
  | "VOID"
  | "PENDING"
  | "UNRESOLVED";

/**
 * Combination settlement rules v26.0.0 (aligned with Acca/calibration contract):
 * - any LOST → LOST
 * - any UNRESOLVED (no loss) → UNRESOLVED
 * - any PENDING (no loss/unresolved) → PENDING
 * - all VOID → VOID
 * - all remaining non-void WON with some VOID → PARTIAL_VOID
 * - all WON → WON
 * - empty → INVALID
 */
export function settleCombinationFromLegs(
  legs: LegOutcome[],
): { outcome: SettlementOutcome; ruleVersion: string } {
  if (legs.length === 0) {
    return { outcome: "INVALID", ruleVersion: COMBINATION_SETTLEMENT_RULE_VERSION };
  }
  if (legs.some((l) => l === "LOST")) {
    return { outcome: "LOST", ruleVersion: COMBINATION_SETTLEMENT_RULE_VERSION };
  }
  if (legs.some((l) => l === "UNRESOLVED")) {
    return {
      outcome: "UNRESOLVED",
      ruleVersion: COMBINATION_SETTLEMENT_RULE_VERSION,
    };
  }
  if (legs.some((l) => l === "PENDING")) {
    return { outcome: "PENDING", ruleVersion: COMBINATION_SETTLEMENT_RULE_VERSION };
  }
  const nonVoid = legs.filter((l) => l !== "VOID");
  if (nonVoid.length === 0) {
    return { outcome: "VOID", ruleVersion: COMBINATION_SETTLEMENT_RULE_VERSION };
  }
  if (nonVoid.every((l) => l === "WON")) {
    return {
      outcome: legs.some((l) => l === "VOID") ? "PARTIAL_VOID" : "WON",
      ruleVersion: COMBINATION_SETTLEMENT_RULE_VERSION,
    };
  }
  return {
    outcome: "UNRESOLVED",
    ruleVersion: COMBINATION_SETTLEMENT_RULE_VERSION,
  };
}

export function financialReturnAvailable(oddsPresent: boolean[]): boolean {
  return oddsPresent.length > 0 && oddsPresent.every(Boolean);
}

import { listOperators } from "@/lib/operators/registry";
import type { Operator } from "@/lib/operators/types";
import { resolveComboOperatorAvailability } from "./operator-availability";
import type { ComboSelection, OperatorAvailabilityKind } from "./types";

export function operatorSupportsMarket(
  operator: Operator,
  marketKind: string
): boolean {
  return operator.supportedMarkets.includes(
    marketKind as Operator["supportedMarkets"][number]
  );
}

export function operatorEligibleInCountry(
  operator: Operator,
  country?: string
): boolean {
  if (!country) return true;
  if (!operator.supportedCountries.length) return true;
  return operator.supportedCountries.includes(country.toUpperCase());
}

/**
 * Selection-level availability via Phase D resolver.
 * Unverified bookmaker mappings always resolve to unknown.
 */
export function selectionAvailabilityForOperator(
  operator: Operator,
  selections: readonly ComboSelection[],
  country?: string
): {
  availability: OperatorAvailabilityKind;
  availableCount: number;
  missingMarketIds: string[];
  countryEligible: boolean;
  operatorCombinedOdds?: number;
  publicReasons: string[];
  diagnosticReasons: string[];
  operatorOddsFreshness?: string;
} {
  const resolved = resolveComboOperatorAvailability({
    operator,
    selections,
    country,
  });
  return {
    availability: resolved.availability,
    availableCount: resolved.availableCount,
    missingMarketIds: resolved.missingMarketIds,
    countryEligible: resolved.countryEligible,
    operatorCombinedOdds: resolved.operatorCombinedOdds,
    publicReasons: resolved.publicReasons,
    diagnosticReasons: resolved.diagnosticReasons,
    operatorOddsFreshness: resolved.operatorOddsFreshness,
  };
}

export function listEligibleOperators(country?: string): Operator[] {
  return listOperators().filter(
    (op) => op.affiliateEnabled && operatorEligibleInCountry(op, country)
  );
}

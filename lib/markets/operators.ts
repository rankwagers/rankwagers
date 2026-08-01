import { listOperators } from "@/lib/operators/registry";
import { resolveOperatorAvailability } from "@/lib/operators/availability";
import type { Operator, OperatorCountryAvailability } from "@/lib/operators/types";
import type { MarketDefinition } from "./types";

export type MarketOperatorRow = {
  operator: Operator;
  availability: OperatorCountryAvailability;
};

export function operatorsForMarket(
  market: MarketDefinition,
  visitorCountry: string | null | undefined
): MarketOperatorRow[] {
  const operators = listOperators().filter((operator) => {
    if (!market.operatorMarketKey) return operator.affiliateEnabled;
    return operator.supportedMarkets.includes(market.operatorMarketKey);
  });

  return operators
    .filter((operator) => operator.affiliateEnabled)
    .map((operator) => ({
      operator,
      availability: resolveOperatorAvailability(operator, visitorCountry),
    }))
    .sort((left, right) => {
      if (left.availability.available !== right.availability.available) {
        return left.availability.available ? -1 : 1;
      }
      return left.operator.name.localeCompare(right.operator.name);
    });
}

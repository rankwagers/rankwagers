import { resolveOperatorAvailability } from "@/lib/operators/availability";
import { getOperator, listOperators } from "@/lib/operators/registry";
import type { Operator, OperatorCountryAvailability } from "@/lib/operators/types";
import type { CompetitionDefinition } from "./types";

export type CompetitionOperatorRow = {
  operator: Operator;
  availability: OperatorCountryAvailability;
};

export function operatorsForCompetition(
  competition: CompetitionDefinition,
  visitorCountry: string | null | undefined
): CompetitionOperatorRow[] {
  const preferred = competition.relatedOperatorSlugs
    .map((slug) => getOperator(slug))
    .filter((operator): operator is Operator => Boolean(operator));

  const fallback = listOperators().filter((operator) => operator.affiliateEnabled);
  const source = preferred.length ? preferred : fallback;

  return source
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

import { getBookmakerMapping, mappingAllowsPositiveAvailability } from "@/lib/operators/bookmaker-mapping";
import {
  getMarketMapping,
  marketMappingIsUsable,
  preferenceToCanonicalMarketId,
  oddsKeyToCanonicalMarketId,
} from "@/lib/operators/market-mapping";
import type { Operator } from "@/lib/operators/types";
import { findQuotesForSelection } from "./bookmaker-quotes";
import {
  classifyOperatorPriceFreshness,
  priceFreshnessAllowsPricing,
  type OperatorPriceFreshness,
} from "./operator-freshness";
import type { ComboSelection, OperatorAvailabilityKind } from "./types";

function operatorSupportsMarket(operator: Operator, marketKind: string): boolean {
  return operator.supportedMarkets.includes(
    marketKind as Operator["supportedMarkets"][number]
  );
}

function operatorEligibleInCountry(operator: Operator, country?: string): boolean {
  if (!country) return true;
  if (!operator.supportedCountries.length) return true;
  return operator.supportedCountries.includes(country.toUpperCase());
}

export type SelectionAvailability =
  | {
      status: "available";
      odds?: number;
      providerBookmakerId: string;
      providerFixtureId?: string;
      providerMarketId?: string;
      verifiedAt: string;
      priceFreshness: OperatorPriceFreshness;
    }
  | {
      status: "unavailable";
      reason: string;
      diagnosticReason: string;
    }
  | {
      status: "unknown";
      reason: string;
      diagnosticReason: string;
    };

export type ComboAvailabilityResolution = {
  availability: OperatorAvailabilityKind;
  availableCount: number;
  missingMarketIds: string[];
  countryEligible: boolean;
  selections: SelectionAvailability[];
  operatorCombinedOdds?: number;
  operatorOddsFreshness?: OperatorPriceFreshness;
  publicReasons: string[];
  diagnosticReasons: string[];
};

function oddsKeyForSelection(selection: ComboSelection): string {
  return selection.oddsMarketKey;
}

/**
 * Resolve selection-level availability for one operator.
 * Unverified mappings always yield unknown — never upgraded.
 */
export function resolveSelectionAvailability(input: {
  operator: Operator;
  selection: ComboSelection;
  country?: string;
  now?: number;
}): SelectionAvailability {
  const { operator, selection, country } = input;
  const now = input.now ?? Date.now();

  if (!operator.affiliateEnabled) {
    return {
      status: "unavailable",
      reason: "Operator unavailable",
      diagnosticReason: "operator_disabled",
    };
  }

  if (!operatorEligibleInCountry(operator, country)) {
    return {
      status: "unavailable",
      reason: "Not available in your country",
      diagnosticReason: "country_ineligible",
    };
  }

  const mapping = getBookmakerMapping(operator.slug);
  if (!mapping || !mapping.enabled) {
    return {
      status: "unavailable",
      reason: "Operator unavailable",
      diagnosticReason: "mapping_disabled",
    };
  }

  if (!mappingAllowsPositiveAvailability(mapping)) {
    return {
      status: "unknown",
      reason: "Availability could not be confirmed",
      diagnosticReason:
        mapping.confidence === "unverified"
          ? "mapping_unverified_empty_ids"
          : "mapping_lacks_provider_ids",
    };
  }

  const canonical =
    preferenceToCanonicalMarketId(selection.marketId) ??
    oddsKeyToCanonicalMarketId(selection.oddsMarketKey);
  if (!canonical) {
    return {
      status: "unavailable",
      reason: "Market not supported",
      diagnosticReason: "unsupported_canonical_market",
    };
  }

  const marketMap = getMarketMapping(operator.slug, canonical);
  if (!marketMap) {
    return {
      status: "unknown",
      reason: "Availability could not be confirmed",
      diagnosticReason: "market_mapping_missing",
    };
  }
  if (!marketMappingIsUsable(marketMap)) {
    // Explicit unsupported (enabled false without keys) → unknown unless markets hard-unsupported
    if (!operatorSupportsMarket(operator, selection.marketKind)) {
      return {
        status: "unavailable",
        reason: "Market not supported",
        diagnosticReason: "market_explicitly_unsupported",
      };
    }
    return {
      status: "unknown",
      reason: "Availability could not be confirmed",
      diagnosticReason: "market_mapping_disabled",
    };
  }

  const quotes = findQuotesForSelection({
    matchId: selection.matchId,
    oddsKey: oddsKeyForSelection(selection),
    providerBookmakerIds: mapping.providerBookmakerIds,
  });

  if (!quotes.length) {
    // Mapping verified but no quote observed — availability unknown, not fabricated available
    return {
      status: "unknown",
      reason: "Availability could not be confirmed",
      diagnosticReason: "no_operator_quote",
    };
  }

  const best = [...quotes].sort((a, b) => a.decimal - b.decimal)[0];
  const freshness = classifyOperatorPriceFreshness(best.observedAt, now);
  if (!priceFreshnessAllowsPricing(freshness)) {
    return {
      status: "unknown",
      reason:
        freshness === "stale"
          ? "Odds stale — availability needs refresh"
          : "Availability could not be confirmed",
      diagnosticReason: `stale_or_unavailable_price:${freshness}`,
    };
  }

  if (!(best.decimal > 1)) {
    return {
      status: "unavailable",
      reason: "Market not available",
      diagnosticReason: "invalid_decimal",
    };
  }

  return {
    status: "available",
    odds: best.decimal,
    providerBookmakerId: best.providerBookmakerId,
    providerFixtureId: best.providerFixtureId
      ? String(best.providerFixtureId)
      : undefined,
    providerMarketId: marketMap.providerMarketId,
    verifiedAt: best.observedAt,
    priceFreshness: freshness,
  };
}

export function computeOperatorCombinedOdds(
  legs: readonly SelectionAvailability[]
): { combinedOdds?: number; freshness?: OperatorPriceFreshness } {
  if (!legs.length || !legs.every((l) => l.status === "available")) {
    return {};
  }
  const available = legs as Extract<SelectionAvailability, { status: "available" }>[];
  const bookmakerIds = new Set(available.map((l) => l.providerBookmakerId));
  if (bookmakerIds.size !== 1) return {}; // mixed bookmakers rejected
  if (!available.every((l) => l.odds != null && l.odds > 1)) return {};
  if (!available.every((l) => priceFreshnessAllowsPricing(l.priceFreshness))) {
    return {};
  }
  let product = 1;
  let worst: OperatorPriceFreshness = "current";
  const rank: OperatorPriceFreshness[] = [
    "unavailable",
    "stale",
    "recently_updated",
    "current",
  ];
  for (const leg of available) {
    product *= leg.odds!;
    if (rank.indexOf(leg.priceFreshness) < rank.indexOf(worst)) {
      worst = leg.priceFreshness;
    }
  }
  return { combinedOdds: Math.round(product * 100) / 100, freshness: worst };
}

/**
 * Aggregate selection availability into combo availability.
 * Unknown never upgrades to partial/full.
 */
export function resolveComboOperatorAvailability(input: {
  operator: Operator;
  selections: readonly ComboSelection[];
  country?: string;
  now?: number;
}): ComboAvailabilityResolution {
  const countryEligible = operatorEligibleInCountry(
    input.operator,
    input.country
  );
  const publicReasons: string[] = [];
  const diagnosticReasons: string[] = [];

  if (!countryEligible) {
    return {
      availability: "none",
      availableCount: 0,
      missingMarketIds: input.selections.map((s) => s.marketId),
      countryEligible: false,
      selections: input.selections.map(() => ({
        status: "unavailable" as const,
        reason: "Not available in your country",
        diagnosticReason: "country_ineligible",
      })),
      publicReasons: ["Not available in your country"],
      diagnosticReasons: ["country_ineligible"],
    };
  }

  if (!input.operator.affiliateEnabled) {
    return {
      availability: "none",
      availableCount: 0,
      missingMarketIds: input.selections.map((s) => s.marketId),
      countryEligible: true,
      selections: input.selections.map(() => ({
        status: "unavailable" as const,
        reason: "Operator unavailable",
        diagnosticReason: "operator_disabled",
      })),
      publicReasons: ["Operator unavailable"],
      diagnosticReasons: ["operator_disabled"],
    };
  }

  const selections = input.selections.map((selection) =>
    resolveSelectionAvailability({
      operator: input.operator,
      selection,
      country: input.country,
      now: input.now,
    })
  );

  const availableCount = selections.filter((s) => s.status === "available").length;
  const unavailableCount = selections.filter(
    (s) => s.status === "unavailable"
  ).length;
  const unknownCount = selections.filter((s) => s.status === "unknown").length;
  const missingMarketIds = input.selections
    .filter((_, i) => selections[i].status !== "available")
    .map((s) => s.marketId);

  for (const sel of selections) {
    if (sel.status !== "available") {
      diagnosticReasons.push(sel.diagnosticReason);
    }
  }

  // Hard rule: any unknown without explicit available/unavailable split → unknown combo
  // unless every leg is unavailable (then unavailable) or every leg available (full).
  let availability: OperatorAvailabilityKind;
  if (availableCount === input.selections.length && input.selections.length > 0) {
    availability = "full";
    publicReasons.push("Verified availability");
  } else if (unavailableCount === input.selections.length && input.selections.length > 0) {
    availability = "none";
    publicReasons.push("Not available for this combination");
  } else if (availableCount > 0 && unknownCount === 0) {
    // partial: known available count + at least one explicitly unavailable
    availability = "partial";
    publicReasons.push(
      `${availableCount} of ${input.selections.length} selections available`
    );
  } else if (availableCount > 0 && unknownCount > 0) {
    // Has some available but also unknown — still partial with known available count
    availability = "partial";
    publicReasons.push(
      `${availableCount} of ${input.selections.length} selections available`
    );
    publicReasons.push("Availability could not be confirmed for remaining selections");
  } else {
    // No positive available legs — unknown (never fabricate partial from supportedMarkets)
    availability = "unknown";
    publicReasons.push("Availability could not be confirmed");
  }

  const priced = computeOperatorCombinedOdds(selections);
  if (availability === "full" && priced.combinedOdds == null) {
    publicReasons.push("Combined operator odds unavailable");
  }
  if (countryEligible) publicReasons.push("Available in your country");

  return {
    availability,
    availableCount,
    missingMarketIds,
    countryEligible,
    selections,
    operatorCombinedOdds: priced.combinedOdds,
    operatorOddsFreshness: priced.freshness,
    publicReasons,
    diagnosticReasons,
  };
}

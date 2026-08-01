import { getBrand, bonusForCountry } from "@/lib/brands";
import { buildGoPath } from "@/lib/operators/go-path";
import { getDeeplinkConfig } from "@/lib/operators/deeplink-registry";
import { priceFreshnessAllowsHighestOddsBadge } from "./operator-freshness";
import {
  listEligibleOperators,
  selectionAvailabilityForOperator,
} from "./availability";
import type {
  ComboDeeplinkType,
  ComboOperatorMatch,
  ComboRequest,
  EvidenceCombo,
  OperatorAvailabilityKind,
} from "./types";

export type PublicOperatorReasonCode =
  | "full_combo_available"
  | "partial_combo_available"
  | "availability_unverified"
  | "highest_verified_combined_odds"
  | "direct_betslip_supported"
  | "direct_market_links_supported"
  | "available_in_country"
  | "relevant_offer_available"
  | "mobile_supported";

function availabilityRank(kind: OperatorAvailabilityKind): number {
  // Hard order: full > partial > unknown > none
  switch (kind) {
    case "full":
      return 4;
    case "partial":
      return 3;
    case "unknown":
      return 2;
    case "none":
      return 0;
  }
}

function resolveDeeplinkType(
  availability: OperatorAvailabilityKind,
  countryEligible: boolean,
  operatorId: string,
  country?: string
): { deeplinkType: ComboDeeplinkType; fallbackReason?: string } {
  if (!countryEligible || availability === "none") {
    return { deeplinkType: "unavailable" };
  }
  const config = getDeeplinkConfig(operatorId, country);
  if (!config?.enabled) {
    return {
      deeplinkType: "unavailable",
      fallbackReason: "deeplink_config_missing",
    };
  }
  // Never invent betslip/market/fixture — only configured capabilities.
  if (config.capabilities.includes("football_landing")) {
    return {
      deeplinkType: "football_landing",
      fallbackReason: undefined,
    };
  }
  if (config.capabilities.includes("homepage")) {
    return {
      deeplinkType: "homepage",
      fallbackReason:
        availability === "full"
          ? "fell_back_to:homepage"
          : "opens_operator_homepage",
    };
  }
  return { deeplinkType: "unavailable", fallbackReason: "no_capability" };
}

function buildOutboundPath(
  slug: string,
  combo: EvidenceCombo,
  rank: number,
  deeplinkType: ComboDeeplinkType,
  availability: OperatorAvailabilityKind,
  operatorCombinedOdds?: number
): string {
  return buildGoPath({
    slug,
    placement: "combo_studio",
    subid: `combo_${combo.id}_${rank}`,
    comboId: combo.id,
    country: combo.request.country,
    locale: combo.request.locale,
    operatorRank: rank,
    availability,
    deeplinkType,
    selectionCount: combo.selections.length,
    targetOddsMin: combo.request.targetOddsMin,
    targetOddsMax: combo.request.targetOddsMax,
    actualComboOdds: combo.combinedOdds,
    operatorComboOdds: operatorCombinedOdds,
    evidenceStrength: combo.aggregateEvidenceStrength,
    marketTypes: combo.selections.map((s) => s.marketId),
  });
}

function publicReasonLabels(codes: PublicOperatorReasonCode[]): string[] {
  const labels: Record<PublicOperatorReasonCode, string> = {
    full_combo_available: "Verified availability",
    partial_combo_available: "Partial combo available",
    availability_unverified: "Availability could not be confirmed",
    highest_verified_combined_odds: "Highest verified combined odds",
    direct_betslip_supported: "Direct bet slip supported",
    direct_market_links_supported: "Direct market links supported",
    available_in_country: "Available in your country",
    relevant_offer_available: "Relevant welcome offer — terms apply",
    mobile_supported: "Mobile supported",
  };
  return codes.map((c) => labels[c]);
}

function matchScore(input: {
  availability: OperatorAvailabilityKind;
  countryEligible: boolean;
  deeplinkType: ComboDeeplinkType;
  rating: number;
  commercialPriority: number;
  hasOffer: boolean;
  hasVerifiedOdds: boolean;
  mobileSupported: boolean;
}): number {
  if (!input.countryEligible) return -1000;
  let score = availabilityRank(input.availability) * 1000;
  score +=
    input.deeplinkType === "betslip"
      ? 40
      : input.deeplinkType === "market"
        ? 30
        : input.deeplinkType === "fixture"
          ? 20
          : input.deeplinkType === "football_landing"
            ? 12
            : 8;
  if (input.hasVerifiedOdds) score += 25;
  score += input.rating * 2;
  score += input.hasOffer ? 5 : 0;
  score += input.mobileSupported ? 3 : 0;
  score += Math.min(10, input.commercialPriority); // bounded commercial
  return score;
}

/**
 * Match combo to affiliate operators.
 * Hard rule: country eligibility and availability beat commercial priority.
 */
export function matchOperatorsForCombo(
  combo: EvidenceCombo,
  request: ComboRequest = combo.request
): ComboOperatorMatch[] {
  const country = request.country ?? request.rankingCountry;
  const operators = listEligibleOperators(country);
  const rows: ComboOperatorMatch[] = [];

  for (const operator of operators) {
    const brand = getBrand(operator.slug);
    const availability = selectionAvailabilityForOperator(
      operator,
      combo.selections,
      country
    );
    if (availability.availability === "none" && !availability.countryEligible) {
      continue;
    }

    const { deeplinkType, fallbackReason } = resolveDeeplinkType(
      availability.availability,
      availability.countryEligible,
      operator.slug,
      country
    );
    const offer = brand
      ? bonusForCountry(brand, country ?? "") || brand.bonus
      : undefined;
    const commercialPriority = Math.round((brand?.rating ?? 0) * 2);
    const hasVerifiedOdds =
      availability.operatorCombinedOdds != null &&
      availability.availability === "full" &&
      priceFreshnessAllowsHighestOddsBadge(
        (availability.operatorOddsFreshness as
          | "current"
          | "recently_updated"
          | "stale"
          | "unavailable") ?? "unavailable"
      );

    const score = matchScore({
      availability: availability.availability,
      countryEligible: availability.countryEligible,
      deeplinkType,
      rating: brand?.rating ?? 0,
      commercialPriority,
      hasOffer: Boolean(offer),
      hasVerifiedOdds,
      mobileSupported: true,
    });

    const codes: PublicOperatorReasonCode[] = [];
    if (availability.availability === "full") codes.push("full_combo_available");
    else if (availability.availability === "partial") {
      codes.push("partial_combo_available");
    } else if (availability.availability === "unknown") {
      codes.push("availability_unverified");
    }
    if (availability.countryEligible) codes.push("available_in_country");
    if (deeplinkType === "betslip") codes.push("direct_betslip_supported");
    if (deeplinkType === "market") codes.push("direct_market_links_supported");
    if (offer && availability.countryEligible) {
      codes.push("relevant_offer_available");
    }
    codes.push("mobile_supported");

    const reasons = publicReasonLabels(codes);
    if (fallbackReason === "fell_back_to:homepage") {
      reasons.push("Opens operator homepage");
    } else if (deeplinkType === "football_landing") {
      reasons.push("Opens football markets");
    } else if (deeplinkType === "homepage") {
      reasons.push("Opens operator homepage");
    }
    if (
      availability.availability === "full" &&
      availability.operatorCombinedOdds == null
    ) {
      reasons.push("Combined operator odds unavailable");
    }
    if (availability.operatorOddsFreshness === "recently_updated") {
      reasons.push("Odds recently updated");
    }
    if (availability.operatorOddsFreshness === "stale") {
      reasons.push("Odds stale");
    }

    let badge: ComboOperatorMatch["badge"];
    if (availability.availability === "full") badge = "full_combo";
    else if (availability.availability === "partial") badge = "partial";

    rows.push({
      operatorId: operator.slug,
      slug: operator.slug,
      displayName: operator.name,
      logo: operator.logo,
      availability: availability.availability,
      availableSelectionCount: availability.availableCount,
      totalSelections: combo.selections.length,
      missingMarketIds: availability.missingMarketIds,
      combinedOdds: availability.operatorCombinedOdds,
      countryEligible: availability.countryEligible,
      deeplinkType,
      outboundPath: "",
      offerSummary: availability.countryEligible ? offer : undefined,
      mobileSupported: true,
      reasons,
      badge,
      matchScore: score,
      rank: 0,
    });
  }

  rows.sort((a, b) => {
    const availDiff =
      availabilityRank(b.availability) - availabilityRank(a.availability);
    if (availDiff) return availDiff;
    const aOdds = a.combinedOdds ?? 0;
    const bOdds = b.combinedOdds ?? 0;
    if (a.availability === "full" && b.availability === "full" && bOdds !== aOdds) {
      return bOdds - aOdds;
    }
    if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
    return a.slug.localeCompare(b.slug);
  });

  const fullPrimary = rows.find(
    (r) => r.availability === "full" && r.countryEligible
  );
  if (fullPrimary) fullPrimary.badge = "best_match";

  // Highest Compatible Odds — only verified fresh operator prices
  const pricedFull = rows.filter(
    (r) =>
      r.availability === "full" &&
      r.combinedOdds != null &&
      r.countryEligible
  );
  if (pricedFull.length) {
    const best = [...pricedFull].sort(
      (a, b) => (b.combinedOdds ?? 0) - (a.combinedOdds ?? 0)
    )[0];
    if (best.badge !== "best_match") best.badge = "highest_odds";
    else {
      // keep best_match; annotate reason
      if (!best.reasons.includes("Highest verified combined odds")) {
        best.reasons.push("Highest verified combined odds");
      }
    }
  }

  return rows.map((row, index) => {
    const rank = index + 1;
    const outboundPath =
      row.deeplinkType === "unavailable"
        ? ""
        : buildOutboundPath(
            row.slug,
            combo,
            rank,
            row.deeplinkType,
            row.availability,
            row.combinedOdds
          );
    return {
      ...row,
      rank,
      outboundPath,
    };
  });
}

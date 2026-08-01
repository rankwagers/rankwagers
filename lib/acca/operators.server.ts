import "server-only";

import { isAffiliateConfigured } from "@/lib/affiliate";
import { brandsForCountry, getBrand } from "@/lib/brands";
import { buildGoPath } from "@/lib/operators/go-path";
import { stakeModel } from "./odds";
import type { AccaOperatorOffer, AccaSlip } from "./types";

/**
 * Server-only operator offers for Acca handoff.
 * Signs CTAs with placement acca_studio — never call from client components.
 */
export function buildAccaOperatorOffers(input: {
  slip: Pick<AccaSlip, "id" | "selections" | "stake" | "locale">;
  country?: string | null;
  limit?: number;
}): AccaOperatorOffer[] {
  const country = input.country ?? null;
  const brands = brandsForCountry(country).filter((b) => isAffiliateConfigured(b));
  const list = (brands.length ? brands : []).slice(0, input.limit ?? 6);
  // Fallback: if geo list empty, still surface configured brands without inventing availability.
  const pool =
    list.length > 0
      ? list
      : ["1xbet", "melbet", "bet-and-you"]
          .map((slug) => getBrand(slug))
          .filter((b): b is NonNullable<typeof b> => Boolean(b && isAffiliateConfigured(b)));

  const stake = stakeModel(input.slip.selections, input.slip.stake);
  const marketTypes = input.slip.selections.map((s) => s.marketKey);

  return pool.slice(0, input.limit ?? 6).map((brand, index) => {
    const rank = index + 1;
    const signedHref = buildGoPath({
      slug: brand.slug,
      placement: "acca_studio",
      subid: `acca_${input.slip.id}_${rank}`,
      comboId: input.slip.id,
      country: country ?? undefined,
      locale: input.slip.locale,
      operatorRank: rank,
      availability: "unknown",
      deeplinkType: "football_landing",
      selectionCount: input.slip.selections.length,
      actualComboOdds: stake.combinedOdds ?? undefined,
      marketTypes,
    });
    return {
      slug: brand.slug,
      name: brand.name,
      rank,
      signedHref,
      reviewHref: `/${input.slip.locale}/reviews/${brand.slug}`,
      availabilityNote:
        "Availability is not verified as a single bet slip. You open the operator to place manually — RankWagers never places bets.",
    };
  });
}

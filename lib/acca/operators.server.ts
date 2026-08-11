import "server-only";

import { isAffiliateConfigured } from "@/lib/affiliate";
import { brandsForCountry, getBrand } from "@/lib/brands";
import { getOperator } from "@/lib/operators/registry";
import { resolveOperatorAvailability } from "@/lib/operators/availability";
import { buildGoPath } from "@/lib/operators/go-path";
import { publicationOddsForFixture } from "@/lib/odds-history/publication";
import { stakeModel } from "./odds";
import type { AccaOperatorOffer, AccaSelection, AccaSlip } from "./types";

/*
 * THE SLIP-COMPLETE DECISION POINT — server-only operator offers.
 *
 * Governing laws applied here, where the intent is hottest:
 *   · availability is a PRECONDITION and the first ordering key; verified
 *     status is the second; the brand list's disclosed score order is only
 *     the stable tie-break. No other ranking input exists.
 *   · observed odds for the slip's fixtures come from the stored history,
 *     frozen at each fixture's kickoff — never a live price, never invented;
 *     an operator with no observation simply shows none (empty-state law).
 *   · one Continue per operator, server-signed (placement `acca_studio`),
 *     visibly commercial. The detail link goes to the CANONICAL operator
 *     page — the reviews route is retired.
 */

/** Slip market keys → odds-history market keys (only these are ever observed). */
const HISTORY_MARKET_BY_ACCA_KEY: Record<string, string> = {
  over15: "over15",
  over25: "over25",
  fh05: "fh",
  sh05: "sh",
};

async function observedForSlip(
  selections: readonly Pick<AccaSelection, "matchId" | "marketKey" | "kickoffAt">[]
): Promise<Map<number, Array<{ market: string; decimal: number; observedAt: string }>>> {
  const byOperator = new Map<number, Array<{ market: string; decimal: number; observedAt: string }>>();
  for (const selection of selections) {
    const historyMarket = HISTORY_MARKET_BY_ACCA_KEY[selection.marketKey];
    if (!historyMarket || !selection.kickoffAt) continue;
    const prices = await publicationOddsForFixture(selection.matchId, selection.kickoffAt);
    for (const price of prices) {
      if (price.market !== historyMarket) continue;
      const rows = byOperator.get(price.operatorId) ?? [];
      rows.push({ market: selection.marketKey, decimal: price.decimal, observedAt: price.observedAt });
      byOperator.set(price.operatorId, rows);
    }
  }
  return byOperator;
}

/**
 * Signs CTAs with placement acca_studio — never call from client components.
 */
export async function buildAccaOperatorOffers(input: {
  slip: Pick<AccaSlip, "id" | "selections" | "stake" | "locale">;
  country?: string | null;
  limit?: number;
}): Promise<AccaOperatorOffer[]> {
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
  const observed = await observedForSlip(input.slip.selections);

  const offers = pool.slice(0, input.limit ?? 6).map((brand, index) => {
    const operator = getOperator(brand.slug);
    const availability = operator
      ? resolveOperatorAvailability(operator, country ?? "")
      : null;
    const available = availability ? availability.available : false;
    const verified = operator?.verificationStatus === "verified";
    const observedOdds = (operator?.apiFootballBookmakerIds ?? [])
      .flatMap((id) => observed.get(id) ?? [])
      .sort((a, b) => a.market.localeCompare(b.market) || b.decimal - a.decimal);
    return { brand, scoreRank: index + 1, available, verified, observedOdds };
  });

  /* availability first, verified second; the disclosed score order breaks ties. */
  offers.sort(
    (a, b) =>
      Number(b.available) - Number(a.available) ||
      Number(b.verified) - Number(a.verified) ||
      a.scoreRank - b.scoreRank
  );

  return offers.map((offer, index) => {
    const rank = index + 1;
    const signedHref = buildGoPath({
      slug: offer.brand.slug,
      placement: "acca_studio",
      subid: `acca_${input.slip.id}_${rank}`,
      comboId: input.slip.id,
      country: country ?? undefined,
      locale: input.slip.locale,
      operatorRank: rank,
      availability: offer.available ? "full" : "unknown",
      deeplinkType: "football_landing",
      selectionCount: input.slip.selections.length,
      actualComboOdds: stake.combinedOdds ?? undefined,
      marketTypes,
    });
    return {
      slug: offer.brand.slug,
      name: offer.brand.name,
      rank,
      available: offer.available,
      verified: offer.verified,
      observedOdds: offer.observedOdds,
      signedHref: offer.available ? signedHref : null,
      detailHref: `/${input.slip.locale}/operators/${offer.brand.slug}`,
    };
  });
}

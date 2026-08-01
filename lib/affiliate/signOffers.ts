/**
 * Server-only: attach signed r2 outbound paths to resolved affiliate offers.
 */

import "server-only";

import { buildGoPath } from "@/lib/operators/go-path";
import type { ResolvedOperatorOffer } from "@/lib/affiliate/operators";

export function signAffiliateOffers(
  offers: ResolvedOperatorOffer[],
  meta: {
    fixtureId: number;
    market: string;
    subid: string;
    fixtureLabel?: string;
    league?: string;
    country?: string;
  }
): ResolvedOperatorOffer[] {
  return offers.map((offer) => ({
    ...offer,
    outboundPath: buildGoPath({
      slug: offer.slug,
      placement: "fixture_operator",
      subid: `${meta.subid}-${meta.fixtureId}-${meta.market}`,
      country: meta.country,
      availability: "unknown",
      deeplinkType: "homepage",
      extraQuery: {
        fixture_id: String(meta.fixtureId),
        market: meta.market,
        fixture_label: meta.fixtureLabel,
        league: meta.league,
      },
    }),
  }));
}

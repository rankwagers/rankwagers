import { affiliatePartners, type AffiliatePartner } from "@/lib/affiliate/operators";
import { buildGoPath } from "@/lib/operators/go-path";
import { sortPartnersForCountry } from "./ranking";
import type { CountryContext } from "./types";

export type HomepageOperatorCard = {
  slug: string;
  name: string;
  logo?: string;
  highlights: string[];
  outboundPath: string;
};

export function getFeaturedCompetitions(countryContext: CountryContext): readonly string[] {
  return countryContext.topLeagues;
}

export function getHomepageOperators(
  countryContext: CountryContext,
  limit = 2,
  subidBase = "homepage-top-operators"
): HomepageOperatorCard[] {
  const preferred = new Set(
    countryContext.supportedPartners.map((slug) => slug.toLowerCase())
  );
  const available = affiliatePartners.filter(
    (partner) =>
      partner.isConfigured &&
      (preferred.size === 0 || preferred.has(partner.slug.toLowerCase())) &&
      (!partner.acceptedCountries.length ||
        partner.acceptedCountries.includes(countryContext.country))
  );

  const ranked = sortPartnersForCountry(
    available.length ? available : affiliatePartners.filter((partner) => partner.isConfigured),
    countryContext
  );

  return ranked.slice(0, limit).map((partner, index) =>
    toOperatorCard(partner, subidBase, index + 1)
  );
}

function toOperatorCard(
  partner: AffiliatePartner,
  subidBase: string,
  slot: number
): HomepageOperatorCard {
  return {
    slug: partner.slug,
    name: partner.canonicalName,
    logo: partner.logo,
    highlights: partner.highlights.slice(0, 2),
    outboundPath: buildGoPath({
      slug: partner.slug,
      placement: "homepage_operator",
      subid: `${subidBase}_${slot}`,
      availability: "unknown",
      deeplinkType: "homepage",
      operatorRank: slot,
    }),
  };
}

import type { AffiliatePartner } from "@/lib/affiliate/operators";
import type { PartnerMetricValues } from "@/lib/affiliate/partnerRanking";
import type { CountryContext } from "./types";

/**
 * Higher score for earlier entries in the country profile partner list.
 * Future CTR/EPC/FTD metrics can be merged into the returned object.
 */
export function countryPreferenceScore(
  partnerSlug: string,
  supportedPartners: readonly string[]
): number {
  const index = supportedPartners.findIndex(
    (slug) => slug.toLowerCase() === partnerSlug.toLowerCase()
  );
  if (index < 0) return 0;
  return Math.max(0, 40 - index * 5);
}

export function partnerMetricsForCountry(input: {
  partner: AffiliatePartner;
  countryContext: CountryContext;
  device?: "desktop" | "mobile" | "tablet" | "unknown";
  performance?: PartnerMetricValues;
}): PartnerMetricValues {
  const mobileFriendly = input.partner.highlights.some((item) =>
    /\bmobile app\b/i.test(item)
  );
  return {
    country_preference: countryPreferenceScore(
      input.partner.slug,
      input.countryContext.supportedPartners
    ),
    device_support:
      input.device === "mobile" || input.device === "tablet" ? mobileFriendly : true,
    ...input.performance,
  };
}

export function sortPartnersForCountry(
  partners: readonly AffiliatePartner[],
  countryContext: CountryContext
): AffiliatePartner[] {
  return [...partners].sort((left, right) => {
    const scoreDelta =
      countryPreferenceScore(right.slug, countryContext.supportedPartners) -
      countryPreferenceScore(left.slug, countryContext.supportedPartners);
    if (scoreDelta !== 0) return scoreDelta;
    return left.canonicalName.localeCompare(right.canonicalName);
  });
}

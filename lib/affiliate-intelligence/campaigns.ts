import { BRANDS } from "@/lib/brands";
import { isAffiliateConfigured } from "@/lib/affiliate";
import type { CampaignRecord } from "./contracts";

/**
 * Campaign inventory — honest about missing campaign IDs.
 * Product does not yet stamp campaignId on /go clicks.
 */
export function buildCampaignInventory(): CampaignRecord[] {
  return BRANDS.map((brand) => {
    const configured = isAffiliateConfigured(brand);
    return {
      campaignId: `default:${brand.slug}`,
      operatorId: brand.slug,
      partnerId: brand.slug,
      placementEligibility: [
        "homepage_operator",
        "fixture_operator",
        "operator_page",
        "acca_studio",
        "brand_list",
      ],
      localeCountryEligibility: brand.acceptedCountries?.length
        ? `countries:${brand.acceptedCountries.join(",")}`
        : "no_country_restriction_configured",
      destinationMapped: configured,
      activePeriod: null,
      status: configured ? "unknown" : "unavailable",
      lastVerifiedAt: null,
      attributionMapping: "placement + operator; campaignId not set by /go today",
      issueStatus: configured
        ? "campaign_id_not_stamped"
        : "destination_unconfigured",
      notes: [
        "No fabricated bonus claims or campaign end dates.",
        "Postback adapters are disabled shells unless manually configured.",
      ],
    };
  });
}

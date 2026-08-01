import { BRANDS, type Brand } from "@/lib/brands";
import { isAffiliateConfigured } from "@/lib/affiliate";
import { buildGoPathUnsigned } from "@/lib/operators/go-path-shared";
import { countryPreferenceScore } from "@/lib/personalization/ranking";
import type { CountryContext } from "@/lib/personalization/types";
import { PartnerRankingService, type PartnerMetricValues } from "./partnerRanking";

export interface AffiliatePartner {
  id: string;
  slug: string;
  canonicalName: string;
  aliases: string[];
  apiFootballBookmakerIds: number[];
  isConfigured: boolean;
  acceptedCountries: string[];
  /** @deprecated Legacy list order. It does not affect partner ranking. */
  priority?: number;
  /** Explicit additive score set by verified partner policy. */
  priorityOverride?: number;
  logo?: string;
  highlights: string[];
  crypto: boolean;
  rating: number;
  payoutTime?: string;
  licenses?: string[];
}

export type OfferAvailability =
  | "verified-market"
  | "partner-available"
  | "region-restricted"
  | "unavailable";

export interface ResolvedOperatorOffer {
  partnerId: string;
  slug: string;
  displayName: string;
  bookmakerId?: number;
  odds?: number;
  oddsVerified: boolean;
  oddsUpdatedAt?: string;
  logo?: string;
  highlights: string[];
  crypto: boolean;
  rating: number;
  payoutTime?: string;
  licenses?: string[];
  outboundPath: string;
  availability: OfferAvailability;
  matchMethod: "bookmaker-id" | "exact-name" | "explicit-alias" | "partner-only";
  linkType: "fixture-deeplink" | "market-deeplink" | "sportsbook" | "homepage";
}

export type BookmakerQuote = {
  id: number;
  name: string;
  decimal: number;
};

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function toPartner(brand: Brand): AffiliatePartner {
  return {
    id: brand.slug,
    slug: brand.slug,
    canonicalName: brand.name,
    aliases: [brand.name, brand.slug],
    // IDs are intentionally empty until verified against API-Football's bookmaker catalog.
    apiFootballBookmakerIds: [],
    isConfigured: isAffiliateConfigured(brand),
    acceptedCountries: brand.acceptedCountries ?? [],
    logo: brand.logo,
    highlights: brand.highlights,
    crypto: brand.crypto,
    rating: brand.rating,
    payoutTime: brand.payoutTime,
    licenses: brand.licenses,
  };
}

export const affiliatePartners: AffiliatePartner[] = BRANDS.map(toPartner);
const partnerRankingService = new PartnerRankingService();

function partnerMatchMethod(
  partner: AffiliatePartner,
  quote: BookmakerQuote
): ResolvedOperatorOffer["matchMethod"] | null {
  if (partner.apiFootballBookmakerIds.includes(quote.id)) return "bookmaker-id";
  const bookmakerName = normalize(quote.name);
  if (normalize(partner.canonicalName) === bookmakerName) return "exact-name";
  if (partner.aliases.some((alias) => normalize(alias) === bookmakerName)) return "explicit-alias";
  return null;
}

function allowedInCountry(partner: AffiliatePartner, country?: string): boolean {
  if (!partner.acceptedCountries.length || !country) return true;
  return partner.acceptedCountries.includes(country.toUpperCase());
}

export function resolveAffiliateOffers({
  marketOdds,
  oddsUpdatedAt,
  countryCode,
  countryContext,
  preferredPartnerSlugs,
  device,
  performanceBySlug,
  fixtureId,
  fixtureLabel,
  league,
  market,
  subid,
  partners = affiliatePartners,
}: {
  marketOdds: BookmakerQuote[];
  oddsUpdatedAt?: string;
  countryCode?: string;
  countryContext?: CountryContext;
  preferredPartnerSlugs?: readonly string[];
  device?: "desktop" | "mobile" | "tablet" | "unknown";
  performanceBySlug?: Readonly<Record<string, PartnerMetricValues>>;
  fixtureId: number;
  fixtureLabel?: string;
  league?: string;
  market: string;
  subid: string;
  partners?: AffiliatePartner[];
}): ResolvedOperatorOffer[] {
  const resolvedCountry = countryContext?.country ?? countryCode;
  const preferred =
    preferredPartnerSlugs ??
    countryContext?.supportedPartners ??
    [];

  const candidates = partners
    .map((partner) => {
      const quote = marketOdds.find((candidate) => partnerMatchMethod(partner, candidate) !== null);
      const matchMethod = quote ? partnerMatchMethod(partner, quote)! : "partner-only";
      const available = allowedInCountry(partner, resolvedCountry);
      return {
        partnerId: partner.id,
        slug: partner.slug,
        displayName: partner.canonicalName,
        bookmakerId: quote?.id,
        odds: quote?.decimal,
        oddsVerified: Boolean(quote),
        oddsUpdatedAt: quote ? oddsUpdatedAt : undefined,
        logo: partner.logo,
        highlights: partner.highlights,
        crypto: partner.crypto,
        rating: partner.rating,
        payoutTime: partner.payoutTime,
        licenses: partner.licenses,
        // Unsigned shape only — call signAffiliateOffers (server-only) before UI CTAs.
        outboundPath: buildGoPathUnsigned({
          slug: partner.slug,
          subid: `${subid}-${fixtureId}-${market}`,
          extraQuery: {
            fixture_id: String(fixtureId),
            market,
            fixture_label: fixtureLabel,
            league,
          },
        }),
        linkType: "sportsbook" as const,
        availability: !partner.isConfigured
          ? "unavailable" as const
          : !available
            ? "region-restricted" as const
            : quote
              ? "verified-market" as const
              : "partner-available" as const,
        matchMethod,
      };
    })
    .map((offer, index) => {
      const partner = partners[index];
      const mobileFriendly = partner.highlights.some((item) => /\bmobile app\b/i.test(item));
      const performance = performanceBySlug?.[partner.slug] ?? {};
      return {
        offer,
        partner,
        regionallyAvailable: allowedInCountry(partner, resolvedCountry),
        metrics: {
          country_preference: countryPreferenceScore(partner.slug, preferred),
          device_support:
            device === "mobile" || device === "tablet" ? mobileFriendly : true,
          ...performance,
        } satisfies PartnerMetricValues,
      };
    })
    .filter(({ offer }) => offer.availability === "verified-market" || offer.availability === "partner-available");

  return partnerRankingService.rank(candidates).map(({ offer }) => offer);
}


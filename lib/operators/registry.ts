import { isAffiliateConfigured } from "@/lib/affiliate";
import { affiliatePartners } from "@/lib/affiliate/operators";
import { BRANDS, getBrand, type Brand } from "@/lib/brands";
import type { Operator, OperatorMarketKey } from "./types";

const DEFAULT_MARKETS: readonly OperatorMarketKey[] = ["fh", "over15", "over25", "sh"];

function foundedYearFromBrand(brand: Brand): number | null {
  if (!brand.founded) return null;
  const year = Number.parseInt(brand.founded, 10);
  return Number.isFinite(year) ? year : null;
}

function descriptionFromBrand(brand: Brand): string {
  if (brand.description?.trim()) return brand.description.trim();
  return `${brand.name} is a sportsbook partner covered by RankWagers for market availability, observed odds history, and regional access research.`;
}

export function brandToOperator(brand: Brand): Operator {
  const partner = affiliatePartners.find((row) => row.slug === brand.slug);
  const affiliateEnabled = isAffiliateConfigured(brand);
  return {
    slug: brand.slug,
    name: brand.name,
    logo: brand.logo,
    description: descriptionFromBrand(brand),
    supportedCountries: brand.acceptedCountries ?? [],
    supportedMarkets: DEFAULT_MARKETS,
    website: null,
    affiliateEnabled,
    verificationStatus: affiliateEnabled ? "verified" : "unverified",
    foundedYear: foundedYearFromBrand(brand),
    headquarters: null,
    highlights: brand.highlights ?? [],
    licenses: brand.licenses ?? [],
    apiFootballBookmakerIds: partner?.apiFootballBookmakerIds ?? [],
  };
}

export function listOperators(): Operator[] {
  return BRANDS.map(brandToOperator);
}

export function getOperator(slug: string): Operator | undefined {
  const brand = getBrand(slug);
  return brand ? brandToOperator(brand) : undefined;
}

export function listRelatedOperators(slug: string, limit = 4): Operator[] {
  return listOperators()
    .filter((operator) => operator.slug !== slug && operator.affiliateEnabled)
    .slice(0, limit);
}

export function operatorSlugs(): string[] {
  return BRANDS.map((brand) => brand.slug);
}

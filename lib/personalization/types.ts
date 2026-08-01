/** Request headers set by middleware for SSR consumers. */
export const HEADER_COUNTRY = "x-rw-country";
export const HEADER_SOURCE = "x-rw-country-source";

/** ISO-3166 alpha-2 country code. */
export type CountryCode = string;

export type CountrySource = "override" | "cookie" | "geo" | "unknown";

export type CountryProfile = {
  country: CountryCode;
  language: string;
  currency: string;
  timezone: string;
  topLeagues: readonly string[];
  /** Preferred partner slugs in display/ranking order (must exist in BRANDS). */
  supportedPartners: readonly string[];
};

export type CountryResolution = {
  country: CountryCode;
  source: CountrySource;
};

/** Single source of truth for country-aware personalization. */
export type CountryContext = CountryProfile & {
  source: CountrySource;
};

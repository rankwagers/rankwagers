import type { CountryCode, CountryProfile } from "./types";

/**
 * Configurable country profiles.
 * Adding a country should only require a new entry here (no UI code changes).
 */
export const COUNTRY_PROFILES: Record<string, CountryProfile> = {
  BR: {
    country: "BR",
    language: "pt",
    currency: "BRL",
    timezone: "America/Sao_Paulo",
    topLeagues: ["Brasileirão", "Premier League", "Libertadores"],
    supportedPartners: ["1xbet", "melbet", "bet-and-you", "betwinner", "megapari"],
  },
  NG: {
    country: "NG",
    language: "en",
    currency: "NGN",
    timezone: "Africa/Lagos",
    topLeagues: ["NPFL", "Premier League", "CAF"],
    supportedPartners: ["1xbet", "melbet", "bet-and-you", "megapari", "888starz"],
  },
  JP: {
    country: "JP",
    language: "ja",
    currency: "JPY",
    timezone: "Asia/Tokyo",
    topLeagues: ["J League", "Champions League", "Premier League"],
    supportedPartners: ["1xbet", "bet-and-you", "melbet", "megapari", "betwinner"],
  },
  DE: {
    country: "DE",
    language: "de",
    currency: "EUR",
    timezone: "Europe/Berlin",
    topLeagues: ["Bundesliga", "Champions League", "Premier League"],
    supportedPartners: ["1xbet", "bet-and-you", "melbet", "betwinner", "888starz"],
  },
  GB: {
    country: "GB",
    language: "en",
    currency: "GBP",
    timezone: "Europe/London",
    topLeagues: ["Premier League", "Championship", "Champions League"],
    supportedPartners: ["1xbet", "bet-and-you", "melbet", "betwinner", "megapari"],
  },
  US: {
    country: "US",
    language: "en",
    currency: "USD",
    timezone: "America/New_York",
    topLeagues: ["MLS", "Premier League", "Champions League"],
    supportedPartners: ["1xbet", "bet-and-you", "melbet", "megapari", "888starz"],
  },
  IN: {
    country: "IN",
    language: "en",
    currency: "INR",
    timezone: "Asia/Kolkata",
    topLeagues: ["Premier League", "Champions League", "La Liga"],
    supportedPartners: ["1xbet", "melbet", "bet-and-you", "betwinner", "megapari"],
  },
  CO: {
    country: "CO",
    language: "es",
    currency: "COP",
    timezone: "America/Bogota",
    topLeagues: ["Premier League", "Libertadores", "La Liga"],
    supportedPartners: ["1xbet", "melbet", "bet-and-you", "betwinner", "megapari"],
  },
  ID: {
    country: "ID",
    language: "id",
    currency: "IDR",
    timezone: "Asia/Jakarta",
    topLeagues: ["Premier League", "Champions League", "La Liga"],
    supportedPartners: ["1xbet", "melbet", "bet-and-you", "megapari", "888starz"],
  },
  VN: {
    country: "VN",
    language: "vi",
    currency: "VND",
    timezone: "Asia/Ho_Chi_Minh",
    topLeagues: ["Premier League", "Champions League", "La Liga"],
    supportedPartners: ["1xbet", "melbet", "bet-and-you", "megapari", "888starz"],
  },
};

/** Soft default when geo is unknown — keeps ranking deterministic. */
export const DEFAULT_COUNTRY_CODE: CountryCode = "NG";

export const DEFAULT_COUNTRY_PROFILE: CountryProfile = {
  country: DEFAULT_COUNTRY_CODE,
  language: "en",
  currency: "USD",
  timezone: "UTC",
  topLeagues: ["Premier League", "Champions League", "La Liga"],
  supportedPartners: ["1xbet", "bet-and-you", "melbet", "megapari", "betwinner"],
};

export function getCountryProfile(country: CountryCode | null | undefined): CountryProfile {
  if (!country) return DEFAULT_COUNTRY_PROFILE;
  const code = country.toUpperCase();
  const profile = COUNTRY_PROFILES[code];
  if (profile) return profile;
  return {
    ...DEFAULT_COUNTRY_PROFILE,
    country: code,
  };
}

export function listConfiguredCountries(): CountryCode[] {
  return Object.keys(COUNTRY_PROFILES).sort();
}

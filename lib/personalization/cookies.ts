import type { CountryCode, CountrySource } from "./types";
import { isCountryCode } from "./geo";

export const COUNTRY_COOKIE = "rw_country";
export const COUNTRY_SOURCE_COOKIE = "rw_country_source";
export const COUNTRY_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

const SOURCES: readonly CountrySource[] = ["override", "cookie", "geo", "unknown"];

export function countryFromCookie(value: string | undefined): CountryCode | null {
  if (!value) return null;
  const code = value.trim().toUpperCase();
  return isCountryCode(code) ? code : null;
}

export function countrySourceFromCookie(value: string | undefined): CountrySource | null {
  if (!value) return null;
  const source = value.trim().toLowerCase() as CountrySource;
  return SOURCES.includes(source) ? source : null;
}

export function countryCookieOptions(maxAge = COUNTRY_COOKIE_MAX_AGE) {
  return {
    path: "/",
    maxAge,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

import { DEFAULT_COUNTRY_CODE, getCountryProfile } from "./countries";
import { normalizeCountryCode } from "./geo";
import type { CountryContext, CountryResolution, CountrySource } from "./types";

export type ResolveCountryInput = {
  /** Manual override (?country=BR). Highest priority. */
  override?: string | null;
  /** Persisted preference cookie. */
  cookie?: string | null;
  /** GeoIP / edge headers. */
  geo?: string | null;
  /** Soft default when nothing resolves. */
  fallback?: string;
};

/**
 * Priority: override → cookie → geo → fallback.
 * SSR-safe pure function (no DOM / cookies APIs).
 */
export function resolveCountry(input: ResolveCountryInput): CountryResolution {
  const override = normalizeCountryCode(input.override);
  if (override) return { country: override, source: "override" };

  const cookie = normalizeCountryCode(input.cookie);
  if (cookie) return { country: cookie, source: "cookie" };

  const geo = normalizeCountryCode(input.geo);
  if (geo) return { country: geo, source: "geo" };

  const fallback = normalizeCountryCode(input.fallback ?? DEFAULT_COUNTRY_CODE) ?? DEFAULT_COUNTRY_CODE;
  return { country: fallback, source: "unknown" };
}

export function buildCountryContext(resolution: CountryResolution): CountryContext {
  const profile = getCountryProfile(resolution.country);
  return {
    ...profile,
    country: resolution.country.toUpperCase(),
    source: resolution.source,
  };
}

export function resolveCountryContext(input: ResolveCountryInput): CountryContext {
  return buildCountryContext(resolveCountry(input));
}

export function isCountrySource(value: string | null | undefined): value is CountrySource {
  return value === "override" || value === "cookie" || value === "geo" || value === "unknown";
}

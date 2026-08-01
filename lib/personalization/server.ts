import { cookies, headers } from "next/headers";
import { COUNTRY_COOKIE, countryFromCookie } from "./cookies";
import { detectCountryFromHeaders, parseCountryParam } from "./geo";
import { resolveCountryContext } from "./countryResolver";
import { HEADER_COUNTRY, type CountryContext } from "./types";

/** Read country context for SSR pages (override query > cookie > geo). */
export function getRequestCountryContext(overrideParam?: string | null): CountryContext {
  const hdr = headers();
  const jar = cookies();
  return resolveCountryContext({
    override: parseCountryParam(overrideParam),
    cookie: countryFromCookie(jar.get(COUNTRY_COOKIE)?.value),
    geo: detectCountryFromHeaders(hdr) ?? parseCountryParam(hdr.get(HEADER_COUNTRY)),
  });
}

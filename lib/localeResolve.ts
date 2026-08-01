import { defaultLocale, isLocale, type Locale } from "./i18n";
import { localeForCountry, COUNTRY_LOCALE } from "./countries";
import { parseAcceptLanguage, firstLocaleMatch } from "./localeResolveShared";

export { parseAcceptLanguage } from "./localeResolveShared";

/** Countries where Accept-Language should override default IP mapping. */
const MULTILINGUAL_COUNTRIES = new Set(["CA", "BE", "CH", "IN", "BD", "LK"]);

function prefers(al: string[], codes: string[]): boolean {
  for (const c of codes) {
    if (al.includes(c)) return true;
  }
  return false;
}

/**
 * IP country + browser language → site locale.
 * Single-locale countries (e.g. NL → nl) win over Accept-Language (often en).
 * User override: use `rw_locale` cookie in middleware before calling this.
 */
export function resolveLocale(
  country: string | null | undefined,
  acceptLanguage: string | null
): Locale {
  const cc = (country || "").toUpperCase();
  const al = parseAcceptLanguage(acceptLanguage);

  if (cc === "IN") {
    const india: Locale[] = ["hi", "bn", "ta", "te", "mr", "en"];
    const hit = firstLocaleMatch(al, india);
    return hit ?? "en";
  }

  if (cc === "CA") {
    if (prefers(al, ["fr"])) return "fr";
    return "en";
  }

  if (cc === "BE") {
    if (prefers(al, ["fr"])) return "fr";
    if (prefers(al, ["nl", "de"])) return "nl";
    return "nl";
  }

  if (cc === "CH") {
    if (prefers(al, ["fr"])) return "fr";
    if (prefers(al, ["it"])) return "it";
    return "de";
  }

  if (cc === "ES") return "es-es";

  if (cc === "BD") return prefers(al, ["bn"]) ? "bn" : "bn";

  if (cc === "LK") return prefers(al, ["ta"]) ? "ta" : "en";

  if (cc && !MULTILINGUAL_COUNTRIES.has(cc) && COUNTRY_LOCALE[cc]) {
    return localeForCountry(country);
  }

  const fromAl = firstLocaleMatch(al, [
    "hi",
    "bn",
    "ta",
    "te",
    "mr",
    "ja",
    "th",
    "ko",
    "vi",
    "id",
    "zh",
    "ar",
    "sv",
    "no",
    "fi",
    "ro",
    "el",
    "hu",
    "es-es",
    "es",
    "pt",
    "de",
    "fr",
    "it",
    "nl",
    "pl",
    "cs",
    "da",
    "sw",
    "en",
  ]);
  if (fromAl) return fromAl;

  return localeForCountry(country) ?? defaultLocale;
}

export function normalizeLocaleParam(value: string): Locale {
  if (isLocale(value)) return value;
  return defaultLocale;
}

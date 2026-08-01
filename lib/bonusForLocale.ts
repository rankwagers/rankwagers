import { bonusForCountry, type Brand } from "./brands";
import type { Locale } from "./i18n";

/** URL locale → ISO country for localized bonus copy (not VPN IP). */
const LOCALE_COUNTRY: Partial<Record<Locale, string>> = {
  nl: "NL",
  de: "DE",
  fr: "FR",
  it: "IT",
  es: "ES",
  "es-es": "ES",
  pt: "PT",
  pl: "PL",
  cs: "CZ",
  da: "DK",
  sv: "SE",
  no: "NO",
  fi: "FI",
  ro: "RO",
  el: "GR",
  hu: "HU",
  ar: "SA",
  hi: "IN",
  bn: "BD",
  ja: "JP",
  th: "TH",
  ko: "KR",
  vi: "VN",
  id: "ID",
  zh: "CN",
  sw: "KE",
};

/** Bonus text follows page language, not VPN IP. */
export function bonusForLocale(brand: Brand, locale: Locale): string {
  const cc = LOCALE_COUNTRY[locale];
  if (cc) {
    const localized = bonusForCountry(brand, cc);
    return localized;
  }
  return brand.bonus;
}

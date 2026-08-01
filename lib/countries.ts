import { defaultLocale, type Locale } from "./i18n";

/**
 * Varsayılan ülke → locale (IP tabanlı).
 * Çok dilli ülkeler için `resolveLocale` Accept-Language ile düzeltir.
 */
export const COUNTRY_LOCALE: Record<string, Locale> = {
  // English-primary
  US: "en",
  GB: "en",
  UK: "en",
  CA: "en",
  AU: "en",
  NZ: "en",
  IE: "en",
  IN: "en",
  NG: "en",
  ZA: "en",
  GH: "en",
  UG: "en",
  KE: "sw",
  TZ: "sw",
  ZW: "en",
  PG: "en",
  JM: "en",
  TT: "en",
  BB: "en",
  BS: "en",
  GY: "en",
  SG: "en",
  MY: "en",
  PH: "en",
  PK: "en",
  LK: "en",
  MT: "en",
  CY: "el",

  // Portuguese
  BR: "pt",
  PT: "pt",

  // Spanish LATAM
  MX: "es",
  CO: "es",
  PE: "es",
  AR: "es",
  CL: "es",
  VE: "es",
  EC: "es",
  BO: "es",
  PY: "es",
  UY: "es",
  CR: "es",
  PA: "es",
  DO: "es",
  GT: "es",
  HN: "es",
  NI: "es",
  SV: "es",
  PR: "es",
  CU: "es",

  // Spain
  ES: "es-es",

  // French
  FR: "fr",
  BE: "fr",
  LU: "fr",
  MC: "fr",
  CI: "fr",
  CM: "fr",
  CD: "fr",
  SN: "fr",
  MU: "fr",
  GN: "fr",
  BF: "fr",
  ML: "fr",
  NE: "fr",
  TG: "fr",
  BJ: "fr",
  RW: "fr",
  BI: "fr",
  DJ: "fr",
  GA: "fr",
  CG: "fr",
  CF: "fr",
  TD: "fr",
  GQ: "fr",
  KM: "fr",
  MG: "fr",
  SC: "fr",
  HT: "fr",

  // German
  DE: "de",
  AT: "de",
  CH: "de",

  // Italian
  IT: "it",
  SM: "it",

  // Dutch
  NL: "nl",

  // Nordics
  SE: "sv",
  NO: "no",
  FI: "fi",
  DK: "da",
  IS: "en",

  // Central / Eastern Europe
  PL: "pl",
  CZ: "cs",
  SK: "cs",
  HU: "hu",
  RO: "ro",
  GR: "el",
  BG: "en",
  HR: "en",
  RS: "en",
  SI: "en",
  BA: "en",
  MK: "en",
  AL: "en",

  // MENA Arabic
  EG: "ar",
  SA: "ar",
  AE: "ar",
  QA: "ar",
  BH: "ar",
  KW: "ar",
  OM: "ar",
  JO: "ar",
  LB: "ar",
  IQ: "ar",
  MA: "ar",
  TN: "ar",
  DZ: "ar",
  LY: "ar",
  YE: "ar",
  PS: "ar",
  SD: "ar",

  // South / East Asia
  JP: "ja",
  TH: "th",
  KR: "ko",
  VN: "vi",
  ID: "id",
  CN: "zh",
  HK: "zh",
  MO: "zh",
  TW: "zh",
  BD: "bn",
  NP: "en",

  // Swahili
  // TZ, KE already — KE uses en default in map but sw in al
};

export const BLOCKED_COUNTRIES = new Set<string>(["TR"]);

export function isAllowedCountry(country: string | null | undefined): boolean {
  if (!country) return true;
  return !BLOCKED_COUNTRIES.has(country.toUpperCase());
}

export function localeForCountry(country: string | null | undefined): Locale {
  if (!country) return defaultLocale;
  const cc = country.toUpperCase();
  return COUNTRY_LOCALE[cc] ?? defaultLocale;
}

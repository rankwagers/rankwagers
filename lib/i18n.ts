export const locales = [
  "en",
  "pt",
  "es",
  "es-es",
  "fr",
  "de",
  "it",
  "nl",
  "pl",
  "cs",
  "da",
  "sv",
  "no",
  "fi",
  "ro",
  "el",
  "hu",
  "ar",
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
  "sw",
] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

export const rtlLocales: Locale[] = ["ar"];

export const localeNames: Record<Locale, string> = {
  en: "English",
  pt: "Português (BR)",
  es: "Español (LATAM)",
  "es-es": "Español (España)",
  fr: "Français",
  de: "Deutsch",
  it: "Italiano",
  nl: "Nederlands",
  pl: "Polski",
  cs: "Čeština",
  da: "Dansk",
  sv: "Svenska",
  no: "Norsk",
  fi: "Suomi",
  ro: "Română",
  el: "Ελληνικά",
  hu: "Magyar",
  ar: "العربية",
  hi: "हिन्दी",
  bn: "বাংলা",
  ta: "தமிழ்",
  te: "తెలుగు",
  mr: "मराठी",
  ja: "日本語",
  th: "ไทย",
  ko: "한국어",
  vi: "Tiếng Việt",
  id: "Bahasa Indonesia",
  zh: "中文 (简体)",
  sw: "Kiswahili",
};

/** FootyStats gpt_int anahtarları + özel eşlemeler */
export const footyStatsGptKey: Record<Locale, string> = {
  en: "en",
  pt: "pt",
  es: "es",
  "es-es": "es",
  fr: "fr",
  de: "de",
  it: "it",
  nl: "nl",
  pl: "pl",
  cs: "cz",
  da: "dk",
  sv: "se",
  no: "no",
  fi: "se",
  ro: "ro",
  el: "gr",
  hu: "hu",
  ar: "ara",
  hi: "en",
  bn: "en",
  ta: "en",
  te: "en",
  mr: "en",
  ja: "jp",
  th: "en",
  ko: "kr",
  vi: "en",
  id: "id",
  zh: "cn",
  sw: "en",
};

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

export function dirForLocale(locale: Locale): "ltr" | "rtl" {
  return rtlLocales.includes(locale) ? "rtl" : "ltr";
}

/** ISO 3166-1 alpha-2 (flagcdn.com) — FootyStats ülke / URL slug eşlemesi */
const NAME_TO_ISO: Record<string, string> = {
  usa: "us",
  us: "us",
  "united states": "us",
  "united states of america": "us",
  america: "us",
  england: "gb",
  scotland: "gb",
  wales: "gb",
  uk: "gb",
  "united kingdom": "gb",
  germany: "de",
  spain: "es",
  italy: "it",
  france: "fr",
  netherlands: "nl",
  portugal: "pt",
  turkey: "tr",
  türkiye: "tr",
  greece: "gr",
  austria: "at",
  belgium: "be",
  switzerland: "ch",
  russia: "ru",
  ukraine: "ua",
  poland: "pl",
  "czech republic": "cz",
  czechia: "cz",
  croatia: "hr",
  serbia: "rs",
  denmark: "dk",
  sweden: "se",
  norway: "no",
  finland: "fi",
  romania: "ro",
  hungary: "hu",
  bulgaria: "bg",
  cyprus: "cy",
  israel: "il",
  "saudi arabia": "sa",
  uae: "ae",
  "united arab emirates": "ae",
  qatar: "qa",
  japan: "jp",
  "south korea": "kr",
  korea: "kr",
  china: "cn",
  australia: "au",
  mexico: "mx",
  brazil: "br",
  argentina: "ar",
  colombia: "co",
  chile: "cl",
  peru: "pe",
  ecuador: "ec",
  uruguay: "uy",
  "costa rica": "cr",
  egypt: "eg",
  morocco: "ma",
  tunisia: "tn",
  "south africa": "za",
  nigeria: "ng",
  india: "in",
  indonesia: "id",
  malaysia: "my",
  thailand: "th",
  ireland: "ie",
  irish: "ie",
  eire: "ie",
  "republic of ireland": "ie",
  europe: "eu",
  canada: "ca",
  slovakia: "sk",
  slovenia: "si",
  bosnia: "ba",
  "bosnia and herzegovina": "ba",
  montenegro: "me",
  albania: "al",
  georgia: "ge",
  armenia: "am",
  azerbaijan: "az",
  kazakhstan: "kz",
  iran: "ir",
  iraq: "iq",
  jordan: "jo",
  kuwait: "kw",
  bahrain: "bh",
  paraguay: "py",
  bolivia: "bo",
  venezuela: "ve",
  panama: "pa",
  honduras: "hn",
  guatemala: "gt",
  "el salvador": "sv",
  jamaica: "jm",
  kenya: "ke",
  ghana: "gh",
  senegal: "sn",
  cameroon: "cm",
  "ivory coast": "ci",
  vietnam: "vn",
  singapore: "sg",
  philippines: "ph",
  taiwan: "tw",
  iceland: "is",
  luxembourg: "lu",
  malta: "mt",
  estonia: "ee",
  latvia: "lv",
  lithuania: "lt",
  oman: "om",
  belarus: "by",
  "republic of belarus": "by",
};

const SLUG_TO_ISO: Record<string, string> = {
  usa: "us",
  ireland: "ie",
  "republic-of-ireland": "ie",
  irish: "ie",
  england: "gb",
  scotland: "gb",
  wales: "gb",
  spain: "es",
  germany: "de",
  italy: "it",
  france: "fr",
  turkey: "tr",
  brazil: "br",
  mexico: "mx",
  belarus: "by",
};

function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function countryToIso2(
  country: string,
  matchUrl?: string,
  leagueName?: string
): string | undefined {
  if (country) {
    const key = normalizeKey(country);
    if (NAME_TO_ISO[key]) return NAME_TO_ISO[key];
    if (key.includes("ireland") && !key.includes("northern")) return "ie";
    if (key.length === 2 && /^[a-z]{2}$/.test(key)) return key;
  }
  if (matchUrl?.startsWith("/")) {
    const slug = matchUrl.split("/").filter(Boolean)[0] || "";
    if (SLUG_TO_ISO[slug]) return SLUG_TO_ISO[slug];
    const sk = normalizeKey(slug.replace(/-/g, " "));
    if (NAME_TO_ISO[sk]) return NAME_TO_ISO[sk];
    if (sk.includes("ireland") && !sk.includes("northern")) return "ie";
  }
  if (leagueName) {
    const url = (matchUrl ?? "").toLowerCase();
    const irishUrl =
      url.includes("/ireland") ||
      url.includes("republic-of-ireland") ||
      url.includes("/irish");
    const irishLeague =
      /airtricity|league of ireland|fai|sse airticity|premier division|first division/i.test(
        leagueName
      );
    if (irishUrl && irishLeague && !url.includes("northern-ireland")) {
      return "ie";
    }
  }
  return undefined;
}

export function flagImageUrl(iso2: string | undefined, width = 20): string | undefined {
  if (!iso2) return undefined;
  return `https://flagcdn.com/w${width}/${iso2.toLowerCase()}.png`;
}

/*
 * THE EMOJI TABLE IS RETIRED. `COUNTRY_FLAGS`, `flagEmojiForCountry` and `flagForCountry`
 * minted regional-indicator emoji that Windows renders as bare letter pairs; the product's flag
 * is the vendored SVG (`public/flags/4x3/{iso}.svg`, `CountryFlagIcon` / `V2LeagueCell`), keyed
 * by `countryToIso2` above. Nothing consumed the emoji any more except the dead `MatchRow.flag`
 * field, retired with it.
 */

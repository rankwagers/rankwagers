/** Full-query football abbreviation expansions (normalized keys → expanded form). */
const QUERY_ABBREVIATIONS: Record<string, string> = {
  "man utd": "manchester united",
  "man united": "manchester united",
  "man city": "manchester city",
  psg: "paris saint germain",
  atm: "atletico madrid",
  rma: "real madrid",
  barca: "barcelona",
  fcb: "barcelona",
  spurs: "tottenham",
  wolves: "wolverhampton",
  "nottm forest": "nottingham forest",
};

/** Safe single-token expansions (avoid common English words). */
const TOKEN_ABBREVIATIONS: Record<string, string> = {
  psg: "paris saint germain",
  atm: "atletico madrid",
  rma: "real madrid",
  fcb: "barcelona",
};

const CLUB_TOKEN_RE = /\b(fc|afc|cf|sc|fk|sk|ac|as|ssc|rcd|cd|ud|sd)\b/g;

/**
 * Normalize a search query or entity string for identity matching.
 * Lowercase, trim, Unicode NFKD + accent strip, hyphen/whitespace collapse,
 * club suffix removal, and common football abbreviation expansion.
 */
export function normalizeSearchQuery(value: string): string {
  let s = value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");

  s = s.replace(/['’`]/g, "");
  s = s.replace(/[-_/.,]+/g, " ");
  s = s.replace(CLUB_TOKEN_RE, " ");
  s = s.replace(/\s+/g, " ").trim();

  if (!s) return "";

  const expanded = QUERY_ABBREVIATIONS[s];
  if (expanded) return expanded;

  const tokens = s.split(" ").flatMap((token) => {
    const hit = TOKEN_ABBREVIATIONS[token];
    return hit ? hit.split(" ") : [token];
  });
  return tokens.join(" ").replace(/\s+/g, " ").trim();
}

/** Collapse a slug-like string for exact slug comparison. */
export function normalizeSlugKey(slug: string): string {
  return normalizeSearchQuery(slug.replace(/-/g, " ")).replace(/\s+/g, "-");
}

export const FOOTYSTATS_BASE_URL = "https://api.football-data-api.com";

/** Team badge paths from API → CDN */
export const FOOTYSTATS_IMAGE_CDN = "https://cdn.footystats.org";

export const OVER_15_THRESHOLD = 90;
export const FH_OVER_05_THRESHOLD = 85;
export const OVER_25_THRESHOLD = 70;
export const SH_OVER_05_THRESHOLD = 90;

/**
 * Competition-name keywords that mark a fixture as cup football.
 *
 * Matched on WORD BOUNDARIES by `isCup`, never as substrings. The distinction is not academic: as
 * a substring, `FA` matched every name containing those two letters anywhere — `Faroe Islands
 * Premier League`, `Fase de Ascenso`, `Belfast Premiership`, `Halifax League` — so a rule published
 * under the identifier `exclude_cup_competitions` was removing league football, making both the
 * `inScope` count and its stated reason wrong (§3.2, §3.14).
 *
 * A multi-word entry matches as a contiguous run of words, so `Play-offs` still requires both.
 *
 * `League Cup` and `Super Cup` were removed as strictly redundant: any name containing either
 * phrase also contains the word `Cup`, which is already listed. They excluded nothing on their own,
 * and a keyword that can never fire is a rule nobody can check.
 */
export const EXCLUDED_COMPETITIONS = [
  "Cup",
  "Pokal",
  "Copa",
  "FA",
  "DFB",
  "Coppa",
  "Coupe",
  "Trophy",
  "Shield",
  "Play-offs",
];

export function getFootyStatsApiKey(): string {
  const key = process.env.FOOTYSTATS_API_KEY;
  if (!key) {
    throw new Error("FOOTYSTATS_API_KEY is not set");
  }
  return key;
}

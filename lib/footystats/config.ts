export const FOOTYSTATS_BASE_URL = "https://api.football-data-api.com";

/** Team badge paths from API → CDN */
export const FOOTYSTATS_IMAGE_CDN = "https://cdn.footystats.org";

export const OVER_15_THRESHOLD = 90;
export const FH_OVER_05_THRESHOLD = 85;
export const OVER_25_THRESHOLD = 70;
export const SH_OVER_05_THRESHOLD = 90;

export const EXCLUDED_COMPETITIONS = [
  "Cup",
  "Pokal",
  "Copa",
  "FA",
  "League Cup",
  "DFB",
  "Coppa",
  "Coupe",
  "Trophy",
  "Shield",
  "Super Cup",
  "Play-offs",
];

export function getFootyStatsApiKey(): string {
  const key = process.env.FOOTYSTATS_API_KEY;
  if (!key) {
    throw new Error("FOOTYSTATS_API_KEY is not set");
  }
  return key;
}

/* ============================================================================
   COMPETITION IDENTITY
   ----------------------------------------------------------------------------
   Every competition carries its own colour, taken from the competition's own
   identity rather than invented. It is used at very low alpha — a rail, a
   wash, a watermark, an atmosphere — so that a reader feels which football
   they are looking at before they read the name of it. It never carries
   meaning on its own, and it never replaces the brand accent on a figure that
   must be read.

   One rule holds everywhere: competition identity outranks club identity.
   Clubs are allowed a crest and, at most, a small mark. The atmosphere always
   belongs to the competition.
   ========================================================================== */

const TINT: Record<number, string> = {
  2: "10 20 74", // Champions League — midnight blue
  3: "232 108 20", // Europa League — orange
  39: "55 0 60", // Premier League — deep purple
  40: "0 60 120", // Championship
  61: "9 26 61", // Ligue 1 — dark navy
  71: "0 108 62", // Brasileirão
  78: "182 20 40", // Bundesliga — crimson
  88: "18 36 82", // Eredivisie — deep navy
  94: "0 110 78", // Primeira Liga — emerald
  113: "0 82 155", // Allsvenskan
  135: "0 62 140", // Serie A — blue
  140: "182 27 43", // La Liga — warm red
  203: "196 30 58", // Süper Lig
  253: "38 48 66", // MLS — charcoal blue
};

/** The raw `r g b` triplet for a competition, falling back to the brand accent. */
export function tint(leagueId: number) {
  return TINT[leagueId] ?? "42 85 224";
}

/** The competition's colour at a given alpha. */
export function tinted(leagueId: number, alpha: number) {
  return `rgb(${tint(leagueId)} / ${alpha})`;
}

/**
 * The one gradient the whole page uses for competition atmosphere: left to
 * right, strongest at the margin, gone before the text column ends. Alpha is
 * the only permitted variation, so no two sections invent their own wash.
 */
export function wash(leagueId: number, alpha: number, stop = "58%") {
  return `linear-gradient(to right, ${tinted(leagueId, alpha)}, transparent ${stop})`;
}

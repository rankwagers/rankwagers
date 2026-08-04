/* ============================================================================
   COMPETITION IDENTITY — hero scope
   ----------------------------------------------------------------------------
   Every competition carries its own colour, taken from the competition's own
   identity rather than invented. It is used at very low alpha — a rail, a
   wash, an atmosphere — so that a reader feels which football they are looking
   at before they read the name of it. It never carries meaning on its own, and
   it never replaces the accent on a figure that must be read.

   The approved design keys this table on api-sports league IDs. This product's
   provider is FootyStats and competition arrives as a display string, so the
   table is keyed on the normalized name instead (see `leagueKeyFor`). The
   colour values are unchanged from the approved design.

   An unlisted competition falls back to the hero accent, exactly as the
   approved design does — so a new league is quiet, never wrong.

   THE ONE OUTPUT CONVENTION — BARE `r g b` TRIPLETS. `tint()` returns `"55 0 60"`, never a CSS
   color. Every consumer composes it: inline `--rw-tint` setters pass the triplet through and the
   ONE CSS site that reads the variable wraps it — `rgb(var(--rw-tint, var(--hero-ink-rgb)))`.
   This is stated because it shipped broken the other way: the rail CSS consumed the triplet raw,
   `background: 42 85 224;` is invalid and silently dropped, and the hover drew an unpainted box.
   A consumer that needs alpha uses `tinted(key, alpha)`, which does the wrapping itself.

   KNOWN DEBT, deliberately not paid here: the leagues on today's boards (Kakkonen, Kolmonen
   Länsi, LFPB, Pro League A…) are not in TINT, so every one of them falls to ACCENT and every
   rail currently draws the same blue. The table needs to learn the minor leagues before the tint
   carries identity rather than merely presence.
   ========================================================================== */

/** `r g b` triplets, matching the approved design's competition palette. */
const TINT: Record<string, string> = {
  "champions league": "10 20 74",
  "uefa champions league": "10 20 74",
  "europa league": "232 108 20",
  "uefa europa league": "232 108 20",
  "premier league": "55 0 60",
  championship: "0 60 120",
  "ligue 1": "9 26 61",
  "serie a": "0 62 140",
  "la liga": "182 27 43",
  laliga: "182 27 43",
  bundesliga: "182 20 40",
  eredivisie: "18 36 82",
  "primeira liga": "0 110 78",
  allsvenskan: "0 82 155",
  "super lig": "196 30 58",
  "super lig turkey": "196 30 58",
  "major league soccer": "38 48 66",
  mls: "38 48 66",
  brasileirao: "0 108 62",
  "serie a brazil": "0 108 62",
};

/** The hero accent, as a raw triplet. Fallback for any unlisted competition. */
const ACCENT = "42 85 224";

/** The raw `r g b` triplet for a competition key. */
export function tint(leagueKey: string): string {
  return TINT[leagueKey] ?? ACCENT;
}

/** The competition's colour at a given alpha. */
export function tinted(leagueKey: string, alpha: number): string {
  return `rgb(${tint(leagueKey)} / ${alpha})`;
}

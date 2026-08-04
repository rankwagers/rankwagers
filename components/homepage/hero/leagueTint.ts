/* ============================================================================
   COMPETITION IDENTITY — hero scope
   ----------------------------------------------------------------------------
   THE PRIMARY SOURCE IS THE COUNTRY'S OWN FLAG. Each rail draws a vertical
   gradient of the flag's two most dominant readable colours, derived at BUILD
   TIME from the same SVG the league cell renders (`lib/generated/flagTints.ts`
   — measured pixel area, luminance-capped, deterministic; see the generator).
   The same row field that keys the flag keys the rail, so the two can never
   disagree about which country a row belongs to.

   TINT below is now ONLY an explicit per-league override for the handful of
   branded competitions already listed — a league whose identity is its own
   colour rather than its country's. New entries are a decision, not upkeep.

   THE ACCENT FALLBACK IS DEAD. Unlisted-and-uncountried rows fall to INK at
   the CSS site (`var(--rw-tint-*, var(--hero-ink-rgb))`), never to the
   retired v1 blue — the debt the previous header logged is paid: a rail that
   cannot state an identity states presence in the page's own ink.

   THE ONE OUTPUT CONVENTION — BARE `r g b` TRIPLETS. Everything here emits
   `"55 0 60"`, never a CSS color; the ONE CSS site that reads the variables
   composes them inside `rgb()`/`linear-gradient()`. It shipped broken the
   other way once: `background: 42 85 224;` is invalid, silently dropped, and
   the hover drew an unpainted box. Alpha goes through `tinted()`.
   ========================================================================== */

import { FLAG_TINTS } from "@/lib/generated/flagTints";
import { countryDisplay } from "@/lib/countryDisplay";
import type { CSSProperties } from "react";

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

/** The page's ink, as a raw triplet. The only fallback — the retired accent blue is gone. */
const INK = "32 30 29";

/** The raw `r g b` triplet for a competition key. */
export function tint(leagueKey: string): string {
  return TINT[leagueKey] ?? INK;
}

/** The competition's colour at a given alpha. */
export function tinted(leagueKey: string, alpha: number): string {
  return `rgb(${tint(leagueKey)} / ${alpha})`;
}

/**
 * The rail's gradient pair for a row, by the stated resolution order:
 *
 *   1. branded-league override — TINT, solid (both stops the league's colour);
 *   2. the row's country — the flag-derived pair, from the SAME field the flag renders from;
 *   3. neither — `null`: the row sets no variables and the CSS falls to ink.
 */
export function railTints(
  leagueKey: string,
  country: string | undefined
): readonly [string, string] | null {
  const override = TINT[leagueKey];
  if (override) return [override, override];
  const iso = countryDisplay(country)?.iso;
  const pair = iso ? FLAG_TINTS[iso] : undefined;
  return pair ?? null;
}

/**
 * The style a row spreads to feed the rail — `undefined` when there is nothing to state, so the
 * CSS fallback (ink) applies through genuinely UNSET variables rather than through a sentinel.
 */
export function railTintStyle(
  leagueKey: string,
  country: string | undefined
): CSSProperties | undefined {
  const pair = railTints(leagueKey, country);
  if (!pair) return undefined;
  return { "--rw-tint-a": pair[0], "--rw-tint-b": pair[1] } as CSSProperties;
}

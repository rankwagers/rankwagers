/*
 * `flagEmoji` is RETIRED. Regional-indicator emoji render as bare letter pairs on Windows; every
 * flag on the product is the vendored SVG via `CountryFlagIcon` (public/flags/4x3). This module
 * keeps only the name resolver.
 */

let regionDisplay: Intl.DisplayNames | null = null;
try {
  regionDisplay = new Intl.DisplayNames(["en"], { type: "region" });
} catch {
  regionDisplay = null;
}

// Ülke kodundan tam ad (Intl.DisplayNames ile, yoksa kodun kendisi).
export function countryName(cc: string): string {
  const code = (cc || "").toUpperCase();
  if (!code || code === "??") return "Unknown";
  try {
    return regionDisplay?.of(code) || code;
  } catch {
    return code;
  }
}

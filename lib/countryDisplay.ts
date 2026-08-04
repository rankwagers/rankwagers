/* ============================================================================
   COUNTRY DISPLAY — name and flag, from what the row actually carries
   ----------------------------------------------------------------------------
   Provider rows carry a lowercase ISO code (`fi`); the live engine carries a
   full name (`Bolivia`). The league cell needs a real flag and a full name
   from either — and must render NEITHER when the row genuinely holds no
   country. A white placeholder flag stands in for an observation nobody made,
   which is the same lie as a dash in a rate column.

   Both outputs come from standard registries rather than a hand-kept table:
   the flag is the ISO code mapped to Unicode regional-indicator symbols
   (pure arithmetic — every valid two-letter code has exactly one flag), and
   the name comes from `Intl.DisplayNames`, the platform's own region list.
   English on purpose: every date on this site is `en-GB` fixed for the same
   server/client-agreement reason, and the locale files owe translations for
   copy, not for ISO 3166 display names.
   ========================================================================== */

export type CountryDisplay = {
  name: string;
  /** `null` when the name is known but no flag can be derived — print the name alone. */
  flag: string | null;
};

const REGIONAL_INDICATOR_OFFSET = 0x1f1e6 - 0x41; // 'A' → 🇦

function flagFromIso(code: string): string {
  return String.fromCodePoint(
    ...code
      .toUpperCase()
      .split("")
      .map((ch) => ch.charCodeAt(0) + REGIONAL_INDICATOR_OFFSET)
  );
}

/**
 * Resolve a country field — ISO code or full name — to its display form.
 *
 * Returns `null` for an empty field OR an ISO code the platform does not recognise: an
 * unrecognised code is a country this module cannot name, and printing the raw code ("FI")
 * beside a placeholder glyph is exactly the rendering this exists to end. The caller omits
 * the country line entirely and prints the league alone.
 */
export function countryDisplay(raw: string | undefined | null): CountryDisplay | null {
  const value = raw?.trim();
  if (!value) return null;

  if (/^[a-zA-Z]{2}$/.test(value)) {
    const code = value.toUpperCase();
    /*
     * ISO 3166's own reserved ranges — AA, QM–QZ, XA–XZ, ZZ — are user-assigned or "unknown
     * region" codes. The platform still NAMES some of them (`ZZ` → "Unknown Region"), which is a
     * name for the absence of a country; rendering it would be the placeholder this resolver
     * exists to end. The exclusion list is the standard's, not a hand-kept table.
     */
    if (/^(AA|Q[M-Z]|X[A-Z]|ZZ)$/.test(code)) return null;
    try {
      const name = new Intl.DisplayNames(["en"], { type: "region" }).of(code);
      // `of` echoes the input back for codes it has no name for — that is "unknown", not a name.
      if (!name || name === code) return null;
      return { name, flag: flagFromIso(code) };
    } catch {
      return null;
    }
  }

  /*
   * A full name. It is printed as given — re-deriving it would let a display table disagree with
   * the source — and the flag is attached only when the name round-trips to a region the platform
   * knows. No match means name without flag, never a placeholder glyph.
   */
  return { name: value, flag: flagFromName(value) };
}

/** Best-effort name→flag, by scanning the platform's own region list once. */
let NAME_TO_ISO: Map<string, string> | null = null;

function flagFromName(name: string): string | null {
  if (!NAME_TO_ISO) {
    NAME_TO_ISO = new Map();
    try {
      const display = new Intl.DisplayNames(["en"], { type: "region" });
      for (let a = 0x41; a <= 0x5a; a += 1) {
        for (let b = 0x41; b <= 0x5a; b += 1) {
          const code = String.fromCharCode(a, b);
          const regionName = display.of(code);
          if (regionName && regionName !== code) {
            NAME_TO_ISO.set(regionName.toLowerCase(), code);
          }
        }
      }
    } catch {
      /* the map stays empty; every lookup misses and the cell prints the name alone */
    }
  }
  const iso = NAME_TO_ISO.get(name.trim().toLowerCase());
  return iso ? flagFromIso(iso) : null;
}

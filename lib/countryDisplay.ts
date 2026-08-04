/* ============================================================================
   COUNTRY DISPLAY — name and ISO code, from what the row actually carries
   ----------------------------------------------------------------------------
   Provider rows carry a lowercase ISO code (`fi`); the live engine carries a
   full name (`Bolivia`). The league cell needs a full name and a flag ASSET
   KEY from either — and must render NEITHER when the row genuinely holds no
   country. A placeholder stands in for an observation nobody made, which is
   the same lie as a dash in a rate column.

   THE FLAG IS AN ISO KEY, NOT AN EMOJI. The first version emitted regional-
   indicator emoji; Windows renders those as bare letter pairs, so half the
   audience saw "FI" where a flag was promised. The resolver now yields the
   lowercase ISO code and the cell maps it to a self-hosted SVG under
   `public/flags/4x3/` (vendored from flag-icons, MIT — see the README there).
   No emoji is generated anywhere in this module, deliberately: the probe for
   this defect asserts the regional-indicator arithmetic is GONE, not unused.

   The name comes from `Intl.DisplayNames`, the platform's own region list.
   English on purpose: every date on this site is `en-GB` fixed for the same
   server/client-agreement reason, and the locale files owe translations for
   copy, not for ISO 3166 display names.
   ========================================================================== */

export type CountryDisplay = {
  name: string;
  /**
   * Lowercase ISO 3166-1 alpha-2 — the flag asset key. `null` when the name is known but no code
   * can be recovered: the cell then prints the name alone, never a placeholder flag.
   */
  iso: string | null;
};

/**
 * Resolve a country field — ISO code or full name — to its display form.
 *
 * Returns `null` for an empty field OR an ISO code the platform does not recognise: an
 * unrecognised code is a country this module cannot name, and printing the raw code ("FI")
 * beside a placeholder is exactly the rendering this exists to end. The caller omits the
 * country line entirely and prints the league alone.
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
      return { name, iso: code.toLowerCase() };
    } catch {
      return null;
    }
  }

  /*
   * A full name. It is printed as given — re-deriving it would let a display table disagree with
   * the source — and the ISO key is attached only when the name round-trips to a region the
   * platform knows. No match means name without flag, never a placeholder.
   */
  return { name: value, iso: isoFromName(value) };
}

/** Best-effort name→ISO, by scanning the platform's own region list once. */
let NAME_TO_ISO: Map<string, string> | null = null;

function isoFromName(name: string): string | null {
  if (!NAME_TO_ISO) {
    NAME_TO_ISO = new Map();
    try {
      const display = new Intl.DisplayNames(["en"], { type: "region" });
      for (let a = 0x41; a <= 0x5a; a += 1) {
        for (let b = 0x41; b <= 0x5a; b += 1) {
          const code = String.fromCharCode(a, b);
          const regionName = display.of(code);
          if (regionName && regionName !== code) {
            NAME_TO_ISO.set(regionName.toLowerCase(), code.toLowerCase());
          }
        }
      }
    } catch {
      /* the map stays empty; every lookup misses and the cell prints the name alone */
    }
  }
  return NAME_TO_ISO.get(name.trim().toLowerCase()) ?? null;
}

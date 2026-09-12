import assert from "node:assert/strict";
import test from "node:test";

import { locales } from "../lib/i18n";
import { predictionsEn } from "../lib/translations/predictionsEn";
import { predictionsByLocale } from "../lib/translations/predictionsLocales";

/**
 * THE V3 FAMILY BIRTH GATE (dictionary: EN + all 29 locale sets in the same
 * commit — the marketsConversion shape).
 *
 * The v3 reskin's shell, homepage, empty states and editor band speak only
 * through this family. Key count is derived, not hardcoded, and pinned so a
 * key cannot be born without every locale carrying it. es-es inherits es by
 * spread (registered inheritance, same as its whole set); te/mr were
 * authored genuinely — their sets land after the hi spread so their own
 * keys win.
 */

const V3_KEYS = Object.keys(predictionsEn).filter((k) => /^v3[A-Z]/.test(k));

test("the v3 family is exactly 76 keys", () => {
  // 55 born with the shell (block B) + 4 with block D + 6 with block H +
  // 11 with polish 1 (small-sample, Strongest signals, and the nine
  // market short labels of group 8).
  assert.equal(V3_KEYS.length, 76, "the family changed size — re-derive this pin deliberately");
});

test("all 30 locales resolve every v3 key non-empty", () => {
  assert.equal(locales.length, 30);
  for (const locale of locales) {
    const dict = predictionsByLocale[locale] as Record<string, string>;
    for (const key of V3_KEYS) {
      const value = dict[key];
      assert.ok(
        typeof value === "string" && value.trim().length > 0,
        `${locale}.${key} is empty or missing`
      );
    }
  }
});

/* Placeholders must survive translation — a locale that drops {n} renders a
 * broken sentence in production, silently. */
const PLACEHOLDERS: Record<string, string[]> = {
  v3Season: ["{season}"],
  v3NPredictions: ["{n}"],
  v3NMoreMatches: ["{n}"],
  v3OddsAsOf: ["{time}"],
  v3EmptyMatchesTomorrow: ["{n}", "{time}"],
  v3EmptySnapshotLine: ["{time}"],
  v3NActiveOffers: ["{n}"],
  v3NMatches: ["{n}"],
  v3H2hLast: ["{n}"],
};

test("every locale preserves the family's placeholders", () => {
  for (const locale of locales) {
    const dict = predictionsByLocale[locale] as Record<string, string>;
    for (const [key, tokens] of Object.entries(PLACEHOLDERS)) {
      for (const token of tokens) {
        assert.ok(
          dict[key].includes(token),
          `${locale}.${key} lost placeholder ${token}: "${dict[key]}"`
        );
      }
    }
  }
});

test("genuine translation, not silent EN fallback, in every non-EN set", () => {
  // Substantive keys that cannot plausibly coincide with English.
  const probes = ["v3LockLine", "v3EmptyOffersLine", "v3CommissionLine"] as const;
  for (const locale of locales) {
    if (locale === "en") continue;
    const dict = predictionsByLocale[locale] as Record<string, string>;
    for (const key of probes) {
      assert.notEqual(
        dict[key],
        (predictionsEn as Record<string, string>)[key],
        `${locale}.${key} is the English string — the locale was not authored`
      );
    }
  }
});

test("no gambling instruction or certainty claim enters through the v3 strings", () => {
  const banned = [/\bbet now\b/i, /guaranteed/i, /sure win/i, /can't lose/i];
  for (const locale of locales) {
    const dict = predictionsByLocale[locale] as Record<string, string>;
    for (const key of V3_KEYS) {
      for (const pattern of banned) {
        assert.ok(
          !pattern.test(dict[key]),
          `${locale}.${key} matches banned pattern ${pattern}`
        );
      }
    }
  }
});

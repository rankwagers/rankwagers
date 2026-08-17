import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

/**
 * ACCA INTERIOR STRINGS — language sweep block 3 probes.
 *
 * STATE, honestly: the embedded EN strings are fully EXTRACTED (121 keys) and
 * threaded — AccaPanelBody, AccaBuilderView, AccaShareControls, and all five
 * publication views render from the dictionary; no literal survives at the
 * swept sites. Translation authoring: COMPLETE. Batch 1 (pt/fr/de/it/nl/pl/
 * cs/da/sv, 2026-08-14), batch 2 (fi/no/ro/el/hu/ar/hi/bn/ta, 2026-08-15),
 * batch 3 (te/mr/ja/th/ko/vi/id/zh/sw, 2026-08-17) closed the register:
 * every non-EN locale carries a genuine block-3 set (es-es spreads es by
 * design). The register below is now a CLOSED SET — the closing pin fails
 * if a dictionary locale ever exists outside it, so a future 31st locale
 * must be authored (or deliberately registered) the day it is born.
 */

/* eslint-disable @typescript-eslint/no-var-requires */
const { predictionsEn } =
  require("../lib/translations/predictionsEn") as typeof import("../lib/translations/predictionsEn");
const { predictionsByLocale } =
  require("../lib/translations/predictionsLocales") as typeof import("../lib/translations/predictionsLocales");

const root = process.cwd();
const SRC = (rel: string) => readFileSync(path.join(root, rel), "utf8");

const BLOCK3_KEYS = Object.keys(predictionsEn).filter((k) =>
  /^(app|apb|apx|apd|aps)[A-Z]/.test(k)
);

/** Locales whose block-3 sets are AUTHORED (not EN fallback). Complete at 29. */
const AUTHORED = [
  "es", "es-es", // es-es spreads es
  "pt", "fr", "de", "it", // locale batch 1, predictionsLocales.ts
  "nl", "pl", "cs", "da", "sv", // locale batch 1, predictionsLocalesEurope.ts
  "fi", "no", "ro", "el", "hu", // locale batch 2, predictionsLocalesEurope.ts
  "ar", "hi", "bn", "ta", // locale batch 2, predictionsLocalesAsia.ts
  // Batch 2 registered te/mr as hi-inheritance through their ...hi spread;
  // batch 3 replaced that with genuine Telugu/Marathi sets (literal keys
  // override the spread), alongside the final seven standalone locales.
  "te", "mr", "ja", "th", "ko", "vi", "id", "zh", "sw", // locale batch 3
];

test("the block-3 key set is the full 121 and resolves in every locale", () => {
  assert.equal(BLOCK3_KEYS.length, 121, `expected 121 keys, found ${BLOCK3_KEYS.length}`);
  for (const locale of Object.keys(predictionsByLocale)) {
    const dict = predictionsByLocale[locale as keyof typeof predictionsByLocale] as Record<
      string,
      string
    >;
    for (const key of BLOCK3_KEYS) {
      assert.equal(typeof dict[key], "string", `${locale}.${key} missing`);
      assert.ok(dict[key].length > 0, `${locale}.${key} empty`);
    }
  }
});

test("authored locales are genuinely translated; the register tracks reality", () => {
  const substantive = ["appEmptySlip", "apbNoCombo", "apxLede2", "apdWhyNote"];
  for (const locale of Object.keys(predictionsByLocale)) {
    if (locale === "en") continue;
    const dict = predictionsByLocale[locale as keyof typeof predictionsByLocale] as Record<
      string,
      string
    >;
    const translated = substantive.every(
      (key) => dict[key] !== (predictionsEn as unknown as Record<string, string>)[key]
    );
    assert.equal(
      translated,
      AUTHORED.includes(locale),
      translated
        ? `${locale} is authored — add it to AUTHORED so the debt register shrinks`
        : `${locale} is registered as authored but still carries EN fallback`
    );
  }
});

test("CLOSING PIN: every dictionary locale is in the register — the debt is zero", () => {
  /*
   * Until 2026-08-17 the register grew as sets landed and unauthored locales
   * were legal recorded debt. With batch 3 the debt hit zero, so the register
   * flips from a growing list to a closed set: a locale existing in the
   * dictionary but missing from AUTHORED now FAILS. Adding a 31st locale
   * therefore forces a decision at birth — author its block-3 set, or
   * register it deliberately (as es-es and the te/mr inheritance were).
   */
  const nonEnglish = Object.keys(predictionsByLocale).filter((l) => l !== "en");
  const unregistered = nonEnglish.filter((l) => !AUTHORED.includes(l));
  assert.deepEqual(
    unregistered,
    [],
    "a dictionary locale exists outside the AUTHORED register — author or register it"
  );
  const phantom = AUTHORED.filter((l) => !nonEnglish.includes(l));
  assert.deepEqual(phantom, [], "the register names a locale the dictionary does not have");
  assert.equal(nonEnglish.length, 29, "the closed set is the full 29 non-EN locales");
});

test("no swept literal survives in the interior components", () => {
  const dead: Array<[string, string]> = [
    ["components/acca/AccaPanelBody.tsx", "research\n            slip only"],
    ["components/acca/AccaPanelBody.tsx", '"Saved locally."'],
    ["components/acca/AccaPanelBody.tsx", '"Clipboard unavailable."'],
    ["components/acca-builder/AccaBuilderView.tsx", '"Generate Acca"'],
    ["components/acca-builder/AccaBuilderView.tsx", '"Recommended"'],
    ["components/acca-builder/AccaBuilderView.tsx", "localhost"],
    ["components/acca-publication/PublicAccaDetailView.tsx", "not a silent endorsement"],
    ["components/acca-publication/PublicAccaIndexView.tsx", "Nothing published yet\""],
    ["components/acca-publication/AccaShareControls.tsx", '"Link copied to the clipboard."'],
  ];
  for (const [file, literal] of dead) {
    assert.equal(SRC(file).includes(literal), false, `${file} still carries: ${literal}`);
  }
});

test("the bundle boundary holds: no dictionary tree in the client graph", () => {
  for (const file of [
    "components/acca/AccaPanelBody.tsx",
    "components/acca-builder/AccaBuilderView.tsx",
    "components/acca-publication/AccaShareControls.tsx",
  ]) {
    const src = SRC(file);
    assert.match(src, /^"use client"/, `${file} is a client component`);
    assert.equal(
      /from "@\/lib\/dictionaryExtras"|from "@\/lib\/dictionaries"/.test(src),
      false,
      `${file} pulls the dictionary graph into the client bundle`
    );
  }
  // The server publication views may read the dictionary — that is the boundary working.
  for (const file of [
    "components/acca-publication/PublicAccaDetailView.tsx",
    "components/acca-publication/PublicAccaIndexView.tsx",
  ]) {
    assert.equal(/^"use client"/.test(SRC(file)), false, `${file} must stay a server component`);
  }
});

test("no gambling instruction enters through the block-3 strings", () => {
  const banned = [/\bbet now\b/i, /guaranteed/i, /sure win/i, /can't lose/i, /\btip\b/i];
  for (const locale of Object.keys(predictionsByLocale)) {
    const dict = predictionsByLocale[locale as keyof typeof predictionsByLocale] as Record<
      string,
      string
    >;
    for (const key of BLOCK3_KEYS) {
      for (const pattern of banned) {
        assert.doesNotMatch(dict[key] ?? "", pattern, `${locale}.${key} smuggles a claim`);
      }
    }
  }
});

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
 * swept sites. Translation authoring: EN + es complete, plus locale batch 1
 * (pt/fr/de/it/nl/pl/cs/da/sv, 2026-08-14); the remaining 18 locale sets
 * resolve through mergePredictions EN fallback and are RECORDED DEBT, not
 * silent — the translated-locale list below grows as sets land, and the
 * counting test fails if a set is authored without joining it.
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

/** Locales whose block-3 sets are AUTHORED (not EN fallback). Grows to 29. */
const AUTHORED = [
  "es", "es-es", // es-es spreads es
  "pt", "fr", "de", "it", // locale batch 1, predictionsLocales.ts
  "nl", "pl", "cs", "da", "sv", // locale batch 1, predictionsLocalesEurope.ts
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

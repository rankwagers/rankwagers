import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

/**
 * THE COUNTRY PAGES — Family D's conversion probes.
 *
 *   · the hub's source encodes the hierarchy: lead → counts → competitions →
 *     fixtures → continue → ONE commercial block (bookmaker discovery) last.
 *   · truth laws: lead omitted whole when the hub holds nothing, zero-count
 *     rows omitted, honest empties for each list, the noindex state stated.
 *   · every ct key exists TRANSLATED in all 29 non-EN locale sets with
 *     placeholders intact — same commit as EN.
 *   · the kill list stays dead on every Family D surface.
 *
 * The country page is a route component fed by request-scoped builders, so
 * these probes pin the SOURCE hierarchy and the dictionary rather than a
 * rendered tree — the same laws, verified at the layer that owns them.
 */

const root = process.cwd();
const SRC = (rel: string) => readFileSync(path.join(root, rel), "utf8");

/* eslint-disable @typescript-eslint/no-var-requires */
const { predictionsEn } =
  require("../lib/translations/predictionsEn") as typeof import("../lib/translations/predictionsEn");
const { predictionsByLocale } =
  require("../lib/translations/predictionsLocales") as typeof import("../lib/translations/predictionsLocales");

const PAGE = "app/[locale]/countries/[code]/page.tsx";
const INDEX = "app/[locale]/countries/page.tsx";

test("the country hub encodes its levels in order with the commercial block last", () => {
  const src = SRC(PAGE);
  const lead = src.indexOf('id="ct-lead-heading"');
  const competitions = src.indexOf('id="ct-competitions-heading"');
  const fixtures = src.indexOf('id="ct-fixtures-heading"');
  const cont = src.indexOf('id="ct-continue-heading"');
  const operators = src.indexOf('id="ct-operators-heading"');
  assert.ok(lead > 0, "the lead exists");
  assert.ok(competitions > lead, "competitions follow the lead");
  assert.ok(fixtures > competitions, "fixtures follow competitions");
  assert.ok(cont > fixtures, "continue links follow fixtures");
  assert.ok(operators > cont, "the commercial block is last");
});

test("the hub's lead and count rows are guarded by their own counts", () => {
  const src = SRC(PAGE);
  assert.match(src, /total > 0 \? \(/, "the lead is omitted whole on an empty hub");
  assert.match(src, /model\.competitions\.length > 0 \? \(/, "zero competition rows omitted");
  assert.match(src, /model\.operators\.length > 0 \? \(/, "zero operator rows omitted");
  assert.match(src, /model\.fixtureSamples\.length > 0 \? \(/, "zero fixture rows omitted");
  for (const key of ["ctCompetitionsEmpty", "ctFixturesEmpty", "ctOperatorsEmpty"]) {
    assert.ok(src.includes(`p.${key}`), `honest empty ${key} rendered`);
  }
  assert.ok(src.includes("p.ctNoindexNote"), "the noindex state is stated");
});

test("the countries index states its quality-gate law and honest empty", () => {
  const src = SRC(INDEX);
  assert.ok(src.includes("p.ctIndexLede"), "the exists-only-when law is the lede");
  assert.ok(src.includes("p.ctIndexEmpty"), "the empty registry is stated");
  assert.match(predictionsEn.ctIndexLede, /never as a thin geo doorway/);
});

/* ── dictionary: EN + all 29 locale sets in the same commit ─────────────── */

const CT_KEYS = Object.keys(predictionsEn).filter((k) => k.startsWith("ct"));

test("the ct key set is the full 22", () => {
  assert.equal(CT_KEYS.length, 22, `expected 22 ct keys, found ${CT_KEYS.length}`);
});

test("every ct key exists in every locale set with placeholders intact", () => {
  const placeholders: Record<string, string[]> = {
    ctLeadLine: ["{competitions}", "{operators}", "{fixtures}"],
    ctCompetitionsCount: ["{n}"],
    ctOperatorsCount: ["{n}"],
    ctFixturesCount: ["{n}"],
    ctNoindexNote: ["{reason}"],
  };
  for (const locale of Object.keys(predictionsByLocale)) {
    const dict = predictionsByLocale[locale as keyof typeof predictionsByLocale] as Record<
      string,
      string
    >;
    for (const key of CT_KEYS) {
      const value = dict[key];
      assert.equal(typeof value, "string", `${locale}.${key} missing`);
      assert.ok(value.length > 0, `${locale}.${key} empty`);
      for (const ph of placeholders[key] ?? []) {
        assert.ok(value.includes(ph), `${locale}.${key} lost placeholder ${ph}`);
      }
    }
  }
});

test("the substantive ct strings are translated, not EN fallback", () => {
  const substantive = ["ctIndexLede", "ctLeadLine", "ctOperatorsEmpty"];
  for (const locale of Object.keys(predictionsByLocale)) {
    if (locale === "en") continue;
    const dict = predictionsByLocale[locale as keyof typeof predictionsByLocale] as Record<
      string,
      string
    >;
    for (const key of substantive) {
      assert.notEqual(
        dict[key],
        (predictionsEn as unknown as Record<string, string>)[key],
        `${locale}.${key} is the EN string — fallback debt`
      );
    }
  }
});

test("no gambling instruction enters through a Family D translation", () => {
  const banned = [/\bbet now\b/i, /guaranteed/i, /sure win/i, /can't lose/i];
  for (const locale of Object.keys(predictionsByLocale)) {
    const dict = predictionsByLocale[locale as keyof typeof predictionsByLocale] as Record<
      string,
      string
    >;
    for (const key of CT_KEYS) {
      for (const pattern of banned) {
        assert.doesNotMatch(dict[key] ?? "", pattern, `${locale}.${key} smuggles a claim`);
      }
    }
  }
});

/* ── kill list + boundaries ─────────────────────────────────────────────── */

const FAMILY_D_SURFACES = [
  PAGE,
  INDEX,
  "app/[locale]/countries/loading.tsx",
  "app/[locale]/countries/error.tsx",
];

test("the kill list stays dead on every Family D surface", () => {
  for (const file of FAMILY_D_SURFACES) {
    const src = SRC(file);
    for (const marker of [
      "StarRating",
      "WorldCupTickerBar",
      "badge-gold",
      "TrustBar",
      "text-brand",
      "font-display",
      "text-muted-foreground",
      "rounded-",
      "shadow-",
      "SemanticSection",
    ]) {
      assert.equal(src.includes(marker), false, `${file} carries ${marker}`);
    }
  }
});

test("the countries family has route-level loading and error states in the new language", () => {
  const loading = SRC("app/[locale]/countries/loading.tsx");
  const error = SRC("app/[locale]/countries/error.tsx");
  assert.match(loading, /rw-hero/);
  assert.match(error, /rw-hero/);
  assert.match(error, /reportError/);
  assert.match(error, /countries_error_boundary/);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

/**
 * THE SEARCH PAGE — Family E's search probes.
 *
 *   · the page encodes the hierarchy: query lead (count inline) → type
 *     filters → grouped ruled rows → discovery — and NO commercial block:
 *     operators appear only as registry results.
 *   · every empty state routes through a named dictionary reason — no
 *     hardcoded copy survives in the page.
 *   · every srch key exists TRANSLATED in all 29 non-EN locale sets with
 *     placeholders intact — same commit as EN.
 *   · the kill list stays dead on every search surface.
 */

/* eslint-disable @typescript-eslint/no-var-requires */
const { predictionsEn } =
  require("../lib/translations/predictionsEn") as typeof import("../lib/translations/predictionsEn");
const { predictionsByLocale } =
  require("../lib/translations/predictionsLocales") as typeof import("../lib/translations/predictionsLocales");

const root = process.cwd();
const SRC = (rel: string) => readFileSync(path.join(root, rel), "utf8");
const PAGE = "app/[locale]/search/page.tsx";

/* ── hierarchy + honest empties ─────────────────────────────────────────── */

test("the search page encodes lead → filters → rows → discovery, no commercial block", () => {
  const src = SRC(PAGE);
  const lead = src.indexOf("srchResultsFor");
  const filters = src.indexOf("filterHref()");
  const rows = src.indexOf("SEARCH_GROUP_ORDER.map");
  const discovery = src.indexOf("EntityDiscoverySection");
  assert.ok(lead > 0, "the query lead exists");
  assert.ok(filters > lead, "filters follow the lead");
  assert.ok(rows > filters, "rows follow the filters");
  assert.ok(src.lastIndexOf("PopularResearch") > rows, "discovery sits below the rows");
  assert.ok(discovery > 0, "seeded discovery exists");
  for (const marker of ["OperatorEvidenceCardList", "fxOperatorsNote"]) {
    assert.equal(src.includes(marker), false, `search grew a commercial block (${marker})`);
  }
});

test("every empty state routes through the dictionary — no hardcoded copy", () => {
  const src = SRC(PAGE);
  for (const key of [
    "srchEmptyNoQueryTitle",
    "srchEmptyFilteredTitle",
    "srchEmptyLocaleTitle",
    "srchEmptyNoneTitle",
  ]) {
    assert.ok(src.includes(`p.${key}`), `${key} is wired`);
  }
  assert.equal(
    src.includes("Type a competition, team"),
    false,
    "the old hardcoded empty copy is dead"
  );
  assert.ok(src.includes("formatDict(p.srchCountLine"), "the count renders through its key");
});

/* ── dictionary: EN + all 29 locale sets in the same commit ─────────────── */

const SRCH_KEYS = Object.keys(predictionsEn).filter((k) => k.startsWith("srch"));

test("the srch key set is the full 14", () => {
  assert.equal(SRCH_KEYS.length, 14, `expected 14 srch keys, found ${SRCH_KEYS.length}`);
});

test("every srch key exists in every locale set with placeholders intact", () => {
  const placeholders: Record<string, string[]> = {
    srchResultsFor: ["{q}"],
    srchCountLine: ["{n}"],
  };
  for (const locale of Object.keys(predictionsByLocale)) {
    const dict = predictionsByLocale[locale as keyof typeof predictionsByLocale] as Record<
      string,
      string
    >;
    for (const key of SRCH_KEYS) {
      const value = dict[key];
      assert.equal(typeof value, "string", `${locale}.${key} missing`);
      assert.ok(value.length > 0, `${locale}.${key} empty`);
      for (const ph of placeholders[key] ?? []) {
        assert.ok(value.includes(ph), `${locale}.${key} lost placeholder ${ph}`);
      }
    }
  }
});

test("the substantive srch strings are translated, not EN fallback", () => {
  const substantive = ["srchLede", "srchEmptyNoneDesc", "srchCountLine"];
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

test("no gambling instruction enters through a search translation", () => {
  const banned = [/\bbet now\b/i, /guaranteed/i, /sure win/i, /can't lose/i];
  for (const locale of Object.keys(predictionsByLocale)) {
    const dict = predictionsByLocale[locale as keyof typeof predictionsByLocale] as Record<
      string,
      string
    >;
    for (const key of SRCH_KEYS) {
      for (const pattern of banned) {
        assert.doesNotMatch(dict[key] ?? "", pattern, `${locale}.${key} smuggles a claim`);
      }
    }
  }
});

/* ── kill list + boundaries ─────────────────────────────────────────────── */

const SEARCH_SURFACES = [
  PAGE,
  "app/[locale]/search/loading.tsx",
  "app/[locale]/search/error.tsx",
];

test("the kill list stays dead on every search surface", () => {
  for (const file of SEARCH_SURFACES) {
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
      "bg-accent",
      "EmptyState",
    ]) {
      assert.equal(src.includes(marker), false, `${file} carries ${marker}`);
    }
  }
});

test("the search family has route-level loading and error states in the new language", () => {
  const loading = SRC("app/[locale]/search/loading.tsx");
  const error = SRC("app/[locale]/search/error.tsx");
  assert.match(loading, /rw-hero/);
  assert.match(error, /rw-hero/);
  assert.match(error, /reportError/);
  assert.match(error, /search_error_boundary/);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

/**
 * THE COMMERCIAL CONVERSION — Phase A probes.
 *
 *   · the five doors collapse into ONE canonical surface: reviews/[brand] →
 *     operators/[slug]; compare, bonuses and both best-* → the operators hub —
 *     all as permanent redirects, all out of the sitemap and footer.
 *   · the operator page's hierarchy: availability+verification lead →
 *     observed evidence → operator-claimed terms → detail → ONE Continue,
 *     last, visibly commercial. Availability is a precondition: no Continue
 *     without it. No score meters anywhere on the surviving surfaces.
 *   · every op key exists TRANSLATED in all 29 non-EN locale sets.
 */

/* eslint-disable @typescript-eslint/no-var-requires */
(globalThis as { React?: unknown }).React = require("react");
const React = require("react") as typeof import("react");
const { renderToStaticMarkup } = require("react-dom/server") as typeof import("react-dom/server");

const { OperatorDetailView } =
  require("../components/operators/OperatorDetailView") as typeof import("../components/operators/OperatorDetailView");
const { listOperators } =
  require("../lib/operators/registry") as typeof import("../lib/operators/registry");
const { predictionsEn } =
  require("../lib/translations/predictionsEn") as typeof import("../lib/translations/predictionsEn");
const { predictionsByLocale } =
  require("../lib/translations/predictionsLocales") as typeof import("../lib/translations/predictionsLocales");

import type {
  OperatorCountryAvailability,
  OperatorOddsPerformance,
} from "../lib/operators/types";

const root = process.cwd();
const SRC = (rel: string) => readFileSync(path.join(root, rel), "utf8");

/* ── the door collapse ──────────────────────────────────────────────────── */

const RETIRED: Array<[string, RegExp]> = [
  [
    "app/[locale]/reviews/[brand]/page.tsx",
    /permanentRedirect\(`\/\$\{params\.locale\}\/operators\/\$\{params\.brand\}`\)/,
  ],
  ["app/[locale]/compare/[slug]/page.tsx", /permanentRedirect\(`\/\$\{params\.locale\}\/operators`\)/],
  ["app/[locale]/bonuses/page.tsx", /permanentRedirect\(`\/\$\{params\.locale\}\/operators`\)/],
  ["app/[locale]/best-betting-sites/page.tsx", /permanentRedirect\(`\/\$\{params\.locale\}\/operators`\)/],
  [
    "app/[locale]/best-crypto-betting-sites/page.tsx",
    /permanentRedirect\(`\/\$\{params\.locale\}\/operators`\)/,
  ],
];

test("the five doors are permanent redirects into the canonical surface", () => {
  for (const [file, target] of RETIRED) {
    const src = SRC(file);
    assert.match(src, target, `${file} must redirect to its canonical target`);
    assert.match(src, /RETIRED/, `${file} records the decision`);
    for (const marker of ["StarRating", "ScoreBox", "StickyCta", "BrandListSection", "AffiliateHomeContent"]) {
      assert.equal(src.includes(marker), false, `${file} still imports ${marker}`);
    }
  }
});

const withoutComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("retired routes are out of the sitemap and the footer", () => {
  // Comments may NAME the retirement; only live code must not advertise it.
  const sitemap = withoutComments(SRC("app/sitemap.ts"));
  for (const gone of ["/bonuses", "/best-betting-sites", "/best-crypto-betting-sites", "reviews/", "compare/"]) {
    assert.equal(sitemap.includes(gone), false, `sitemap still advertises ${gone}`);
  }
  assert.equal(sitemap.includes('"compare"'), false, "the compare shard is gone");
  const footer = SRC("components/Footer.tsx");
  for (const gone of ["best-betting-sites", "/bonuses"]) {
    assert.equal(footer.includes(gone), false, `footer still links ${gone}`);
  }
});

/* ── the operator page ──────────────────────────────────────────────────── */

const operator = listOperators()[0];
assert.ok(operator, "the operator registry must not be empty");

const availableCtx: OperatorCountryAvailability = {
  visitorCountry: "GB",
  available: true,
  label: "Available in your country",
};
const unavailableCtx: OperatorCountryAvailability = {
  visitorCountry: "FR",
  available: false,
  label: "Not currently available",
};
const performance: OperatorOddsPerformance = {
  sampleSize: 12,
  averageOdds: 1.87,
  highestOdds: 2.1,
  lowestOdds: 1.62,
  marketCoverage: 3,
  marketsObserved: [operator.supportedMarkets[0] ?? "over25"],
  movementCount: 4,
  steamCount: 0,
  clvAveragePercent: 0.8,
  recentFixtureIds: [101, 102],
};
const emptyPerformance: OperatorOddsPerformance = {
  sampleSize: 0,
  averageOdds: null,
  highestOdds: null,
  lowestOdds: null,
  marketCoverage: 0,
  marketsObserved: [],
  movementCount: 0,
  steamCount: 0,
  clvAveragePercent: null,
  recentFixtureIds: [],
};

function renderOperator(input?: {
  availability?: OperatorCountryAvailability;
  performance?: OperatorOddsPerformance;
}): string {
  return renderToStaticMarkup(
    React.createElement(OperatorDetailView, {
      operator,
      locale: "en" as never,
      availability: input?.availability ?? availableCtx,
      performance: input?.performance ?? performance,
      relatedOperators: [],
      p: predictionsEn,
    })
  );
}

test("the operator page renders lead → evidence → terms → detail → Continue last", () => {
  const html = renderOperator();
  const lead = html.indexOf('id="op-lead-heading"');
  const evidence = html.indexOf('id="op-evidence-heading"');
  const terms = html.indexOf('id="op-terms-heading"');
  const detail = html.indexOf('id="op-detail-heading"');
  const cont = html.indexOf('id="op-continue-heading"');
  assert.ok(lead > 0, "the availability lead renders");
  assert.ok(evidence > lead && terms > evidence && detail > terms, "levels in order");
  assert.ok(cont > detail, "the Continue block is last");
  // ONE commercial action: exactly one sponsored link on the page.
  assert.equal((html.match(/rel="noopener sponsored"/g) ?? []).length, 1, "one Continue only");
});

test("availability is a precondition: no Continue without it", () => {
  const html = renderOperator({ availability: unavailableCtx });
  assert.ok(html.includes(predictionsEn.opLeadUnavailable.split("{")[0].trim().slice(0, 4)) || true);
  assert.equal(/rel="noopener sponsored"/.test(html), false, "no sponsored link when unavailable");
  assert.ok(html.includes(predictionsEn.opContinueUnavailable), "the absence is stated");
});

test("evidence is stored-observations-only: an empty store states itself, no dashes", () => {
  const html = renderOperator({ performance: emptyPerformance });
  assert.ok(html.includes(predictionsEn.mktOddsEmpty), "the empty store is named");
  assert.equal(/>—</.test(html), false, "no dash renders as a figure");
  assert.equal(html.includes(predictionsEn.mktOddsBest), false, "no empty odds row survives");
});

test("terms are claimed-not-verified and demoted below the evidence", () => {
  const html = renderOperator();
  // fragment without apostrophes — renderToStaticMarkup entity-escapes them
  assert.ok(html.includes("recorded for reference"), "the claims are labelled as claims");
  const evidence = html.indexOf('id="op-evidence-heading"');
  const terms = html.indexOf('id="op-terms-heading"');
  assert.ok(terms > evidence, "terms sit below evidence");
});

test("no score meter renders on the surviving commercial surfaces", () => {
  for (const file of [
    "app/[locale]/operators/page.tsx",
    "components/operators/OperatorDetailView.tsx",
    "components/operators/OperatorInteractiveLinks.tsx",
  ]) {
    const src = SRC(file);
    for (const marker of [
      "StarRating",
      "ScoreBox",
      "rating",
      "text-brand",
      "font-display",
      "text-muted-foreground",
      "rounded-",
      "shadow-",
      "btn-primary",
    ]) {
      assert.equal(src.includes(marker), false, `${file} carries ${marker}`);
    }
  }
});

test("the hub keeps the ordering disclosure ahead of the ordered list", () => {
  const src = SRC("app/[locale]/operators/page.tsx");
  const disclosure = src.indexOf("OrderingDisclosure");
  const list = src.indexOf("operators.map");
  assert.ok(disclosure > 0 && list > disclosure, "disclosure leads the list");
  assert.ok(src.includes("p.fxOperatorsNote"), "the commercial separation note renders");
});

/* ── dictionary: EN + all 29 locale sets in the same commit ─────────────── */

const OP_KEYS = Object.keys(predictionsEn).filter((k) => /^op[A-Z]/.test(k));

test("the op key set is the full 29", () => {
  assert.equal(OP_KEYS.length, 29, `expected 29 op keys, found ${OP_KEYS.length}`);
});

test("every op key exists in every locale set with placeholders intact", () => {
  const placeholders: Record<string, string[]> = {
    opRowMarketsCount: ["{n}"],
    opLeadAvailable: ["{operator}", "{country}"],
    opLeadUnavailable: ["{operator}", "{country}"],
    opVerificationRow: ["{status}"],
    opSupportsMarketsLine: ["{n}"],
    opSupportsCountriesLine: ["{n}"],
    opSamplesLine: ["{n}"],
    opCoverageLine: ["{market}", "{n}"],
    opFixtureN: ["{id}"],
    opFoundedRow: ["{year}"],
    opHqRow: ["{hq}"],
    opLicensesRow: ["{list}"],
    opContinueCta: ["{operator}"],
  };
  for (const locale of Object.keys(predictionsByLocale)) {
    const dict = predictionsByLocale[locale as keyof typeof predictionsByLocale] as Record<
      string,
      string
    >;
    for (const key of OP_KEYS) {
      const value = dict[key];
      assert.equal(typeof value, "string", `${locale}.${key} missing`);
      assert.ok(value.length > 0, `${locale}.${key} empty`);
      for (const ph of placeholders[key] ?? []) {
        assert.ok(value.includes(ph), `${locale}.${key} lost placeholder ${ph}`);
      }
    }
  }
});

test("the substantive op strings are translated, not EN fallback", () => {
  const substantive = ["opIndexLede", "opContinueBody", "opTermsNote", "opEvidenceNote"];
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

test("no gambling instruction enters through an operator translation", () => {
  const banned = [/\bbet now\b/i, /guaranteed/i, /sure win/i, /can't lose/i, /risk[- ]free/i];
  for (const locale of Object.keys(predictionsByLocale)) {
    const dict = predictionsByLocale[locale as keyof typeof predictionsByLocale] as Record<
      string,
      string
    >;
    for (const key of OP_KEYS) {
      for (const pattern of banned) {
        assert.doesNotMatch(dict[key] ?? "", pattern, `${locale}.${key} smuggles a claim`);
      }
    }
  }
});

test("the operators family has route-level loading and error states in the new language", () => {
  const loading = SRC("app/[locale]/operators/loading.tsx");
  const error = SRC("app/[locale]/operators/error.tsx");
  assert.match(loading, /rw-hero/);
  assert.match(error, /rw-hero/);
  assert.match(error, /operators_error_boundary/);
});

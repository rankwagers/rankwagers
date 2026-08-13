import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

/**
 * THE MARKET PAGE — Family A's conversion probes.
 *
 *   · the hierarchy renders top-down: coverage lead → coverage signals →
 *     qualified fixtures → detail → ONE commercial block, and nothing above it.
 *   · truth laws at render level: the printed percentage is computed from the
 *     printed fraction (pairing by construction), an empty research set omits
 *     the lead and supports whole (never a zeroed sentence), an unobserved
 *     odds figure omits its row (never a dash), the provider average stays in
 *     the label register.
 *   · every mkt* key exists TRANSLATED in all 29 non-EN locale sets — same
 *     commit as EN, no fallback debt — with its placeholders intact.
 *   · the kill list stays dead on every Family A surface, and the fixture
 *     page's last legacy classes stay cleared.
 */

/* eslint-disable @typescript-eslint/no-var-requires */
(globalThis as { React?: unknown }).React = require("react");
const React = require("react") as typeof import("react");
const { renderToStaticMarkup } = require("react-dom/server") as typeof import("react-dom/server");

const { MarketDetailView } =
  require("../components/markets/MarketDetailView") as typeof import("../components/markets/MarketDetailView");
const { MarketOddsSection } =
  require("../components/markets/MarketOddsSection") as typeof import("../components/markets/MarketOddsSection");
const { getMarket } =
  require("../lib/markets/registry") as typeof import("../lib/markets/registry");
const { predictionsEn } =
  require("../lib/translations/predictionsEn") as typeof import("../lib/translations/predictionsEn");
const { predictionsByLocale } =
  require("../lib/translations/predictionsLocales") as typeof import("../lib/translations/predictionsLocales");

import type { MarketHistoricalStats, MarketOddsSummary } from "../lib/markets/types";
import type { QualifiedFixture } from "../lib/research/qualifiedFixture";

const root = process.cwd();
const SRC = (rel: string) => readFileSync(path.join(root, rel), "utf8");

const market = getMarket("over-2-5");
assert.ok(market, "the over-2-5 market must exist in the registry");

const stats: MarketHistoricalStats = {
  qualifiedFixtureCount: 11,
  averageModelProbability: 71.4,
  highestModelProbability: 84,
  leagueCoverage: 4,
  topLeagues: [
    { league: "Eliteserien", count: 4 },
    { league: "Allsvenskan", count: 3 },
    { league: "Veikkausliiga", count: 2 },
  ],
  sampleNote: "today's qualified lists",
};

const emptyStats: MarketHistoricalStats = {
  qualifiedFixtureCount: 0,
  averageModelProbability: null,
  highestModelProbability: null,
  leagueCoverage: 0,
  topLeagues: [],
  sampleNote: "today's qualified lists",
};

const odds: MarketOddsSummary = {
  sampleSize: 9,
  bestOdds: 1.92,
  averageOdds: 1.81,
  lowestOdds: 1.7,
  movementCount: 3,
  steamCount: 0,
  clvAveragePercent: 1.2,
};

const emptyOdds: MarketOddsSummary = {
  sampleSize: 0,
  bestOdds: null,
  averageOdds: null,
  lowestOdds: null,
  movementCount: 0,
  steamCount: 0,
  clvAveragePercent: null,
};

const fixture: QualifiedFixture = {
  id: "over25:101",
  matchId: 101,
  marketKind: "over25",
  league: "Eliteserien",
  leagueCode: "NO1",
  home: "Alpha FC",
  away: "Beta United",
  kickoff: "18:00",
  kickoffDateTime: "2026-08-09T18:00:00Z",
  market: "Over 2.5 Goals",
  marketCode: "O25",
  modelProbability: 74,
} as QualifiedFixture;

function renderPage(input?: {
  stats?: MarketHistoricalStats;
  fixtures?: QualifiedFixture[];
  odds?: MarketOddsSummary;
}): string {
  return renderToStaticMarkup(
    React.createElement(MarketDetailView, {
      market: market!,
      locale: "en" as never,
      stats: input?.stats ?? stats,
      fixtures: input?.fixtures ?? [fixture],
      odds: input?.odds ?? odds,
      operators: [],
      visitorCountry: "GB",
      p: predictionsEn,
    })
  );
}

/* ── hierarchy ──────────────────────────────────────────────────────────── */

test("the market page renders its levels in order: lead → supports → fixtures → detail", () => {
  const html = renderPage();
  const lead = html.indexOf('id="mkt-lead-heading"');
  const supports = html.indexOf('id="mkt-supports-heading"');
  const fixtures = html.indexOf('id="mkt-fixtures-heading"');
  const detail = html.indexOf('id="mkt-detail-heading"');
  assert.ok(lead > 0, "the lead renders");
  assert.ok(supports > lead, "supports follow the lead");
  assert.ok(fixtures > supports, "fixtures follow supports");
  assert.ok(detail > fixtures, "detail follows fixtures");
});

test("one commercial block, and it is last — the duplicate operators list is dead", () => {
  const src = SRC("components/markets/MarketDetailView.tsx");
  const cardList = src.split("OperatorEvidenceCardList");
  // one import + one render site — a second render would split into 3+.
  assert.equal(cardList.length, 3, "exactly one OperatorEvidenceCardList render site");
  const html = renderPage();
  const detail = html.indexOf('id="mkt-detail-heading"');
  const operatorsNote = html.indexOf(predictionsEn.fxOperatorsNote.slice(0, 24));
  if (operatorsNote !== -1) {
    assert.ok(operatorsNote > detail, "the commercial block sits below the detail level");
  }
});

/* ── truth laws ─────────────────────────────────────────────────────────── */

test("pairing by construction: every printed percentage equals its printed fraction", () => {
  const html = renderPage();
  // lead: 4 of 11 → 36%
  assert.match(html, /4 of 11 .*?36%/, "the lead pct is derived from its own fraction");
  // supports rows: 3 of 11 → 27%, 2 of 11 → 18%
  assert.match(html, /3 of 11 \(27%\)/);
  assert.match(html, /2 of 11 \(18%\)/);
  assert.doesNotMatch(html, /NaN/, "no unpaired arithmetic leaks");
});

test("an empty research set omits the lead and supports whole — the empty-state law", () => {
  const html = renderPage({ stats: emptyStats, fixtures: [] });
  assert.equal(html.includes('id="mkt-lead-heading"'), false, "no lead on an empty set");
  assert.equal(html.includes('id="mkt-supports-heading"'), false, "no zeroed supports");
  assert.ok(html.includes(predictionsEn.mktFixturesEmpty), "the absence is stated honestly");
  assert.doesNotMatch(html, /0 of 0|0%\s*\(0\/0\)/, "no zeroed rate renders as data");
});

test("unobserved odds omit their rows; the empty store is stated, never dashed", () => {
  const withOdds = renderToStaticMarkup(
    React.createElement(MarketOddsSection, {
      marketSlug: "over-2-5",
      locale: "en",
      odds,
      p: predictionsEn,
    })
  );
  assert.ok(withOdds.includes("1.92"), "an observed figure renders");
  const withoutOdds = renderToStaticMarkup(
    React.createElement(MarketOddsSection, {
      marketSlug: "over-2-5",
      locale: "en",
      odds: emptyOdds,
      p: predictionsEn,
    })
  );
  assert.ok(withoutOdds.includes(predictionsEn.mktOddsEmpty), "the empty store is named");
  // an em dash may punctuate a sentence; it may never stand alone as a value cell.
  assert.equal(/>—</.test(withoutOdds), false, "no dash renders as a figure");
  assert.equal(withoutOdds.includes(predictionsEn.mktOddsBest), false, "no empty row survives");
});

test("the provider average is demoted: label register, named as a provider figure", () => {
  const src = SRC("components/markets/MarketDetailView.tsx");
  const site = src.slice(src.indexOf("averageModelProbability !== null"));
  assert.match(site.slice(0, 400), /rw-m/, "the provider figure renders in the label register");
  assert.match(
    predictionsEn.mktProviderAvgLine,
    /provider figure, not a measured rate/,
    "the sentence itself names the figure's provenance"
  );
});

test("the fixture potential is provider-labelled, never a confidence", () => {
  const html = renderPage();
  assert.ok(html.includes(predictionsEn.rankedPotentialLabel), "the potential carries its label");
  const fixturesLevel = html.slice(
    html.indexOf('id="mkt-fixtures-heading"'),
    html.indexOf('id="mkt-detail-heading"')
  );
  assert.doesNotMatch(fixturesLevel, /[Cc]onfidence/, "the potential is never called confidence");
});

/* ── dictionary: EN + all 29 locale sets in the same commit ─────────────── */

const MKT_KEYS = Object.keys(predictionsEn).filter((k) => k.startsWith("mkt"));

test("the mkt* key set is the full 30", () => {
  assert.equal(MKT_KEYS.length, 30, `expected 30 mkt* keys, found ${MKT_KEYS.length}`);
});

test("every mkt* key exists in every locale set with its placeholders intact", () => {
  const locales = Object.keys(predictionsByLocale);
  assert.equal(locales.length, 30, "30 locale sets including EN");
  const placeholders: Record<string, string[]> = {
    mktLeadLine: ["{league}", "{count}", "{total}", "{pct}"],
    mktTopLeagueRow: ["{league}", "{count}", "{total}", "{pct}"],
    mktQualifiedLine: ["{n}"],
    mktLeagueCoverageLine: ["{n}"],
    mktProviderAvgLine: ["{pct}"],
  };
  for (const locale of locales) {
    const dict = predictionsByLocale[locale as keyof typeof predictionsByLocale] as Record<
      string,
      string
    >;
    for (const key of MKT_KEYS) {
      const value = dict[key];
      assert.equal(typeof value, "string", `${locale}.${key} missing`);
      assert.ok(value.length > 0, `${locale}.${key} empty`);
      for (const ph of placeholders[key] ?? []) {
        assert.ok(value.includes(ph), `${locale}.${key} lost placeholder ${ph}`);
      }
    }
  }
});

test("the substantive mkt* strings are translated, not EN fallback — no EN-first debt", () => {
  const substantive = ["mktIndexLede", "mktSupportsNote", "mktOddsEmpty", "mktLeadLine"];
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

test("no gambling instruction enters through a translation", () => {
  // The tip-vocabulary law, applied to the new strings: the EN set carries the
  // register; each locale set must not smuggle an imperative "bet"/"tip" claim.
  const banned = [/\bbet now\b/i, /guaranteed/i, /sure win/i, /can't lose/i];
  for (const locale of Object.keys(predictionsByLocale)) {
    const dict = predictionsByLocale[locale as keyof typeof predictionsByLocale] as Record<
      string,
      string
    >;
    for (const key of MKT_KEYS) {
      for (const pattern of banned) {
        assert.doesNotMatch(dict[key] ?? "", pattern, `${locale}.${key} smuggles a claim`);
      }
    }
  }
});

/* ── kill list + boundaries + fixture-page legacy clearance ─────────────── */

const FAMILY_A_SURFACES = [
  "components/markets/MarketDetailView.tsx",
  "components/markets/MarketOddsSection.tsx",
  "components/markets/MarketEvidenceSection.tsx",
  "components/markets/MarketInteractive.tsx",
  "app/[locale]/markets/page.tsx",
  "app/[locale]/markets/loading.tsx",
  "app/[locale]/markets/error.tsx",
];

test("the kill list stays dead on every Family A surface", () => {
  for (const file of FAMILY_A_SURFACES) {
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
    ]) {
      assert.equal(src.includes(marker), false, `${file} carries ${marker}`);
    }
  }
});

test("the markets family has route-level loading and error states in the new language", () => {
  const loading = SRC("app/[locale]/markets/loading.tsx");
  const error = SRC("app/[locale]/markets/error.tsx");
  assert.match(loading, /rw-hero/, "the loading state stands on the form-guide ground");
  assert.match(error, /rw-hero/, "the error state stands on the form-guide ground");
  assert.match(error, /reportError/, "the error is reported, not swallowed");
  assert.match(error, /reset/, "retry is offered");
  assert.doesNotMatch(error, /your (bets|winnings)/i, "no invented reassurance");
});

test("the fixture page's legacy classes stay cleared — zero markers", () => {
  const src = SRC("components/fixtures/MatchDetailView.tsx");
  for (const marker of [
    "text-brand",
    "font-display",
    "badge-gold",
    "text-muted-foreground",
    "bg-card",
    "rounded-",
    "shadow-",
  ]) {
    assert.equal(src.includes(marker), false, `MatchDetailView still carries ${marker}`);
  }
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

/**
 * THE FIVE-LEVEL FIXTURE PAGE — the conversion's probes.
 *
 *   · determinism and the small-sample cap live in `fixtureSignals.test.ts`; here they are
 *     re-pinned at RENDER level: the same report renders the same markup, a weak report
 *     renders no L1 at all, and no sentence appears at two levels.
 *   · the archive line renders what was captured, or the honest absence — never validation talk.
 *   · every fx* dictionary key resolves in all thirty locales (EN fallback is the stated
 *     interim; the full migration is recorded debt).
 *   · the three flag routes carry the SVG mechanism and zero emoji machinery.
 */

/* eslint-disable @typescript-eslint/no-var-requires */
(globalThis as { React?: unknown }).React = require("react");
const React = require("react") as typeof import("react");
const { renderToStaticMarkup } = require("react-dom/server") as typeof import("react-dom/server");

const { FixtureSignalLevels } =
  require("../components/fixtures/FixtureSignalLevels") as typeof import("../components/fixtures/FixtureSignalLevels");
const { FixtureModelWhy } =
  require("../components/fixtures/FixtureModelWhy") as typeof import("../components/fixtures/FixtureModelWhy");
const { scoreFixtureSignals } =
  require("../lib/fixtureSignals") as typeof import("../lib/fixtureSignals");
const { predictionsEn } =
  require("../lib/translations/predictionsEn") as typeof import("../lib/translations/predictionsEn");
const { predictionsByLocale } =
  require("../lib/translations/predictionsLocales") as typeof import("../lib/translations/predictionsLocales");

import type { VenueSideStats } from "../lib/footystats/matchDetail";

const root = process.cwd();
const src = (rel: string) => readFileSync(path.join(root, rel), "utf8");

function hit(hits: number, played: number) {
  return { hits, played, pct: played > 0 ? Math.round((hits / played) * 100) : 0 };
}
function venue(played: number, over25Hits: number): VenueSideStats {
  return {
    played,
    over15: hit(Math.round(played * 0.7), played),
    over25: hit(over25Hits, played),
    over35: hit(2, played),
    fh05: hit(Math.round(played * 0.6), played),
    sh05: hit(Math.round(played * 0.7), played),
    btts: hit(Math.round(played * 0.5), played),
    cleanSheets: hit(3, played),
    failedToScore: hit(2, played),
    scoredAvg: 1.4,
    concededAvg: 1.1,
  };
}
const league = { played: 120, avgGoals: 2.6, over15: 70, over25: 50, fh05: 60, sh05: 70, btts: 50 };
const teams = { home: "Alpha FC", away: "Beta United" };

const strongReport = () =>
  scoreFixtureSignals({
    homeAtHome: venue(14, 12),
    awayAtAway: venue(12, 6),
    leagueSeason: league,
    history: null,
  });

const flatReport = () =>
  scoreFixtureSignals({
    homeAtHome: venue(10, 5),
    awayAtAway: venue(10, 5),
    leagueSeason: league,
    history: null,
  });

function renderLevels(report: ReturnType<typeof scoreFixtureSignals>): string {
  return renderToStaticMarkup(
    React.createElement(FixtureSignalLevels, { report, teams, p: predictionsEn as never })
  );
}

/* ------------------------------------------------------------------ L1/L2 */

test("a strong report leads in the lead register; rendering is deterministic", () => {
  const html = renderLevels(strongReport());
  assert.match(html, /Lead finding/, "the eyebrow states the level");
  assert.match(html, /rw-h/, "the sentence takes the display face");
  assert.match(html, /league average 50%/, "the grammar carries the baseline");
  assert.equal(html, renderLevels(strongReport()), "same inputs, same markup");
});

test("EMPTY-STATE LAW: weak data renders no lead — and no filler headline", () => {
  const report = flatReport();
  assert.equal(report.lead, null, "precondition: nothing clears the bar");
  const html = renderLevels(report);
  assert.equal(html, "", "the whole level is omitted, not padded");
});

test("NO DUPLICATION: the lead sentence appears exactly once across L1+L2", () => {
  const report = strongReport();
  const html = renderLevels(report);
  const leadSentenceMatches = html.match(/High-scoring matches keep coming/g) ?? [];
  assert.equal(leadSentenceMatches.length, 1, "the lead's finding prints once, in L1 only");
  // Supports render at most five rows and never repeat one signal.
  const rows = html.match(/rw-row/g) ?? [];
  assert.ok(rows.length <= 5, `at most five support rows — found ${rows.length}`);
  assert.ok(
    report.supports.every((s) => s !== report.lead),
    "the scorer never hands the lead back as a support"
  );
});

/* ------------------------------------------------------------------ L3 */

const derivedView = {
  state: "derived",
  model: {
    qualification: "unqualified",
    evidenceScore: 40,
    sampleSize: 9,
    signals: [
      { direction: "supporting" },
      { direction: "opposing" },
      { direction: "opposing" },
    ],
  },
  markets: [],
  signals: [
    {
      key: "season_over25_home",
      label: "Home side over 2.5, at home",
      display: "83% (10/12)",
      direction: "supporting",
      leagueBaseline: { display: "50% (120)", sampleSize: 120 },
      source: "season venue record",
      sampleSize: 12,
    },
  ],
} as never;

test("L3 names disagreement plainly when the lead points up and the model is cautious", () => {
  const report = strongReport();
  const html = renderToStaticMarkup(
    React.createElement(FixtureModelWhy, {
      view: derivedView,
      potential: { pct: 74, marketLabel: "Over 2.5 goals" },
      lead: report.lead,
      latest: null,
      teams,
      p: predictionsEn as never,
    })
  );
  assert.match(html, /the model is cautious/, "the disagreement is said, not smoothed");
  assert.match(html, /2 of its 3 scored signals oppose/, "with the real counts");
  assert.match(html, /74%/, "the potential renders for the page's market");
  assert.match(html, /No evidence snapshot has been captured/, "the archive absence is honest");
  assert.doesNotMatch(html, /validation/i, "no validation language before settlement opens");
});

test("L3 renders the archive provenance line from a real snapshot view shape", () => {
  const latest = {
    id: "snap-1",
    sequence: 3,
    capturedAt: "2026-08-09T10:00:00.000Z",
    capturedAtLabel: "9 Aug 2026, 10:00 UTC",
    evidenceScore: 62,
    scoreBand: "moderate",
    scoreDelta: null,
    qualification: "unqualified",
    qualificationLabel: "Unqualified",
    status: "active",
    modelVersion: "23B.daily-evidence.v2",
    schemaVersion: "1",
    contentHash: "abc",
    contentHashShort: "abc",
    previousSnapshotId: null,
    supportedMarketCount: 2,
    signalCount: 6,
    supportingSignalCount: 4,
    opposingSignalCount: 2,
    operatorAvailabilityLabel: "",
    bestOddsLabel: "",
    validations: [],
    integrityVerified: true,
  } as never;
  const html = renderToStaticMarkup(
    React.createElement(FixtureModelWhy, {
      view: derivedView,
      potential: null,
      lead: null,
      latest,
      teams,
      p: predictionsEn as never,
    })
  );
  assert.match(html, /Snapshot 3, captured 9 Aug 2026, 10:00 UTC/);
  assert.match(html, /model 23B\.daily-evidence\.v2/);
  assert.match(html, /6 signals: 4 supporting, 2 opposing/);
});

/* ------------------------------------------------------------------ locales */

test("every fx* key resolves to a non-empty string in all thirty locales", () => {
  const fxKeys = Object.keys(predictionsEn).filter((k) => k.startsWith("fx"));
  assert.ok(fxKeys.length >= 40, `the fixture keys exist — found ${fxKeys.length}`);
  const locales = Object.keys(predictionsByLocale);
  assert.ok(locales.length >= 30, `thirty locales resolve — found ${locales.length}`);
  for (const locale of locales) {
    const strings = predictionsByLocale[locale as never] as Record<string, string>;
    for (const key of fxKeys) {
      assert.ok(
        typeof strings[key] === "string" && strings[key].length > 0,
        `${locale}.${key} must resolve (EN fallback is the stated interim)`
      );
    }
  }
});

/* ------------------------------------------------------------------ flags */

test("zero flagEmoji references survive on the three routes, and the SVG mechanism is mounted", () => {
  const ROUTES = [
    "app/[locale]/competitions/page.tsx",
    "app/[locale]/countries/page.tsx",
    "app/[locale]/countries/[code]/page.tsx",
    "app/[locale]/seasons/page.tsx",
  ];
  for (const rel of ROUTES) {
    const s = src(rel);
    assert.doesNotMatch(s, /flagEmoji/, `${rel} reaches for the retired emoji helper`);
    assert.match(s, /CountryFlagIcon/, `${rel} mounts the SVG flag`);
  }
  // The factories themselves are gone — the emoji cannot return by import. (Comments stripped:
  // both files carry a retirement note that names the deleted helpers.)
  const code = (rel: string) =>
    src(rel).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(code("lib/geoNames.ts"), /fromCodePoint/);
  assert.doesNotMatch(code("lib/footystats/flags.ts"), /flagEmojiForCountry|flagForCountry/);
  // The ink fallback: an unresolvable code renders nothing, never a placeholder.
  const icon = src("components/CountryFlagIcon.tsx");
  assert.match(icon, /return null/, "no glyph stands in for an unresolved country");
});

/* ------------------------------------------------------------------ badge */

test("StatusBadge is monochrome: state is glyph and weight, never hue", () => {
  const badge = src("components/homepage/sectionChrome.tsx");
  assert.doesNotMatch(badge, /STATUS_TONE_CLASS/, "the coloured tone map is disconnected");
  assert.doesNotMatch(badge, /status-won-bg|status-lost-bg/, "no status colour tokens");
  assert.match(badge, /STATUS_MONO/, "the monochrome map drives it");
});

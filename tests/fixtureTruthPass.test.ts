import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

/**
 * THE FIXTURE TRUTH PASS — ten content-integrity defects, each pinned to its live case.
 */

/* eslint-disable @typescript-eslint/no-var-requires */
(globalThis as { React?: unknown }).React = require("react");
const React = require("react") as typeof import("react");
const { renderToStaticMarkup } = require("react-dom/server") as typeof import("react-dom/server");

const {
  presentedNumbers,
  signalSentence,
} = require("../lib/fixtures/signalPresentation") as typeof import("../lib/fixtures/signalPresentation");
const {
  pairedDisplayString,
  rateSamplePaired,
} = require("../lib/fixtures/evidenceView") as typeof import("../lib/fixtures/evidenceView");
const { resolveMatchLifecycle } =
  require("../lib/fixtures/status") as typeof import("../lib/fixtures/status");
const { simplifyGptAnalysis } =
  require("../lib/footystats/matchDetail") as typeof import("../lib/footystats/matchDetail");
const { FixtureModelWhy } =
  require("../components/fixtures/FixtureModelWhy") as typeof import("../components/fixtures/FixtureModelWhy");
const { FixtureRecordSection } =
  require("../components/fixtures/FixtureRecordSection") as typeof import("../components/fixtures/FixtureRecordSection");
const { LocalTime } =
  require("../components/fixtures/LocalTime") as typeof import("../components/fixtures/LocalTime");
const { predictionsEn } =
  require("../lib/translations/predictionsEn") as typeof import("../lib/translations/predictionsEn");
const { predictionsByLocale } =
  require("../lib/translations/predictionsLocales") as typeof import("../lib/translations/predictionsLocales");

import type { FixtureSignal } from "../lib/fixtureSignals";

const root = process.cwd();
const src = (rel: string) => readFileSync(path.join(root, rel), "utf8");
const teams = { home: "Åsane", away: "Kongsvinger" };

function sig(partial: Partial<FixtureSignal>): FixtureSignal {
  return {
    market: "btts",
    direction: "below_baseline",
    count: 2,
    sample: 5,
    rate: 0.4,
    baseline: 0.61,
    scope: "recent_home",
    window: "last5",
    score: 0.1,
    level: "support",
    ...partial,
  };
}

/* ================================================================== *
 * 1 — the sentence direction law
 * ================================================================== */

test("LIVE CASE: the shut-out sentence counts shut-outs, not scoring matches", () => {
  // The shipped lie: "One side keeps getting shut out: 2 of ... (40%) — league average 61%."
  const s = signalSentence(sig({}), teams, predictionsEn);
  assert.match(s, /One side keeps getting shut out/);
  assert.match(s, /: 3 of /, "3 of 5 matches had a side shut out");
  assert.match(s, /\(60%\)/, "the complement rate");
  assert.match(s, /league average 39%/, "and the complement baseline");
  assert.doesNotMatch(s, /2 of |40%|61%/, "the scoring-side numbers are gone from this claim");
});

test("every template × direction prints the count of the claimed event", () => {
  /*
   * Polarity table: which down-templates claim the COMPLEMENT event. Up-templates and the
   * direct down-templates print measured numbers; complement templates print inverted ones.
   */
  const COMPLEMENT_DOWN = new Set(["fh05", "sh05", "btts"]);
  const markets = [
    "over15",
    "over25",
    "over35",
    "fh05",
    "sh05",
    "btts",
    "cleanSheets",
    "failedToScore",
  ] as const;
  for (const market of markets) {
    // Above baseline: always direct.
    const up = presentedNumbers(
      sig({ market, direction: "above_baseline", count: 4, sample: 5, rate: 0.8, baseline: 0.5 })
    );
    assert.deepEqual(
      { count: up.count, rate: up.rate },
      { count: 4, rate: 0.8 },
      `${market} up prints measured numbers`
    );
    // Below baseline: inverted exactly when the template claims the complement.
    const down = presentedNumbers(
      sig({ market, direction: "below_baseline", count: 2, sample: 5, rate: 0.4, baseline: 0.61 })
    );
    if (COMPLEMENT_DOWN.has(market)) {
      assert.deepEqual(
        { count: down.count, rate: down.rate, baseline: down.baseline },
        { count: 3, rate: 0.6, baseline: 0.39 },
        `${market} down claims the complement and inverts with it`
      );
    } else {
      assert.deepEqual(
        { count: down.count, rate: down.rate, baseline: down.baseline },
        { count: 2, rate: 0.4, baseline: 0.61 },
        `${market} down phrases the same event as rare — measured numbers stand`
      );
    }
  }
});

test("locale audit holds: every down-template keeps its key's polarity in all locales", () => {
  /*
   * The invert flag is keyed to the KEY, so it is safe only if no locale flipped a phrasing's
   * polarity. Sampled structurally: complement-down templates never contain the market's own
   * "keeps coming" phrasing — asserted here for the three complement keys across all locales by
   * checking they differ from the corresponding Up template (a locale that reused the Up
   * sentence for Down would silently break polarity).
   */
  for (const [locale, strings] of Object.entries(predictionsByLocale)) {
    const p = strings as Record<string, string>;
    for (const key of ["fxFindingFh05", "fxFindingSh05", "fxFindingBtts"]) {
      assert.notEqual(p[`${key}Up`], p[`${key}Down`], `${locale}.${key} up/down must differ`);
    }
  }
});

/* ================================================================== *
 * 2 — provider figure demotion
 * ================================================================== */

const emptyView = { state: "no_data", reason: "no_venue_data", homePlayed: 0, awayPlayed: 0 } as never;

function renderWhy(props: Partial<Record<string, unknown>>): string {
  return renderToStaticMarkup(
    React.createElement(FixtureModelWhy, {
      view: emptyView,
      potential: null,
      lead: null,
      latest: null,
      teams,
      p: predictionsEn as never,
      ...props,
    } as never)
  );
}

test("the provider figure renders text-size under its own label, never the display register", () => {
  const withFigure = renderWhy({ potential: { pct: 100, marketLabel: "Over 1.5 goals" } });
  assert.match(withFigure, /Provider figure/, "the provider label heads the number");
  const figureBlock = withFigure.slice(0, withFigure.indexOf("fx-model-heading"));
  assert.doesNotMatch(figureBlock, /rw-h |rw-h"/, "no display register on a provider figure");
  assert.doesNotMatch(figureBlock, /clamp\(/, "no display clamp either");
  assert.ok(
    withFigure.indexOf("Provider figure") < withFigure.indexOf('id="fx-model-heading"'),
    "and it does not sit under the model heading"
  );

  const without = renderWhy({});
  assert.doesNotMatch(without, /Provider figure/, "no figure, no provider block — both states hold");
  assert.match(without, /id="fx-model-heading"/, "the model heading survives alone");
});

/* ================================================================== *
 * 3 — window labeling
 * ================================================================== */

test("every rate block names its window", () => {
  assert.match(predictionsEn.fxRateHomeSeason, /this season/);
  assert.match(predictionsEn.fxWhyWindowNote, /season/);
  const research = src("components/fixtures/FixtureResearchSection.tsx");
  assert.match(research, /fxRateHomeSeason/, "the market table labels are windowed dict strings");
  assert.doesNotMatch(research, /"Home side, at home"/, "the unwindowed label is gone");
  const why = src("components/fixtures/FixtureModelWhy.tsx");
  assert.match(why, /fxWhyWindowNote/, "the Why table states its window");
});

/* ================================================================== *
 * 4 — one clock
 * ================================================================== */

test("LocalTime SSR emits explicit UTC; the header renders through it", () => {
  const html = renderToStaticMarkup(
    React.createElement(LocalTime, { iso: "2026-08-09T18:00:00.000Z", locale: "en" })
  );
  assert.match(html, /UTC/, "the server pass is explicit UTC, honest without JavaScript");
  const view = src("components/fixtures/MatchDetailView.tsx");
  assert.match(view, /<LocalTime iso=\{header\.kickoffAt\}/, "kickoff renders on the one clock");
  assert.match(view, /<LocalTime iso=\{header\.lastUpdatedAt\}/, "so does the update stamp");
  assert.doesNotMatch(view, /toLocaleString/, "no server-zone rendering remains in the view");
});

/* ================================================================== *
 * 5 — publication freeze at kickoff
 * ================================================================== */

test("an after-kickoff row is labeled honestly and excluded from settlement", () => {
  const row = {
    id: "1-over25",
    marketKey: "over25",
    marketLabel: "Over 2.5 goals",
    selection: "Over 2.5 goals",
    confidence: 80,
    publishedAt: "2026-08-09T19:44:00.000Z",
    originalOdds: 1.09,
    currentOdds: 1.09,
    status: "void",
    unitProfit: null,
    settlementReason: predictionsEn.fxRecordAfterKickoff,
    evidenceSummary: [],
    timeline: [],
    capturedAfterKickoff: true,
  } as never;
  const html = renderToStaticMarkup(
    React.createElement(FixtureRecordSection, { predictions: [row] })
  );
  assert.match(html, /Observed \(after kickoff\)/, "not presented as a publication");
  assert.match(html, /Odds observed \(after kickoff\)/, "the 1.09 is not odds-at-publication");
  assert.match(html, /Captured after kickoff — excluded from settlement\./);
  assert.doesNotMatch(html, /Odds at publication/, "the publication label is gone from this row");

  // The mint itself: builds at/after kickoff mark the row and never call settlement on it.
  const loader = src("lib/fixtures/loadMatchPage.server.ts");
  assert.match(loader, /buildMs >= kickoffMs/, "the freeze is a property of the build time");
  assert.match(
    loader,
    /capturedAfterKickoff\s*\?\s*\{\s*status: "void" as const,\s*reason: p\.fxRecordAfterKickoff/,
    "settlement is bypassed, not computed and discarded"
  );
});

/* ================================================================== *
 * 6 — the garbled evidence line
 * ================================================================== */

test("a mid-sentence fragment never ships as analysis", () => {
  // The live case, embedded where the provider text parser would lift it.
  const garbled = simplifyGptAnalysis(
    "Prediction: 45 to win, with Åsane at 4.\nSome supporting context line that is long enough."
  );
  assert.ok(
    !garbled || !garbled.expectation.includes("45 to win"),
    "the sheared odds fragment is dropped, not shipped"
  );
});

/* ================================================================== *
 * 7 — small truths
 * ================================================================== */

test("unmeasured statistics omit; one affiliate block; the meter needs a price", () => {
  const loader = src("lib/fixtures/loadMatchPage.server.ts");
  assert.match(
    loader,
    /if \(!measured && \(home \?\? 0\) === 0 && \(away \?\? 0\) === 0\)/,
    "an unmeasured 0–0 row is an absence, not a measurement"
  );

  const l5 = src("components/fixtures/FixtureOperatorsSection.tsx");
  assert.doesNotMatch(l5, /signedOffers/, "the duplicate offers list is gone — one affiliate block");

  const cards = src("components/operators/OperatorEvidenceCard.tsx");
  assert.match(cards, /anyPriceObserved/, "the meter is gated on an observed price in the set");
  assert.match(cards, /showScore \? \(/, "and omitted whole when none exists");
});

/* ================================================================== *
 * 8 — the live score path
 * ================================================================== */

test("a recorded live-shaped payload resolves live; no-evidence stays honest", () => {
  const now = 1_754_760_000; // fixed clock
  // The live failure: provider status the map does not know, kickoff passed, minute + score live.
  assert.equal(
    resolveMatchLifecycle({ status: "incomplete", kickoffUnix: now - 3600, minute: 57, nowSec: now }),
    "live",
    "an in-play minute is live evidence, not an invention"
  );
  // No minute, unclear status: the refusal to fake live stands.
  assert.equal(
    resolveMatchLifecycle({ status: "incomplete", kickoffUnix: now - 3600, minute: null, nowSec: now }),
    "unavailable"
  );
  // A minute before kickoff proves nothing.
  assert.equal(
    resolveMatchLifecycle({ status: "incomplete", kickoffUnix: now + 3600, minute: 57, nowSec: now }),
    "pre_match"
  );
  // Finished stays finished even with a minute attached.
  assert.equal(
    resolveMatchLifecycle({ status: "ft", kickoffUnix: now - 8000, minute: 90, nowSec: now }),
    "finished"
  );
  // And the genuinely-unavailable state now says so honestly, per competition.
  assert.match(src("components/fixtures/MatchDetailView.tsx"), /fxLiveUnavailable/);
});

/* ================================================================== *
 * 9 — rate/sample pairing integrity
 * ================================================================== */

test("LIVE CASE: 57% beside 4/11 degrades to a provider figure; true pairs survive", () => {
  assert.equal(pairedDisplayString("57% (4/11)"), "57%", "the hybrid is dismantled");
  assert.equal(pairedDisplayString("82% (9/11)"), "82% (9/11)", "a true pair is untouched");
  assert.equal(pairedDisplayString("80% (7/9)"), "80% (7/9)", "reverse-rounded pairs pass");
  assert.equal(pairedDisplayString("76% (240)"), "76% (240)", "single denominators carry no fraction");
  assert.equal(rateSamplePaired(57, 4, 11), false);
  assert.equal(rateSamplePaired(36, 4, 11), true);
});

test("every rendered pair satisfies X = round(100·a/b) within half an observation", () => {
  for (let played = 1; played <= 40; played++) {
    for (let hits = 0; hits <= played; hits++) {
      const pct = Math.round((hits / played) * 100);
      assert.ok(
        rateSamplePaired(pct, hits, played),
        `a genuinely computed ${pct}% (${hits}/${played}) must always pass`
      );
    }
  }
});

/* ================================================================== *
 * 10 — signal-count consistency
 * ================================================================== */

test("with a snapshot present, every counting sentence draws the snapshot's counts", () => {
  const latest = {
    sequence: 3,
    capturedAtLabel: "9 Aug 2026, 10:00 UTC",
    modelVersion: "23B.daily-evidence.v2",
    evidenceScore: 62,
    signalCount: 2,
    supportingSignalCount: 1,
    opposingSignalCount: 1,
  } as never;
  const liveView = {
    state: "derived",
    model: {
      qualification: "unqualified",
      evidenceScore: 40,
      sampleSize: 9,
      signals: new Array(8).fill(0).map((_, i) => ({
        direction: i === 0 ? "supporting" : i < 3 ? "opposing" : "neutral",
      })),
    },
    markets: [],
    signals: [],
  } as never;
  const html = renderToStaticMarkup(
    React.createElement(FixtureModelWhy, {
      view: liveView,
      potential: null,
      lead: sig({ direction: "above_baseline", rate: 0.8, baseline: 0.5, count: 4 }),
      latest,
      teams,
      p: predictionsEn as never,
    } as never)
  );
  assert.match(html, /1 of its 2 scored signals oppose/, "the caution counts the snapshot layer");
  assert.match(html, /2 signals: 1 supporting, 1 opposing/, "the archive line agrees");
  assert.doesNotMatch(html, /\b8 /, "the live derivation's 8 never leaks into a counting sentence");
});

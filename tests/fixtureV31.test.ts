import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";

/**
 * FIXTURE v3.1 — THE PROBE SWEEP (design/v3/match-v31.pdf, adapted to real
 * data). Each law the five layers stand on, held to account at source and
 * render level:
 *
 *   · ONE >18px text on the whole fixture route — the verdict number, 34px,
 *     nothing else (the single sanctioned exception to Bible V3's cap).
 *   · sample-strength TIERS, and the word is never "confidence".
 *   · standings fields absent — the DECIDED rule has no leak.
 *   · the model view speaks ONLY through the template registry.
 *   · the deviation bar's thin marker IS the league average.
 *   · rows beyond three fold with the true count, inline, no navigation.
 *   · the matrix outlines the market's TOP price (highest decimal — the
 *     DECIDED max), renders "—" for no observation, never a fake price,
 *     and carries at most ONE Best badge.
 *   · the offer of the day renders once; v3.1 adds no second filled CTA.
 *   · the ellipsis stays banned.
 */

/* eslint-disable @typescript-eslint/no-var-requires */
(globalThis as { React?: unknown }).React = require("react");
const React = require("react") as typeof import("react");
const { renderToStaticMarkup } = require("react-dom/server") as typeof import("react-dom/server");

const { sampleStrengthTier, deviationFor, h2hAnalysis } =
  require("../lib/fixtures/v31") as typeof import("../lib/fixtures/v31");
const { MODEL_TEMPLATES, modelSentences } =
  require("../lib/fixtures/v31Model") as typeof import("../lib/fixtures/v31Model");
const { EvidenceRows } =
  require("../components/fixtures/v31/EvidenceRows") as typeof import("../components/fixtures/v31/EvidenceRows");
const { OperatorsMatrix } =
  require("../components/fixtures/v31/OperatorsMatrix") as typeof import("../components/fixtures/v31/OperatorsMatrix");
const { predictionsEn } =
  require("../lib/translations/predictionsEn") as typeof import("../lib/translations/predictionsEn");

import type { FixtureSignal } from "../lib/fixtureSignals";
import type { HistoricalMatch } from "../lib/footystats/matchDetail";

const root = process.cwd();
const SRC = (rel: string) => readFileSync(path.join(root, rel), "utf8");

/** The vocabulary probes judge CODE, not commentary — comments off first. */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

/** Every source the fixture route composes — the probe's jurisdiction. */
function fixtureRouteSources(): Array<{ file: string; text: string }> {
  const files = [
    ...walk(path.join(root, "components/fixtures")),
    ...walk(path.join(root, "app/[locale]/fixtures")),
  ];
  return files.map((file) => ({ file: path.relative(root, file), text: readFileSync(file, "utf8") }));
}

/* ── fixtures ──────────────────────────────────────────────────────────── */

function signal(overrides: Partial<FixtureSignal> = {}): FixtureSignal {
  return {
    market: "over25",
    direction: "above_baseline",
    count: 9,
    sample: 12,
    rate: 0.75,
    baseline: 0.5,
    scope: "home_venue",
    window: "season",
    score: 0.18,
    level: "support",
    ...overrides,
  } as FixtureSignal;
}

function meeting(id: number, year: number, home: number, away: number): HistoricalMatch {
  return {
    id,
    kickoffAt: `${year}-05-01T15:00:00.000Z`,
    home: { name: "Alpha FC", score: home },
    away: { name: "Beta United", score: away },
  };
}

const teams = { home: "Alpha FC", away: "Beta United" };

/* ── the one display number ────────────────────────────────────────────── */

test("ONE >18px text on the fixture route — the 34px verdict number, nothing else", () => {
  const offenders: string[] = [];
  for (const { file, text } of fixtureRouteSources()) {
    for (const match of text.matchAll(/fontSize: ?(\d+)|text-\[(\d+)px\]/g)) {
      const px = Number(match[1] ?? match[2]);
      if (px > 18) offenders.push(`${file}: ${px}px`);
    }
  }
  assert.deepEqual(
    offenders,
    ["components/fixtures/v31/VerdictBlock.tsx: 34px"],
    "the sanctioned exception is exactly one 34px number in the verdict"
  );
  assert.match(
    SRC("components/fixtures/v31/VerdictBlock.tsx"),
    /data-fx31-verdict-number=""\s*\n?\s*style=\{\{ fontSize: 34/,
    "and it is the verdict number itself"
  );
});

/* ── sample strength ───────────────────────────────────────────────────── */

test("sample-strength tiers: <5:1 · 5–9:2 · 10–14:3 · 15–24:4 · 25+:5", () => {
  const expect: Array<[number, number]> = [
    [0, 1], [4, 1], [5, 2], [9, 2], [10, 3], [14, 3], [15, 4], [24, 4], [25, 5], [60, 5],
  ];
  for (const [n, tier] of expect) assert.equal(sampleStrengthTier(n), tier, `n=${n}`);
});

test('the vocabulary is SIZE, never belief — no "confidence" anywhere in v3.1', () => {
  assert.doesNotMatch(predictionsEn.v3SampleStrength, /confiden/i);
  for (const file of walk(path.join(root, "components/fixtures/v31"))) {
    assert.doesNotMatch(
      stripComments(readFileSync(file, "utf8")),
      /confiden/i,
      `${path.relative(root, file)} speaks belief`
    );
  }
});

/* ── the DECIDED no-standings rule ─────────────────────────────────────── */

test("standings fields are ABSENT from the fixture route — no rank, points or round", () => {
  for (const { file, text } of fixtureRouteSources()) {
    assert.doesNotMatch(
      stripComments(text),
      /standings|leaguePosition|league_position/i,
      `${file} leaks standings`
    );
  }
});

/* ── the template registry ─────────────────────────────────────────────── */

test("the model view speaks only through the registry — omission over interpolation", () => {
  const inputs = {
    homeTeam: "Alpha FC",
    awayTeam: "Beta United",
    homeVenue: {
      played: 12,
      over15: { hits: 9, played: 12, pct: 75 },
      over25: { hits: 7, played: 12, pct: 58 },
      over35: { hits: 3, played: 12, pct: 25 },
      fh05: { hits: 8, played: 12, pct: 67 },
      sh05: { hits: 9, played: 12, pct: 75 },
      btts: { hits: 6, played: 12, pct: 50 },
      cleanSheets: { hits: 4, played: 12, pct: 33 },
      failedToScore: { hits: 2, played: 12, pct: 17 },
      scoredAvg: 1.6,
      concededAvg: 1.1,
    },
    leagueAvgGoals: 2.7,
    homeWinRecord: { wins: 7, n: 12 },
  };
  const sentences = modelSentences(inputs as never, predictionsEn);
  assert.ok(sentences.length >= 2 && sentences.length <= 4, "2–4 sentences");
  const registryKeys = MODEL_TEMPLATES.map((t) => t.key as string);
  for (const sentence of sentences) {
    assert.ok(registryKeys.includes(sentence.key), `${sentence.key} is not registered`);
  }
  // A missing input silences its template — never a guessed number.
  const withoutVenue = modelSentences({ ...inputs, homeVenue: undefined } as never, predictionsEn);
  assert.ok(!withoutVenue.some((s) => s.key === "v3TplHomeGoals"), "no venue, no venue sentence");
  assert.ok(!withoutVenue.some((s) => s.key === "v3TplEarlyGoals"), "no venue, no early-goal sentence");
  // Below two sentences the section is omitted WHOLE.
  assert.deepEqual(
    modelSentences({ homeTeam: "A", awayTeam: "B", leagueAvgGoals: 2.7 } as never, predictionsEn),
    [],
    "one sentence is not a model view"
  );
  // No template computes a league rank, so none may utter one.
  assert.doesNotMatch(stripComments(SRC("lib/fixtures/v31Model.ts")), /rank/i);
  // And the renderer prints registry sentences only — each stamped with its key.
  const view = SRC("components/fixtures/v31/HistoryModelView.tsx");
  assert.match(view, /modelSentences\(inputs, p\)/, "sentences come from the registry call");
  assert.match(view, /data-fx31-template=\{sentence\.key\}/, "each sentence is stamped");
});

/* ── the deviation bar's marker ────────────────────────────────────────── */

test("the deviation bar's thin marker IS the league average — presented space", () => {
  const up = deviationFor(signal());
  assert.ok(up);
  assert.equal(up.baselinePct, 50);
  assert.equal(up.pp, 25);
  assert.equal(up.favors, true);
  // A NON-inverting down claim ("Over 2.5 lands rarely") states the low rate
  // itself: presented pp is negative, and the negative deviation FAVORS it.
  const downPlain = deviationFor(
    signal({ direction: "below_baseline", rate: 0.25, baseline: 0.5, count: 3 })
  );
  assert.ok(downPlain);
  assert.equal(downPlain.baselinePct, 50);
  assert.equal(downPlain.pp, -25, "the number agrees with the sentence");
  assert.equal(downPlain.favors, true, "below the line favors the rarity claim");
  // An INVERTING down claim (fh05 → "first halves start quiet") flips rate
  // and baseline together, so its favoring deviation reads positive.
  const downInverted = deviationFor(
    signal({ market: "fh05", direction: "below_baseline", rate: 0.2, baseline: 0.55, count: 2 })
  );
  assert.ok(downInverted);
  assert.equal(downInverted.baselinePct, 45, "1 − 0.55 presents as 45");
  assert.equal(downInverted.pp, 35, "80% as phrased vs 45%");
  assert.equal(downInverted.favors, true);
  // Defensive: a deviation AGAINST the claim's direction is never green.
  const against = deviationFor(signal({ rate: 0.4, baseline: 0.5 }));
  assert.ok(against);
  assert.equal(against.favors, false);
  // No baseline → no deviation object, never a stand-in.
  assert.equal(deviationFor(signal({ baseline: null })), null);
  // And the render pins the marker to that number.
  const html = renderToStaticMarkup(
    React.createElement(EvidenceRows, { supports: [signal()], teams, p: predictionsEn as never })
  );
  assert.match(html, /data-fx31-baseline-marker="50"/, "the marker carries the league average");
});

/* ── the fold ──────────────────────────────────────────────────────────── */

test("rows beyond three fold with the TRUE count — inline, no navigation", () => {
  const five = [
    signal({ market: "over25", scope: "home_venue" }),
    signal({ market: "over15", scope: "away_venue" }),
    signal({ market: "fh05", scope: "home_venue" }),
    signal({ market: "sh05", scope: "away_venue" }),
    signal({ market: "btts", scope: "home_venue" }),
  ];
  const html = renderToStaticMarkup(
    React.createElement(EvidenceRows, { supports: five, teams, p: predictionsEn as never })
  );
  assert.match(html, /2 more signals/, "the count is the fold's own");
  assert.match(html, /<details/, "the fold is a <details> — inline, no JS, no navigation");
  assert.doesNotMatch(html, /<a [^>]*href="\/(?!.*#)/, "no navigation link inside the fold");
  const three = renderToStaticMarkup(
    React.createElement(EvidenceRows, { supports: five.slice(0, 3), teams, p: predictionsEn as never })
  );
  assert.doesNotMatch(three, /<details/, "three rows need no fold");
});

/* ── the H2H gate ──────────────────────────────────────────────────────── */

test("H2H below three meetings is an anecdote — the analysis refuses it", () => {
  assert.equal(h2hAnalysis([meeting(1, 2024, 2, 1), meeting(2, 2023, 0, 0)], "Alpha FC"), null);
  const three = h2hAnalysis(
    [meeting(1, 2026, 2, 1), meeting(2, 2024, 1, 1), meeting(3, 2021, 0, 2)],
    "Alpha FC"
  );
  assert.ok(three);
  assert.equal(three.meetings, 3);
  assert.equal(three.wins + three.draws + three.losses, 3);
  assert.equal(three.yearFrom, 2021);
  assert.equal(three.yearTo, 2026);
  assert.equal(three.smallSample, true, "under five wears the small-sample word");
});

/* ── the operators × markets matrix ────────────────────────────────────── */

const matrixPrices = {
  over25: [
    { operatorSlug: "alphabet", operatorName: "AlphaBet", verified: true, available: true, decimal: 1.95, observedAt: "2026-09-10T10:00:00.000Z", continueHref: "/go/alphabet?x=1" },
    { operatorSlug: "betabook", operatorName: "BetaBook", verified: false, available: true, decimal: 2.1, observedAt: "2026-09-10T10:00:00.000Z", continueHref: null },
  ],
  fh: [
    { operatorSlug: "alphabet", operatorName: "AlphaBet", verified: true, available: true, decimal: 1.4, observedAt: "2026-09-10T10:00:00.000Z", continueHref: "/go/alphabet?x=2" },
  ],
};

function renderMatrix(): string {
  return renderToStaticMarkup(
    React.createElement(OperatorsMatrix, {
      prices: matrixPrices as never,
      operatorLogos: { alphabet: null, betabook: null },
      p: predictionsEn as never,
    })
  );
}

test("the matrix outlines the TOP price per market (highest decimal — the DECIDED max)", () => {
  const html = renderMatrix();
  const outlined = html.match(/data-fx31-top-price/g) ?? [];
  // Two observed markets in the table + the same two rows outlined in the
  // mobile accordion's own list would double-count — the accordion styles
  // inline instead, so the stamped cells are the table's alone.
  assert.equal(outlined.length, 2, "one top price per observed market");
  assert.match(html, /2\.10/, "over25's top is the HIGHEST decimal, 2.10");
  // BetaBook holds over25's best without a link — the outline must not imply one.
  assert.match(html, /<span[^>]*data-fx31-top-price[^>]*>2\.10/, "an unlinked top price outlines a span");
});

test('the matrix says "—" for no observation and never invents a price', () => {
  const html = renderMatrix();
  assert.match(html, />—</, "the muted dash is the whole statement");
  assert.match(html, new RegExp(predictionsEn.v3NoObservation), "and it names itself honestly");
  // BetaBook was never observed on fh — no number may appear for it there.
  const betabookRow = html.slice(html.indexOf("BetaBook"), html.indexOf("</tr>", html.indexOf("BetaBook")));
  assert.doesNotMatch(betabookRow, /1\.40/, "another operator's price never fills the gap");
});

test("at most ONE Best badge in the whole matrix", () => {
  const html = renderMatrix();
  const badges = html.match(new RegExp(`>${predictionsEn.v3Best}<`, "g")) ?? [];
  assert.equal(badges.length, 1, "one Best, table-wide");
});

test("every matrix link is a sponsored ghost — no filled CTA enters layer 5", () => {
  const html = renderMatrix();
  for (const anchor of html.match(/<a [^>]+>/g) ?? []) {
    assert.match(anchor, /rel="nofollow sponsored noopener"/, `unmarked commercial link: ${anchor}`);
    assert.match(anchor, /rw3-ghost/, `a non-ghost affordance: ${anchor}`);
  }
  assert.doesNotMatch(html, /rw3-filled/, "the offer of the day stays the page's only filled CTA");
});

/* ── the offer renders once; the ellipsis stays banned ─────────────────── */

test("the offer of the day renders once on the fixture page — and nowhere in v3.1's layers", () => {
  const view = SRC("components/fixtures/MatchDetailView.tsx");
  const renders = view.match(/<OfferOfTheDayCard/g) ?? [];
  assert.equal(renders.length, 1, "one curated slot, one card");
  for (const file of walk(path.join(root, "components/fixtures/v31"))) {
    const text = readFileSync(file, "utf8");
    assert.doesNotMatch(text, /OfferOfTheDay|rw3-filled/, `${path.relative(root, file)} grew a second offer`);
  }
});

test("the ellipsis ban holds across v3.1", () => {
  for (const file of walk(path.join(root, "components/fixtures/v31"))) {
    const text = readFileSync(file, "utf8");
    assert.doesNotMatch(text, /…|textOverflow|text-ellipsis|line-clamp/, `${path.relative(root, file)} truncates`);
  }
});

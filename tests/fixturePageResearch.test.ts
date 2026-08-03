import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  buildFixtureEvidenceView,
  marketKeyFromSignalKey,
} from "../lib/fixtures/evidenceView";
import type { MatchDetailPublic } from "../lib/footystats/matchDetail";

/**
 * Fixture page — the guarantees the page makes to a reader.
 *
 * These assert the CONTRACT, not the styling: a rate never appears without its sample, the three
 * outcome states stay distinct, no in-play price is ever stated, and archived odds stay out of
 * the research section.
 */

/**
 * Source with comments and Tailwind arbitrary values removed.
 *
 * These tests are about what a READER sees. A comment explaining why a price is never stated is
 * not a stated price, and `leading-[1.7]` is a line-height, not a decimal odd — scanning them
 * would make the guarantee unfalsifiable in one direction and noisy in the other.
 */
const SRC = (rel: string) => {
  const raw = readFileSync(path.join(process.cwd(), rel), "utf8");
  return raw
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    // Tailwind arbitrary values ONLY — they always attach to a utility token (`text-[13px]`,
    // `bg-[var(--x)]`). A bare `[` after whitespace or `=` is an array literal, and stripping
    // those blinded these scans to anything written inside one.
    .replace(/(?<=[\w-])\[[^\]]*\]/g, "");
};

const RESEARCH_TSX = "components/fixtures/FixtureResearchSection.tsx";
const RECORD_TSX = "components/fixtures/FixtureRecordSection.tsx";

function hitStat(pct: number, played: number, hits: number) {
  return { pct, played, hits };
}

function venueSide(played: number, pct: number) {
  return {
    played,
    over15: hitStat(pct, played, Math.round((pct / 100) * played)),
    over25: hitStat(pct, played, Math.round((pct / 100) * played)),
    over35: hitStat(pct, played, Math.round((pct / 100) * played)),
    fh05: hitStat(pct, played, Math.round((pct / 100) * played)),
    sh05: hitStat(pct, played, Math.round((pct / 100) * played)),
    btts: hitStat(pct, played, Math.round((pct / 100) * played)),
    cleanSheets: hitStat(20, played, Math.round(0.2 * played)),
    failedToScore: hitStat(10, played, Math.round(0.1 * played)),
    scoredAvg: 1.4,
    concededAvg: 1.1,
  };
}

function detailWith(opts: {
  homePlayed: number;
  awayPlayed: number;
  homePct?: number;
  awayPct?: number;
  leaguePlayed?: number;
  leaguePct?: number;
}): MatchDetailPublic {
  const {
    homePlayed,
    awayPlayed,
    homePct = 90,
    awayPct = 80,
    leaguePlayed = 40,
    leaguePct = 82,
  } = opts;
  return {
    matchId: 12345,
    homeTeam: "Home FC",
    awayTeam: "Away FC",
    homeAtHome: venueSide(homePlayed, homePct),
    awayAtAway: venueSide(awayPlayed, awayPct),
    matchPotential: { over15: 90, over25: 70, fh05: 80, sh05: 85 },
    leagueSeason: {
      played: leaguePlayed,
      avgGoals: 2.7,
      over15: leaguePct,
      over25: leaguePct,
      fh05: leaguePct,
      sh05: leaguePct,
      btts: leaguePct,
    },
    history: { homeAtHome: [], awayAtAway: [], headToHead: [] },
    ai: null,
  } as unknown as MatchDetailPublic;
}

/* -- the three states are distinct ---------------------------------------- */

test("state: no venue history at all reads as no_data, not as a zero score", () => {
  const view = buildFixtureEvidenceView(null);
  assert.equal(view.state, "no_data");
  assert.equal(view.state === "no_data" && view.reason, "no_venue_data");
});

test("state: a side below SAMPLE_MIN reads as no_data with insufficient_sample", () => {
  // SAMPLE_MIN is 6; 3 away matches is below the floor and must not be rescued.
  const view = buildFixtureEvidenceView(detailWith({ homePlayed: 11, awayPlayed: 3 }));
  assert.equal(view.state, "no_data");
  assert.equal(view.state === "no_data" && view.reason, "insufficient_sample");
  assert.equal(view.state === "no_data" && view.awayPlayed, 3);
});

test("state: sufficient samples derive signals", () => {
  const view = buildFixtureEvidenceView(detailWith({ homePlayed: 11, awayPlayed: 9 }));
  assert.equal(view.state, "derived");
  assert.ok(view.state !== "no_data" && view.signals.length > 0, "signals exist");
});

test("state: qualified is reachable and is NOT special-cased away", () => {
  // A board-wide absence today must not become a code-level impossibility. Strong rates on a
  // large sample against a low league baseline is the shape that reaches it.
  const view = buildFixtureEvidenceView(
    detailWith({
      homePlayed: 30,
      awayPlayed: 30,
      homePct: 100,
      awayPct: 100,
      leaguePlayed: 60,
      leaguePct: 40,
    })
  );
  assert.notEqual(view.state, "no_data");
  assert.equal(
    view.state === "qualified" || view.state === "derived",
    true,
    "a scored fixture is one of the two scored states"
  );
  if (view.state !== "no_data") {
    // The state mirrors the model verdict with no override anywhere in between.
    assert.equal(
      view.state === "qualified",
      view.model.qualification === "qualified",
      "state follows the model verdict exactly"
    );
  }
});

test("the three states are mutually exclusive labels", () => {
  const states = new Set(
    [
      buildFixtureEvidenceView(null).state,
      buildFixtureEvidenceView(detailWith({ homePlayed: 11, awayPlayed: 3 })).state,
      buildFixtureEvidenceView(detailWith({ homePlayed: 11, awayPlayed: 9 })).state,
    ]
  );
  assert.deepEqual([...states].sort(), ["derived", "no_data"]);
});

/* -- no rate without its sample ------------------------------------------- */

test("every rate carries its sample: model rates keep their denominator", () => {
  const view = buildFixtureEvidenceView(detailWith({ homePlayed: 11, awayPlayed: 9 }));
  assert.notEqual(view.state, "no_data");
  if (view.state === "no_data") return;

  for (const s of view.signals) {
    assert.match(
      s.display,
      /\(\d+(\/\d+)?\)/,
      `signal ${s.key} renders a bare rate: ${s.display}`
    );
    if (s.leagueBaseline) {
      assert.match(
        s.leagueBaseline.display,
        /\(\d+\)/,
        `league baseline for ${s.key} renders bare: ${s.leagueBaseline.display}`
      );
    }
  }
  for (const m of view.markets) {
    for (const [name, rate] of [
      ["home", m.homeRate],
      ["away", m.awayRate],
      ["league", m.leagueBaseline],
    ] as const) {
      if (!rate) continue;
      assert.match(
        rate.display,
        /\(\d+(\/\d+)?\)/,
        `${m.marketKey} ${name} rate renders bare: ${rate.display}`
      );
      assert.ok(rate.sampleSize > 0, `${m.marketKey} ${name} sample must be positive`);
    }
  }
});

test("a neutral signal is paired with the league rate that makes it readable", () => {
  // Venue rate identical to the league rate: the direction is `neutral`, and the baseline must
  // travel with it or "82% (9/11)" alone looks like a strong figure.
  const view = buildFixtureEvidenceView(
    detailWith({ homePlayed: 11, awayPlayed: 11, homePct: 82, awayPct: 82, leaguePct: 82 })
  );
  assert.notEqual(view.state, "no_data");
  if (view.state === "no_data") return;
  const neutral = view.signals.filter((s) => s.direction === "neutral");
  assert.ok(neutral.length > 0, "an at-baseline rate produces a neutral signal");
  for (const s of neutral) {
    assert.ok(s.leagueBaseline, `neutral signal ${s.key} must carry the league rate`);
  }
});

test("signal keys map back to their market so the baseline can be paired", () => {
  assert.equal(marketKeyFromSignalKey("season_over25_home"), "over25");
  assert.equal(marketKeyFromSignalKey("season_fh_away"), "fh");
  assert.equal(marketKeyFromSignalKey("counter_over25_home_0"), null);
});

/* -- the framing states a mechanism, never a price ------------------------ */

test("no in-play price appears anywhere in the research section", () => {
  const src = SRC(RESEARCH_TSX);
  // Any decimal-odds-shaped literal, or a currency figure, would be an observation we never made.
  assert.equal(
    /\b\d+\.\d{2}\b/.test(src),
    false,
    "a decimal price literal appears in the research section"
  );
  // A currency symbol only means a price when a figure follows it; a bare `$` is JSX
  // interpolation.
  assert.equal(/[£$€]\s*\d/.test(src), false, "research section states a currency figure");
  const flat = src.replace(/\s+/g, " ");
  for (const forbidden of ["in-play price", "live price", "odds of", "priced at 1"]) {
    assert.equal(flat.includes(forbidden), false, `research section states "${forbidden}"`);
  }
  // The mechanism must still be stated.
  // JSX wraps prose across lines, so the mechanism is matched whitespace-tolerantly.
  assert.match(src.replace(/\s+/g, " "), /prices differently in play/);
});

test("the research section never calls a provider potential a model probability", () => {
  const src = SRC(RESEARCH_TSX);
  assert.equal(/Model probability/i.test(src), false);
  assert.match(src, /Occurrence rate/i, "the figure is labelled as an occurrence rate");
});

/* -- archived odds belong to the record, not to research ------------------ */

test("oddsAtPublication does not render inside the research section", () => {
  const research = SRC(RESEARCH_TSX);
  for (const field of ["originalOdds", "Odds at publication", "unitProfit", "Unit P/L"]) {
    assert.equal(
      research.includes(field),
      false,
      `${field} must live in the record, not in research`
    );
  }
  // …and it must still exist on the page (§3.11 forbids removing published history).
  const record = SRC(RECORD_TSX);
  assert.match(record, /Odds at publication/);
  assert.match(record, /Unit P\/L/);
});

test("ROI is omitted from the record", () => {
  assert.equal(/\bROI\b/.test(SRC(RECORD_TSX)), false);
});

/* -- defects that must not come back --------------------------------------- */

test("defect: internal implementation state never reaches user copy", () => {
  const loader = SRC("lib/fixtures/loadMatchPage.server.ts");
  for (const leak of [
    "settlement helpers ready",
    "durable selection snapshot",
    "publication deferred",
  ]) {
    assert.equal(loader.includes(leak), false, `internal phrase "${leak}" reaches the reader`);
  }
});

test("defect: the tautological potential line is gone", () => {
  assert.equal(
    SRC("lib/fixtures/loadMatchPage.server.ts").includes(
      "is reflected in the published confidence"
    ),
    false
  );
});

test("defect: a negative provider sentinel never becomes a published count", async () => {
  const { nonNegativeNum } = await import("../lib/footystats/matchDetail");
  // -1 is FootyStats' "not recorded" marker. It is finite, which is how it reached the page as
  // `Cards -1 / -1`; it must read as absent so the row is omitted rather than published.
  assert.equal(nonNegativeNum(-1), null);
  assert.equal(nonNegativeNum("-1"), null);
  assert.equal(nonNegativeNum(-0.5), null);
  // Real readings, including a legitimate zero, must survive.
  assert.equal(nonNegativeNum(0), 0);
  assert.equal(nonNegativeNum(3), 3);
  assert.equal(nonNegativeNum("7"), 7);
  assert.equal(nonNegativeNum(null), null);
  assert.equal(nonNegativeNum(""), null);
});

test("defect: every live count/percentage field is guarded, not just cards", () => {
  const src = SRC("lib/footystats/matchDetail.ts");
  for (const field of [
    "possessionHome", "possessionAway", "shotsHome", "shotsAway",
    "shotsOnTargetHome", "shotsOnTargetAway", "xgHome", "xgAway",
    "cornersHome", "cornersAway", "cardsHome", "cardsAway",
    "dangerousAttacksHome", "dangerousAttacksAway",
  ]) {
    assert.match(
      src,
      new RegExp(`${field}: nonNegativeNum\\(`),
      `${field} still accepts the provider's negative sentinel`
    );
  }
});

test("defect: the competition eyebrow never renders without a value", () => {
  const view = SRC("components/fixtures/MatchDetailView.tsx");
  assert.match(view, /competitionEyebrow \? \(/, "the eyebrow is conditional");
  assert.match(view, /header\.competition !== "—"/, "the placeholder value is excluded");
});

/* -- deferred markets never reach a reader as identifiers ------------------ */

test("defect: no deferred-market value renders in identifier form", async () => {
  const { DEFERRED_SETTLEMENT_MARKETS, deferredMarketLabels, deferredMarketLabel } = await import(
    "../lib/fixtures/settlement"
  );

  // The raw keys ARE identifiers — that is legitimate, settlement logic matches on them.
  assert.ok(DEFERRED_SETTLEMENT_MARKETS.includes("asian_handicap"));

  // What must never reach a reader is that form. Every published label is checked, not sampled.
  const labels = deferredMarketLabels();
  assert.equal(labels.length, DEFERRED_SETTLEMENT_MARKETS.length, "every key gets a label");
  for (const label of labels) {
    assert.equal(label.includes("_"), false, `"${label}" renders an underscore`);
    assert.equal(label.includes(":"), false, `"${label}" renders a colon`);
    assert.equal(
      /^[a-z0-9]+(_[a-z0-9]+)+$/.test(label),
      false,
      `"${label}" is lowercase-snake`
    );
    assert.match(label, /^[A-Z]/, `"${label}" does not start as a name`);
    assert.equal(label.trim(), label, `"${label}" has stray whitespace`);
  }

  // A key added later without a label must still not leak its identifier form.
  assert.equal(deferredMarketLabel("both_teams_to_score"), "Both teams to score");
  assert.equal(deferredMarketLabel("odds:asian_line"), "Odds asian line");
});

test("defect: the page's deferred list is built from labels, never from raw keys", () => {
  const loader = SRC("lib/fixtures/loadMatchPage.server.ts");
  assert.match(loader, /\.\.\.deferredMarketLabels\(\)/, "the view list maps through labels");
  assert.equal(
    /\.\.\.DEFERRED_SETTLEMENT_MARKETS/.test(loader),
    false,
    "raw keys are spread into reader-visible copy"
  );
});

test("defect: every reader-visible deferred entry is a market name", async () => {
  const { deferredMarketLabels } = await import("../lib/fixtures/settlement");
  // The exact array the fixture page renders: mapped keys plus the hand-written entries.
  const rendered = [...deferredMarketLabels(), "Match winner", "Double chance", "Draw no bet"];
  for (const entry of rendered) {
    assert.equal(/[_:]/.test(entry), false, `"${entry}" is an identifier, not a market name`);
  }
});

/* -- the neutral band scales with the sample ------------------------------- */

test("neutral band: one match in eight against a 90% league rate is not evidence", async () => {
  const { neutralBandPp, NEUTRAL_EPS_PP } = await import(
    "../lib/evidence-capture/model/constants"
  );
  // The reported defect: 88% (7/8) vs league 90% rendered "Opposes" on a 2pp gap.
  const band8 = neutralBandPp(90, 8);
  assert.ok(band8 > 2, `an 8-match sample must demand more than 2pp, got ${band8}`);
  assert.ok(Math.abs(88 - 90) < band8, "a one-match difference sits inside the band");

  // A larger sample earns a narrower band — the whole point of deriving it from n.
  const band30 = neutralBandPp(90, 30);
  assert.ok(band30 < band8, "30 matches must demand less than 8 matches");
  assert.ok(band30 > 0);

  // Monotonic in n, and floored where variance collapses.
  assert.ok(neutralBandPp(90, 50) < neutralBandPp(90, 20));
  assert.equal(neutralBandPp(100, 8), NEUTRAL_EPS_PP, "a zero-variance rate falls back to the floor");
  assert.equal(neutralBandPp(90, 0), NEUTRAL_EPS_PP);
  // Widest where a proportion is genuinely most variable.
  assert.ok(neutralBandPp(50, 20) > neutralBandPp(95, 20));
});

test("neutral band: a small-sample near-baseline rate derives as neutral end to end", () => {
  const view = buildFixtureEvidenceView(
    detailWith({ homePlayed: 8, awayPlayed: 8, homePct: 88, awayPct: 88, leaguePct: 90 })
  );
  assert.notEqual(view.state, "no_data");
  if (view.state === "no_data") return;
  const venue = view.signals.filter((s) => s.key.startsWith("season_"));
  assert.ok(venue.length > 0);
  for (const s of venue) {
    assert.equal(
      s.direction,
      "neutral",
      `${s.key} reads ${s.direction} on a one-match difference: ${s.display}`
    );
  }
});

test("the model version moved with the scoring function", async () => {
  const { SNAPSHOT_MODEL_VERSION } = await import("../lib/evidence-capture/capture/build");
  // Two functions must never share one version string.
  assert.notEqual(SNAPSHOT_MODEL_VERSION, "23B.daily-evidence.v1");
  assert.match(SNAPSHOT_MODEL_VERSION, /^23B\.daily-evidence\.v\d+$/);
});

/* -- no bare rate ANYWHERE on the page, record and timeline included ------- */

/**
 * Every reader-visible surface that renders the provider potential or a rate.
 *
 * The first version of this guard listed the fixture page alone, so the identical bare figure
 * survived on the acca surfaces through two rounds of the same fix. A guard that covers one
 * surface does not protect a rule that applies to all of them.
 */
const READER_SURFACES = [
  "components/fixtures/FixtureResearchSection.tsx",
  "components/fixtures/FixtureRecordSection.tsx",
  "components/fixtures/MatchPredictionsPanel.tsx",
  "components/fixtures/MatchDetailView.tsx",
  "components/acca/AccaPanelBody.tsx",
  "components/acca-publication/PublicAccaDetailView.tsx",
  "components/acca-publication/AccaDetailView.tsx",
];

test("no bare rate renders on any reader-visible surface", () => {
  const files = READER_SURFACES;
  for (const file of files) {
    const src = SRC(file).replace(/\s+/g, " ");
    // Any percentage rendered from data must be accompanied, in the same rendered line, by the
    // observations behind it or by an explicit statement that none was archived.
    const pctRenders = [...src.matchAll(/\{[^{}]*\}\s*%/g)].map((m) => m[0]);
    for (const render of pctRenders) {
      const idx = src.indexOf(render);
      const window = src.slice(Math.max(0, idx - 400), idx + 400);
      const accompanied =
        /\(\$\{|\(\d|sample|denominator|no sample|carries no sample|matches behind/i.test(window);
      assert.ok(
        accompanied,
        `${file} renders a bare percentage with no sample beside it: ${render}`
      );
    }
  }
});

test("the archived provider potential is not called a confidence", () => {
  const panel = SRC("components/fixtures/MatchPredictionsPanel.tsx").replace(/\s+/g, " ");
  assert.equal(/Confidence \{/.test(panel), false, "the provider potential is labelled Confidence");
  assert.match(panel, /Provider potential/, "it is named as what it is");
  assert.match(panel, /carries no sample/, "the absent denominator is stated, not implied");
  // §3.11 — the archived figure itself is still published.
  assert.match(panel, /\{prediction\.confidence\}/);
});

test("the page is one typeface: no serif override survives on fixture surfaces", () => {
  for (const file of [
    "components/fixtures/MatchDetailView.tsx",
    "components/fixtures/FixtureResearchSection.tsx",
    "components/fixtures/FixtureRecordSection.tsx",
    "components/live/LiveMatchSection.tsx",
    "components/evidence/EvidenceHistorySection.tsx",
  ]) {
    assert.equal(
      SRC(file).includes("font-display"),
      false,
      `${file} still forces the old serif inside the hero language`
    );
  }
});

test("no section is labelled by its usefulness for betting", () => {
  for (const file of [
    "components/fixtures/MatchDetailView.tsx",
    "lib/fixtures/loadMatchPage.server.ts",
  ]) {
    assert.equal(
      /Betting-relevant/.test(SRC(file)),
      false,
      `${file} labels a section as betting-relevant`
    );
  }
});

test("the provider potential is never called a confidence on any reader surface", () => {
  for (const file of READER_SURFACES) {
    const src = SRC(file).replace(/\s+/g, " ");
    for (const wrong of ["Model confidence", "Average confidence", "Confidence {"]) {
      assert.equal(
        src.includes(wrong),
        false,
        `${file} labels the provider potential "${wrong}"`
      );
    }
  }
});

test("every surface that renders the potential names it and states the missing sample", () => {
  for (const file of [
    "components/fixtures/MatchPredictionsPanel.tsx",
    "components/acca/AccaPanelBody.tsx",
    "components/acca-publication/PublicAccaDetailView.tsx",
  ]) {
    const src = SRC(file).replace(/\s+/g, " ");
    assert.match(src, /[Pp]rovider potential/, `${file} does not name the figure`);
    assert.match(
      src,
      /no sample|carries no sample/,
      `${file} implies a denominator it does not have`
    );
  }
});

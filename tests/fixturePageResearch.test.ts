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
    .replace(/\[[^\]]*\]/g, "");
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

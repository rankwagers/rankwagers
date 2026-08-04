import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";

import { buildFixtureEvidenceView, venueRatesForMarket } from "../lib/fixtures/evidenceView";
import { splitRate } from "../components/homepage/hero/heroModel";
import type { MatchDetailPublic } from "../lib/footystats/matchDetail";

/**
 * THE HERO'S VENUE RATES.
 *
 * The hero now states three figures beside the dial: the home side's record AT HOME, the away
 * side's record AWAY, and the league those two are read against. All three come from the same
 * provider detail the fixture page reads, through the same formatter.
 *
 * What these tests protect:
 *
 *   ONE FORMATTER, TWO SURFACES. The hero must not hold a second implementation of the rate
 *   string. Two implementations are two standards on one product (§18.4), and the moment they
 *   disagree, one of the pages is stating a figure that was never scored.
 *
 *   NEVER BARE. A rate is published with its sample or not at all (§3.2). The composition sets
 *   the two parts at different weights, so it SPLITS the model's string — it never rebuilds one
 *   from the numbers, because a rebuild can disagree with what was scored.
 *
 *   ABSENCE IS ABSENCE. A side the provider holds nothing for yields `null`, and `null` renders
 *   as an omitted slot. Not a dash, not a zero, not a skeleton — each of those states something
 *   (§3.8): that the rate is zero, or that a number is on its way.
 */

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

/* ------------------------------------------------------------------ *
 * One formatter, two surfaces
 * ------------------------------------------------------------------ */

test("the hero's rate strings are byte-identical to the fixture page's", () => {
  const detail = detailWith({ homePlayed: 11, awayPlayed: 9 });

  const page = buildFixtureEvidenceView(detail);
  assert.notEqual(page.state, "no_data", "precondition: the fixture page scores this detail");
  if (page.state === "no_data") return;

  for (const market of page.markets) {
    const hero = venueRatesForMarket(detail, market.marketKey);

    // The same three figures, character for character. A divergence here is one page stating a
    // football statistic the other never produced.
    assert.deepEqual(hero.home, market.homeRate, `home rate for ${market.marketKey}`);
    assert.deepEqual(hero.away, market.awayRate, `away rate for ${market.marketKey}`);
    assert.deepEqual(hero.league, market.leagueBaseline, `league rate for ${market.marketKey}`);
  }
});

test("every rate the hero publishes carries its sample", () => {
  const rates = venueRatesForMarket(detailWith({ homePlayed: 11, awayPlayed: 9 }), "over25");

  for (const [slot, rate] of Object.entries(rates)) {
    assert.ok(rate, `precondition: ${slot} resolved`);
    // `90% (10/11)` — a percentage is never published on its own.
    assert.match(rate.display, /^\d+% \(.+\)$/, `${slot} is never bare`);
  }
});

/* ------------------------------------------------------------------ *
 * Absence is absence
 * ------------------------------------------------------------------ */

test("no detail yields three nulls — never a zero and never a dash", () => {
  for (const absent of [null, undefined]) {
    const rates = venueRatesForMarket(absent, "over25");
    assert.deepEqual(rates, { home: null, away: null, league: null });
  }
});

test("one side missing omits that side alone and leaves the other stated", () => {
  const detail = detailWith({ homePlayed: 11, awayPlayed: 9 });
  // The provider returned the fixture but holds no away-venue record for it.
  const partial = { ...detail, awayAtAway: undefined } as unknown as MatchDetailPublic;

  const rates = venueRatesForMarket(partial, "over25");
  assert.ok(rates.home, "the side that IS observed still reads");
  assert.equal(rates.away, null, "the side that is not observed is omitted, not zeroed");
  assert.ok(rates.league, "the baseline is independent of either side");
});

test("a league below the published sample floor yields no baseline", () => {
  // LEAGUE_MIN_SAMPLE gates this. A rate drawn from four fixtures is not something the two venue
  // records can be compared against, so it is not offered as one.
  const rates = venueRatesForMarket(
    detailWith({ homePlayed: 11, awayPlayed: 9, leaguePlayed: 4 }),
    "over25"
  );
  assert.equal(rates.league, null);
  assert.ok(rates.home, "the venue records are unaffected");
});

test("an unknown market key yields nulls rather than a figure from another market", () => {
  const rates = venueRatesForMarket(detailWith({ homePlayed: 11, awayPlayed: 9 }), "btts");
  assert.deepEqual(rates, { home: null, away: null, league: null });
});

/* ------------------------------------------------------------------ *
 * The split, not a rebuild
 * ------------------------------------------------------------------ */

test("splitting a rate and rejoining it reproduces the model's string exactly", () => {
  const detail = detailWith({ homePlayed: 11, awayPlayed: 9 });

  for (const marketKey of ["fh", "over15", "over25", "sh"]) {
    const rates = venueRatesForMarket(detail, marketKey);
    for (const rate of [rates.home, rates.away, rates.league]) {
      assert.ok(rate, `precondition: ${marketKey} resolved`);
      const { rate: head, sample } = splitRate(rate.display);
      assert.ok(sample, "the sample survives the split");
      assert.equal(`${head} ${sample}`, rate.display, "rejoined, it is the original string");
    }
  }
});

test("splitRate holds a string that carries no sample rather than dropping it", () => {
  // Not a shape the model produces today. If it ever does, the figure must still reach the page.
  assert.deepEqual(splitRate("82%"), { rate: "82%", sample: null });
});

test("splitRate splits on the first bracket, so a nested denominator stays whole", () => {
  assert.deepEqual(splitRate("82% (9/11)"), { rate: "82%", sample: "(9/11)" });
  assert.deepEqual(splitRate("82% (40)"), { rate: "82%", sample: "(40)" });
});

/* ------------------------------------------------------------------ *
 * The composition states the three figures rather than deriving them
 * ------------------------------------------------------------------ */

const HERO_SRC = readFileSync(
  path.join(process.cwd(), "components/homepage/hero/HeroStage.tsx"),
  "utf8"
);

/*
 * The three figures moved into `HeroLead` with rebrand v2 — it is the component that consumes
 * `venueRates` now. Assertions about how they are PRESENTED have to read it rather than the stage
 * that merely passes them through.
 */
const LEAD_SRC = readFileSync(
  path.join(process.cwd(), "components/homepage/hero/HeroLead.tsx"),
  "utf8"
);

/** The supporting table is the other surface that sets a rate, a crest and a fixture. */
const TABLE_SRC = readFileSync(
  path.join(process.cwd(), "components/homepage/hero/SupportingTable.tsx"),
  "utf8"
);

test("the hero builds no rate string of its own", () => {
  // A `%` glued to an interpolated value is the shape of a rebuilt rate. The only percent sign in
  // this file belongs to the probability reading, which is a separate figure with its own source.
  const stripped = HERO_SRC.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.equal(
    /\$\{[^}]*\}%|\}\s*%\s*\(/.test(stripped),
    false,
    "no interpolated percentage — rates are split from the model's string, never assembled"
  );
});

test("an unresolved venue rate is omitted whole, and costs no layout when it is", () => {
  /*
   * REBRAND V2 CHANGED THE MECHANISM, NOT THE RULE.
   *
   * The replaced composition held reserved slots (`min-h-[64px]` beside the dial, `min-h-[20px]`
   * for the league) so that a fixture with no venue history occupied the same space as one that
   * had it. `HeroLead` does not reserve: it drops each unresolved line, and drops the block
   * entirely when none resolve. Both satisfy §3.8 — no dash, no zero, no skeleton — and neither
   * shifts anything, but they satisfy it in opposite ways, so the assertion has to follow.
   *
   * Why omission still costs no layout: the filter runs at RENDER, from props the server already
   * resolved. There is no later fill that could push the page around, which is the only thing the
   * reserved height ever protected against.
   */
  assert.match(
    LEAD_SRC,
    /\.filter\(\(t\): t is Track => t !== null\)/,
    "unresolved venue tracks are filtered out rather than drawn empty"
  );
  assert.match(
    LEAD_SRC,
    /const hasLines = venueTracks\.length > 0/,
    "and the block is dropped when neither venue record resolves"
  );
  assert.match(LEAD_SRC, /\{hasLines \? \(/, "the omission is a render-time branch, not a later fill");

  // The rate is never invented in the gap it leaves behind.
  const stripped = LEAD_SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  for (const placeholder of [/>\s*—\s*</, /skeleton/i, /animate-pulse/]) {
    assert.doesNotMatch(stripped, placeholder, "an absent rate is absent, not a placeholder");
  }
});

/* ------------------------------------------------------------------ *
 * What the refinements removed stays removed
 * ------------------------------------------------------------------ */

test("no crest is drawn at watermark scale", () => {
  /*
   * The crests moved with the composition: `HeroStage` no longer draws any, and the two surfaces
   * that identify a club now are the lead and the supporting table. The rule is unchanged and it
   * follows them — a crest identifies a club at a readable size, and past ~64px it stops
   * identifying and starts decorating, which is what the watermark was.
   */
  const sources = [LEAD_SRC, TABLE_SRC];
  const sizes = sources.flatMap((src) =>
    [...src.matchAll(/<Crest[\s\S]{0,160}?size=\{(\d+)\}/g)].map((m) => Number(m[1]))
  );
  assert.ok(sizes.length > 0, "precondition: crests are still drawn somewhere");
  for (const size of sizes) {
    assert.ok(size <= 64, `crest rendered at ${size}px — that is wallpaper, not a mark`);
  }
  // The map sets the table's crests at 26px. A different size here is a different composition.
  assert.match(TABLE_SRC, /size=\{26\}/, "the table's crests are the map's 26px");
});

test("the hero contributes no top padding of its own", () => {
  /*
   * One owner for the space above the first line. That owner is now `Section rhythm="masthead"`,
   * which sets `pt-0` because a publication's edition line sits directly under its header — but
   * the invariant this test protects is unchanged: the hero must not ALSO set one, because two
   * owners is what produced the dead air.
   */
  const stripped = HERO_SRC.replace(/\/\*[\s\S]*?\*\//g, "");
  const container = /className="(relative mx-auto w-full max-w-\[1240px\][^"]*)"/.exec(stripped);
  assert.ok(container, "the stage container is still identifiable — otherwise this test is blind");
  assert.equal(
    /\bpt-\d|\bpy-\d/.test(container[1]),
    false,
    `the stage container sets no top padding: ${container[1]}`
  );

  const section = readFileSync(path.join(process.cwd(), "components/layout/Section.tsx"), "utf8");
  assert.match(section, /masthead: "pt-0/, "and the one owner opens the page flush");
});

test("emphasis is stated by weight, never by shadow or radius", () => {
  /*
   * v1 stated the held selection with a card that lifted on hover. v2 has no cards: radius is 0
   * in scope, and a printed table responds by weight rather than by rising off the page. Both
   * halves are asserted, because dropping the lift without dropping the shadow would leave the
   * one device the rebrand most wants gone.
   */
  for (const [name, src] of [
    ["HeroStage", HERO_SRC],
    ["HeroLead", LEAD_SRC],
    ["SupportingTable", TABLE_SRC],
  ] as const) {
    const stripped = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    assert.equal(/boxShadow|shadow-/.test(stripped), false, `no shadow in ${name}`);
    assert.equal(/\brounded-/.test(stripped), false, `no radius in ${name}`);
    assert.equal(/m-lift/.test(stripped), false, `no surface lift in ${name}`);
  }
});

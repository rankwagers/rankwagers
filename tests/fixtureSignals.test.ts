import assert from "node:assert/strict";
import test from "node:test";

import {
  LEAD_MIN_SCORE,
  LEAGUE_MIN_SAMPLE,
  MAX_SUPPORTS,
  MIN_RANK_SAMPLE,
  RECENT_WINDOW,
  RELIABILITY_K,
  SUPPORT_MIN_SCORE,
  compareSignals,
  reliability,
  scoreFixtureSignals,
  type FixtureSignalInputs,
} from "../lib/fixtureSignals";
import type {
  HistoricalMatch,
  LeagueSeasonContext,
  VenueSideStats,
} from "../lib/footystats/matchDetail";

/* ------------------------------------------------------------------ builders */

function hit(hits: number, played: number) {
  return { hits, played, pct: played > 0 ? Math.round((hits / played) * 100) : 0 };
}

function venue(
  played: number,
  overrides: Partial<Record<"over15" | "over25" | "over35" | "fh05" | "sh05" | "btts" | "cleanSheets" | "failedToScore", { hits: number; played: number }>> = {}
): VenueSideStats {
  const base = (h: number) => hit(h, played);
  const o = (k: keyof typeof overrides, fallbackHits: number) => {
    const ov = overrides[k];
    return ov ? hit(ov.hits, ov.played) : base(fallbackHits);
  };
  return {
    played,
    over15: o("over15", Math.round(played * 0.7)),
    over25: o("over25", Math.round(played * 0.5)),
    over35: o("over35", Math.round(played * 0.25)),
    fh05: o("fh05", Math.round(played * 0.6)),
    sh05: o("sh05", Math.round(played * 0.7)),
    btts: o("btts", Math.round(played * 0.5)),
    cleanSheets: o("cleanSheets", Math.round(played * 0.3)),
    failedToScore: o("failedToScore", Math.round(played * 0.2)),
    scoredAvg: 1.4,
    concededAvg: 1.1,
  };
}

function league(overrides: Partial<LeagueSeasonContext> = {}): LeagueSeasonContext {
  // Baselines match the venue builder's default fractions exactly, so the `flat`
  // fixture is genuinely deviation-free and any test-added override is the only signal.
  return {
    played: 120,
    avgGoals: 2.6,
    over15: 70,
    over25: 50,
    fh05: 60,
    sh05: 70,
    btts: 50,
    ...overrides,
  };
}

let matchId = 1;
function m(homeGoals: number, awayGoals: number, day: number): HistoricalMatch {
  return {
    id: matchId++,
    kickoffAt: `2026-07-${String(day).padStart(2, "0")}T15:00:00.000Z`,
    home: { name: "H", score: homeGoals },
    away: { name: "A", score: awayGoals },
  };
}

const flat: FixtureSignalInputs = {
  // Every rate sits exactly on the league baseline — no deviation anywhere.
  homeAtHome: venue(10),
  awayAtAway: venue(10),
  leagueSeason: league(),
  history: null,
};

/* ------------------------------------------------------------------ the curve */

test("reliability is monotonic, bounded, and zero below the ranking floor", () => {
  assert.equal(reliability(0), 0);
  assert.equal(reliability(MIN_RANK_SAMPLE - 1), 0, "n<5 earns no rank weight at all");
  assert.equal(reliability(MIN_RANK_SAMPLE), MIN_RANK_SAMPLE / (MIN_RANK_SAMPLE + RELIABILITY_K));
  assert.equal(reliability(10), 10 / 15);
  assert.equal(reliability(20), 20 / 25);
  assert.ok(reliability(20) > reliability(10) && reliability(10) > reliability(5));
  assert.ok(reliability(1000) < 1, "the curve never reaches certainty");
});

test("HARD CAP: a 4-match run at maximum deviation can never outrank a 10-match pattern", () => {
  const report = scoreFixtureSignals({
    ...flat,
    // 4/4 = 100% against a 50% baseline — the loudest possible small sample.
    homeAtHome: venue(10, { over25: { hits: 4, played: 4 } }),
    // 6/10 = 60% against 50% — a mild but real 10-match pattern.
    awayAtAway: venue(10, { over25: { hits: 6, played: 10 } }),
  });
  const small = [...report.supports, ...report.detail, ...(report.lead ? [report.lead] : [])].find(
    (s) => s.market === "over25" && s.scope === "home_venue"
  );
  const large = [...report.supports, ...report.detail, ...(report.lead ? [report.lead] : [])].find(
    (s) => s.market === "over25" && s.scope === "away_venue"
  );
  assert.ok(small && large, "both candidates exist");
  assert.equal(small.score, 0, "the small sample scores zero — context, not a finding");
  assert.ok(large.score > 0);
  assert.equal(small.level, "detail", "and it can only ever live in the detail level");
});

/* ------------------------------------------------------------------ grammar */

test("every signal states market, direction, count, sample, rate, baseline, scope, window", () => {
  const report = scoreFixtureSignals({
    ...flat,
    history: {
      homeAtHome: [m(2, 1, 1), m(0, 0, 2), m(3, 1, 3), m(1, 1, 4), m(2, 2, 5), m(1, 0, 6), m(4, 0, 7)],
    },
  });
  for (const s of [...(report.lead ? [report.lead] : []), ...report.supports, ...report.detail]) {
    assert.ok(s.sample > 0 && s.count >= 0 && s.count <= s.sample, "count within sample");
    assert.ok(s.rate >= 0 && s.rate <= 1, "rate is a proportion");
    assert.ok(s.baseline === null || (s.baseline > 0 && s.baseline < 1), "baseline honest");
    assert.ok(
      s.baseline === null ? s.direction === "no_baseline" : s.direction !== "no_baseline",
      "direction agrees with the baseline state"
    );
    assert.match(s.window, /^(season|last\d+)$/);
  }
});

test("recent windows read the newest matches, cap at the window, and skip unscored rows", () => {
  const matches: HistoricalMatch[] = [];
  // 10 old goalless draws, then 7 recent goal-fests: the window must see only the recent 7.
  for (let day = 1; day <= 10; day++) matches.push(m(0, 0, day));
  for (let day = 11; day <= 17; day++) matches.push(m(2, 2, day));
  const report = scoreFixtureSignals({ ...flat, history: { homeAtHome: matches } });
  const over25 = [...(report.lead ? [report.lead] : []), ...report.supports, ...report.detail].find(
    (s) => s.market === "over25" && s.scope === "recent_home"
  );
  assert.ok(over25, "the recent signal exists");
  assert.equal(over25.sample, RECENT_WINDOW);
  assert.equal(over25.count, RECENT_WINDOW, "all seven recent matches cleared over 2.5");
  assert.equal(over25.window, `last${RECENT_WINDOW}`);

  const unscored = scoreFixtureSignals({
    ...flat,
    history: {
      homeAtHome: [
        m(2, 1, 1),
        { ...m(0, 0, 2), home: { name: "H", score: NaN }, away: { name: "A", score: 1 } },
      ],
    },
  });
  const sig = [...unscored.detail, ...unscored.supports].find((s) => s.scope === "recent_home");
  assert.ok(sig && sig.sample === 1, "an unscored row is skipped, never counted as a miss");
});

/* ------------------------------------------------------------------ baselines */

test("markets without a league baseline carry the explicit state and never rank", () => {
  const report = scoreFixtureSignals({
    ...flat,
    // over35 at a huge deviation — but the league context carries no over35 rate.
    homeAtHome: venue(12, { over35: { hits: 11, played: 12 } }),
  });
  const all = [...(report.lead ? [report.lead] : []), ...report.supports, ...report.detail];
  const o35 = all.find((s) => s.market === "over35" && s.scope === "home_venue");
  assert.ok(o35);
  assert.equal(o35.baseline, null, "no invented number");
  assert.equal(o35.direction, "no_baseline");
  assert.equal(o35.score, 0, "a deviation from nothing is not a finding");
  assert.equal(o35.level, "detail");
  for (const market of ["cleanSheets", "failedToScore"] as const) {
    const s = all.find((x) => x.market === market && x.scope === "home_venue");
    assert.ok(s && s.baseline === null && s.level === "detail", `${market} has no baseline`);
  }
});

test("a league below its own sample floor offers no baseline", () => {
  const report = scoreFixtureSignals({
    ...flat,
    leagueSeason: league({ played: LEAGUE_MIN_SAMPLE - 1 }),
    homeAtHome: venue(12, { over25: { hits: 11, played: 12 } }),
  });
  assert.equal(report.lead, null, "nothing can lead without a baseline");
  assert.equal(report.supports.length, 0);
  for (const s of report.detail) assert.equal(s.baseline, null);
});

/* ------------------------------------------------------------------ levels */

test("a strong deviation leads; flat data omits the lead honestly", () => {
  const strong = scoreFixtureSignals({
    ...flat,
    // 12/14 = 86% against 50%: dev .357 × rel 14/19 ≈ .263 — well past the lead bar.
    homeAtHome: venue(14, { over25: { hits: 12, played: 14 } }),
  });
  assert.ok(strong.lead, "the strong signal leads");
  assert.equal(strong.lead.market, "over25");
  assert.equal(strong.lead.scope, "home_venue");
  assert.ok(strong.lead.score >= LEAD_MIN_SCORE);
  assert.equal(
    strong.supports.some((s) => s === strong.lead),
    false,
    "the lead never repeats as a support — no information at two levels"
  );

  const flatReport = scoreFixtureSignals(flat);
  assert.equal(flatReport.lead, null, "flat data yields no lead — the level is omitted");
  assert.equal(flatReport.supports.length, 0, "and nothing pads the supports");
  assert.ok(flatReport.detail.length > 0, "the detail level still carries the table");
});

test("supports hold the grammar bar and cap at five", () => {
  const report = scoreFixtureSignals({
    homeAtHome: venue(14, {
      over15: { hits: 13, played: 14 },
      over25: { hits: 12, played: 14 },
      fh05: { hits: 12, played: 14 },
      sh05: { hits: 13, played: 14 },
      btts: { hits: 12, played: 14 },
    }),
    awayAtAway: venue(14, {
      over15: { hits: 13, played: 14 },
      over25: { hits: 12, played: 14 },
      fh05: { hits: 12, played: 14 },
    }),
    leagueSeason: league(),
    history: null,
  });
  assert.ok(report.lead, "a lead exists on loud data");
  assert.ok(report.supports.length <= MAX_SUPPORTS, "supports never exceed five");
  assert.equal(report.supports.length, MAX_SUPPORTS, "loud data fills the shortlist");
  for (const s of report.supports) assert.ok(s.score >= SUPPORT_MIN_SCORE);
  // Ranked: scores never ascend.
  for (let i = 1; i < report.supports.length; i++) {
    assert.ok(compareSignals(report.supports[i - 1], report.supports[i]) <= 0);
  }
});

/* ------------------------------------------------------------------ determinism */

test("same inputs, same output — twice, byte for byte", () => {
  const inputs: FixtureSignalInputs = {
    homeAtHome: venue(13, { over25: { hits: 10, played: 13 } }),
    awayAtAway: venue(9, { btts: { hits: 8, played: 9 } }),
    leagueSeason: league(),
    history: {
      homeAtHome: [m(2, 1, 1), m(1, 1, 2), m(3, 0, 3), m(0, 2, 4), m(2, 2, 5), m(1, 0, 6)],
      headToHead: [m(1, 1, 1), m(2, 1, 2)],
    },
  };
  const a = scoreFixtureSignals(inputs);
  const b = scoreFixtureSignals(inputs);
  assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));
});

test("ties break by sample, then market, then scope — never by input order", () => {
  // Two identical deviations at different samples: the larger sample ranks first.
  const bySample = scoreFixtureSignals({
    ...flat,
    homeAtHome: venue(10, { over25: { hits: 7, played: 10 } }), // 70% vs 50%, n=10
    awayAtAway: venue(20, { over25: { hits: 14, played: 20 } }), // 70% vs 50%, n=20
  });
  const ranked = [...(bySample.lead ? [bySample.lead] : []), ...bySample.supports];
  const first = ranked.find((s) => s.market === "over25");
  assert.ok(first && first.sample === 20, "the larger sample outranks the equal-rate smaller one");

  // Same score, same sample, different market: alphabetical market decides.
  const byMarket = scoreFixtureSignals({
    ...flat,
    homeAtHome: venue(10, {
      btts: { hits: 7, played: 10 }, // 70% vs 50%
      over25: { hits: 7, played: 10 }, // 70% vs 50%
    }),
  });
  const pair = [...(byMarket.lead ? [byMarket.lead] : []), ...byMarket.supports].filter(
    (s) => s.scope === "home_venue" && (s.market === "btts" || s.market === "over25")
  );
  assert.deepEqual(
    pair.map((s) => s.market),
    ["btts", "over25"],
    "alphabetical market is the deterministic tie-break"
  );
});

test("empty inputs produce an empty, honest report", () => {
  const report = scoreFixtureSignals({
    homeAtHome: null,
    awayAtAway: null,
    leagueSeason: null,
    history: null,
  });
  assert.deepEqual(report, { lead: null, supports: [], detail: [] });
});

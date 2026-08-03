import test from "node:test";
import assert from "node:assert/strict";
import { partitionDailyMatches } from "../lib/footystats/client";
import { buildHomepageHeroModel } from "../lib/homepage/heroModel";
import { observedResearchRun } from "../lib/research/researchRun";

/**
 * THE INVARIANT: observation and flow are independent.
 *
 * The `validated` stage counts rows satisfying the field contract. It must not decide which rows
 * survive. An earlier pass made it a filter, and the two consumers that read `DailyMatchLists`
 * directly — `app/api/home-search/route.ts`, which maps `FootyMatchRow` fields straight off the
 * lists, and `mergeArchiveFromLists`, which persists them verbatim — silently lost rows. The
 * second is a destructive change to stored history (rwbible §3.11).
 *
 * These tests fail if instrumentation ever starts altering what flows.
 */

/** A raw provider match. Defaults clear every threshold, so the row lands in all four lists. */
function raw(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 101,
    home_name: "Home",
    away_name: "Away",
    competition_id: 1,
    match_url: "/england/home-vs-away",
    date_unix: 1_800_000_000,
    o15_potential: 95,
    o05HT_potential: 95,
    o25_potential: 95,
    o05_2H_potential: 95,
    status: "incomplete",
    ...over,
  };
}

const NO_CACHE: Record<number, { league: string; country: string }> = {};

test("a malformed row that clears a threshold still reaches the lists", () => {
  // Blank away name: fails the contract, but every potential is above its threshold.
  const result = partitionDailyMatches([raw({ away_name: "" })], NO_CACHE);

  // It flowed. All four lists carry it, exactly as before the instrumentation existed.
  assert.equal(result.over15.length, 1);
  assert.equal(result.fh.length, 1);
  assert.equal(result.over25.length, 1);
  assert.equal(result.sh.length, 1);

  // It was not counted — at any stage it fails, qualified included.
  assert.equal(result.analysed, 1);
  assert.equal(result.validated, 0);
  assert.equal(result.inScope, 0);
  assert.equal(result.qualifiedIds.has(101), false);
});

test("every malformed shape flows while counting out of validated", () => {
  const defects: Array<Record<string, unknown>> = [
    { id: 0 },
    { id: -3 },
    { id: 4.5 },
    { home_name: "" },
    { home_name: "   " },
    { away_name: "" },
    { date_unix: 0 },
    { date_unix: -1 },
    { o15_potential: "not-a-number" },
    { o05HT_potential: 101 },
    { o25_potential: -1 },
  ];

  for (const defect of defects) {
    const result = partitionDailyMatches([raw(defect)], NO_CACHE);
    const label = JSON.stringify(defect);

    assert.equal(result.analysed, 1, `${label}: analysed counts the population`);
    assert.equal(result.validated, 0, `${label}: must not count as validated`);
    // The row still reached buildRow and still landed wherever its potentials put it.
    const landed =
      result.over15.length + result.fh.length + result.over25.length + result.sh.length;
    assert.ok(landed > 0, `${label}: row must still flow into the lists`);
  }
});

test("a well-formed row counts and flows", () => {
  const result = partitionDailyMatches([raw()], NO_CACHE);

  assert.equal(result.analysed, 1);
  assert.equal(result.validated, 1);
  assert.equal(result.inScope, 1);
  assert.equal(result.over15.length, 1);
  assert.equal(result.qualifiedIds.has(101), true);
});

test("the cup filter is the only thing that removes a row", () => {
  const cache = { 7: { league: "FA Cup", country: "England" } };
  const result = partitionDailyMatches([raw({ competition_id: 7 })], cache);

  // Pre-existing flow control, unchanged: a cup fixture reaches no list.
  assert.equal(result.over15.length, 0);
  assert.equal(result.fh.length, 0);
  assert.equal(result.qualifiedIds.size, 0);

  // It is still a validated row — the contract passed; the competition was out of scope.
  assert.equal(result.validated, 1);
  assert.equal(result.inScope, 0);
});

test("inScope stays a subset of validated", () => {
  const result = partitionDailyMatches(
    [raw({ id: 1 }), raw({ id: 2, home_name: "" }), raw({ id: 3 })],
    NO_CACHE
  );

  assert.equal(result.analysed, 3);
  assert.equal(result.validated, 2);
  assert.ok(result.inScope <= result.validated);
  assert.equal(result.inScope, 2);
  // The malformed row is counted out of qualified too — the chain nests.
  assert.equal(result.qualifiedIds.size, 2);
  // But all three still flowed: the lists carry every row that cleared a threshold.
  assert.equal(result.over15.length, 3);
});

test("qualified counts distinct fixtures, not list memberships", () => {
  // One match clearing all four thresholds is one qualified fixture in four lists.
  const result = partitionDailyMatches([raw()], NO_CACHE);

  assert.equal(
    result.over15.length + result.fh.length + result.over25.length + result.sh.length,
    4
  );
  assert.equal(result.qualifiedIds.size, 1);
});

test("a row below every threshold flows nowhere but is still analysed and validated", () => {
  const result = partitionDailyMatches(
    [
      raw({
        o15_potential: 10,
        o05HT_potential: 10,
        o25_potential: 10,
        o05_2H_potential: 10,
      }),
    ],
    NO_CACHE
  );

  assert.equal(result.analysed, 1);
  assert.equal(result.validated, 1);
  assert.equal(result.inScope, 1);
  assert.equal(result.qualifiedIds.size, 0);
});

test("an empty population observes zeros, which are real counts", () => {
  const result = partitionDailyMatches([], NO_CACHE);

  assert.equal(result.analysed, 0);
  assert.equal(result.validated, 0);
  assert.equal(result.inScope, 0);
  assert.equal(result.qualifiedIds.size, 0);
});

/* ------------------------------------------------------------------ *
 * The nesting chain
 * ------------------------------------------------------------------ */

/**
 * Deterministic pseudo-random generator.
 *
 * Seeded rather than `Math.random` so a failure is reproducible from its seed alone — a property
 * test that cannot be replayed is a flake report, not evidence.
 */
function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

/** A population mixing well-formed rows, every defect class, cup fixtures and sub-threshold rows. */
function population(seed: number): Record<string, unknown>[] {
  const next = rng(seed);
  const size = Math.floor(next() * 40);
  const defects: Array<Record<string, unknown>> = [
    {},
    { id: 0 },
    { id: -1 },
    { id: 2.5 },
    { home_name: "" },
    { away_name: "   " },
    { date_unix: 0 },
    { o15_potential: "x" },
    { o25_potential: 101 },
    { o05HT_potential: -1 },
  ];

  return Array.from({ length: size }, (_, i) => {
    const defect = defects[Math.floor(next() * defects.length)] ?? {};
    const cup = next() < 0.25;
    const belowThreshold = next() < 0.3;
    return {
      ...raw({ id: i + 1 }),
      ...(belowThreshold
        ? {
            o15_potential: 10,
            o05HT_potential: 10,
            o25_potential: 10,
            o05_2H_potential: 10,
          }
        : {}),
      ...(cup ? { competition_id: 99 } : {}),
      ...defect,
    };
  });
}

test("PROPERTY: the full chain nests across generated populations", () => {
  const cache = { 99: { league: "FA Cup", country: "England" } };

  for (let seed = 1; seed <= 300; seed += 1) {
    const matches = population(seed);
    const r = partitionDailyMatches(matches, cache);

    /*
     * The last stage is observed by the hero, not the pipeline, so the chain is closed by feeding
     * the partition's own lists through the model exactly as the page does.
     */
    const model = buildHomepageHeroModel({
      locale: "en",
      lists: {
        date: "2026-08-03",
        over15: r.over15,
        fh: r.fh,
        over25: r.over25,
        sh: r.sh,
        fetchedAt: "2026-08-03T09:15:00.000Z",
        researchRun: observedResearchRun({
          analysed: r.analysed,
          validated: r.validated,
          inScope: r.inScope,
          qualified: r.qualifiedIds.size,
        }),
      },
    });
    const f = model.funnel;
    const at = `seed ${seed}`;

    assert.equal(r.analysed, matches.length, `${at}: analysed must be the population`);
    assert.ok(f.analysed !== null && f.validated !== null, `${at}: stages must be observed`);
    assert.ok(f.analysed >= f.validated, `${at}: analysed ${f.analysed} < validated ${f.validated}`);
    assert.ok(
      f.validated >= (f.inScope ?? 0),
      `${at}: validated ${f.validated} < inScope ${f.inScope}`
    );
    assert.ok(
      (f.inScope ?? 0) >= (f.qualified ?? 0),
      `${at}: inScope ${f.inScope} < qualified ${f.qualified}`
    );
    assert.ok(
      (f.qualified ?? 0) >= (f.featured ?? 0),
      `${at}: qualified ${f.qualified} < featured ${f.featured}`
    );

    // The hero's own count of what it renders, and the cap it renders under.
    assert.equal(f.featured, model.picks.length, `${at}: featured must be the rendered count`);
    assert.ok(model.picks.length <= 5, `${at}: the composition caps at five`);
  }
});

test("a malformed row counts 0 toward qualified as well as validated", () => {
  const result = partitionDailyMatches([raw({ away_name: "" })], NO_CACHE);

  // Still flows: all four lists, and therefore search and the archive.
  assert.equal(result.over15.length, 1);
  assert.equal(result.fh.length, 1);
  assert.equal(result.over25.length, 1);
  assert.equal(result.sh.length, 1);

  // Counted out of every stage it fails.
  assert.equal(result.validated, 0);
  assert.equal(result.inScope, 0);
  assert.equal(result.qualifiedIds.size, 0);

  // And the population still saw it.
  assert.equal(result.analysed, 1);
});

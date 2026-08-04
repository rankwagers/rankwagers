import test from "node:test";
import assert from "node:assert/strict";
import {
  HERO_PICK_COUNT,
  buildHomepageHeroModel,
  leagueKeyFor,
} from "../lib/homepage/heroModel";
import {
  RESEARCH_STAGES,
  RESEARCH_STAGE_RULES,
  observedResearchRun,
  unobservedResearchRun,
} from "../lib/research/researchRun";
import { footyRowCoreSchema } from "../lib/research/footyRowContract";
import { mapDailyListsToQualifiedFixtures } from "../lib/research/qualifiedFixture";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { DailyMatchLists, FootyMatchRow } from "../lib/footystats/types";

/**
 * Sprint 1 hero model.
 *
 * The contract this file protects is not cosmetic: the hero renders whatever the model hands it,
 * so a field that silently defaults instead of staying `null` would put an unevidenced figure on
 * the homepage.
 */

function row(over: Partial<FootyMatchRow> & { matchId: number }): FootyMatchRow {
  return {
    homeTeam: "Home",
    awayTeam: "Away",
    competition: "Premier League",
    country: "England",
    flag: "",
    kickoffTime: 1_800_000_000,
    kickoff: "20:00",
    over15Pct: 0,
    fhOver05Pct: 0,
    over25Pct: 0,
    shOver05Pct: 0,
    status: "scheduled",
    isLive: false,
    isFinished: false,
    homeScore: 0,
    awayScore: 0,
    minute: 0,
    highlightPct: 0,
    ...over,
  };
}

function lists(over: Partial<DailyMatchLists> = {}): DailyMatchLists {
  return {
    date: "2026-08-03",
    over15: [],
    over25: [],
    fh: [],
    sh: [],
    fetchedAt: "2026-08-03T09:15:00.000Z",
    ...over,
  };
}

test("a fixture qualifying in several markets becomes ONE pick at its strongest market", () => {
  const model = buildHomepageHeroModel({
    locale: "en",
    lists: lists({
      over15: [row({ matchId: 1, over15Pct: 71 })],
      over25: [row({ matchId: 1, over25Pct: 88 })],
    }),
  });

  assert.equal(model.picks.length, 1);
  assert.equal(model.picks[0]?.probability, 88);
  assert.equal(model.picks[0]?.marketKind, "over25");
  // The hero ranks fixtures, so the funnel denominator counts fixtures too.
  assert.equal(model.funnel.qualified, 1);
});

test("picks are ranked strongest first and capped at the composition's five", () => {
  const model = buildHomepageHeroModel({
    locale: "en",
    lists: lists({
      over25: [10, 90, 50, 70, 30, 20].map((pct, i) =>
        row({ matchId: i + 1, over25Pct: pct })
      ),
    }),
  });

  assert.equal(model.picks.length, 5);
  assert.deepEqual(
    model.picks.map((pick) => pick.probability),
    [90, 70, 50, 30, 20]
  );
});

test("every field without a production source stays null", () => {
  const model = buildHomepageHeroModel({
    locale: "en",
    lists: lists({ over25: [row({ matchId: 1, over25Pct: 88 })] }),
  });
  const pick = model.picks[0];
  assert.ok(pick);

  for (const value of [
    pick.evidence,
    pick.confidence,
    pick.confidenceLabel,
    pick.reasons,
    pick.summary,
    pick.signals,
    pick.history,
    pick.round,
    pick.venue,
  ]) {
    assert.equal(value, null);
  }

  // Lists carrying no `researchRun` were not instrumented — an archive read, a fallback, or a
  // capture that predates the instrumentation. Every stage the pipeline would have observed stays
  // null rather than defaulting to zero.
  assert.equal(model.funnel.analysed, null);
  assert.equal(model.funnel.validated, null);
  assert.equal(model.funnel.inScope, null);
  assert.equal(model.funnel.published, null);
});

/* ------------------------------------------------------------------ *
 * ResearchRun — every field, both branches
 * ------------------------------------------------------------------ */

test("EVERY ResearchRun stage is null when the pipeline recorded no run", () => {
  const model = buildHomepageHeroModel({
    locale: "en",
    lists: lists({ over25: [row({ matchId: 1, over25Pct: 88 })] }),
  });

  // Observable from the lists in hand on any path, instrumented or not.
  assert.equal(model.funnel.qualified, 1);
  assert.equal(model.funnel.featured, 1);

  // Everything the pipeline alone can see is absent.
  for (const stage of ["analysed", "validated", "inScope"] as const) {
    assert.equal(model.funnel[stage], null, `${stage} must stay null without a run`);
  }
});

test("an unobserved run publishes no stage as zero", () => {
  const model = buildHomepageHeroModel({
    locale: "en",
    lists: lists({
      over25: [row({ matchId: 1, over25Pct: 88 })],
      researchRun: unobservedResearchRun("2026-08-03T09:15:00.000Z"),
    }),
  });

  // A provider failure or an archive read observed nothing. Zero would assert the provider
  // returned an empty day, which is a different and unevidenced claim (rwbible §3.2/§3.8).
  for (const stage of ["analysed", "validated", "inScope"] as const) {
    assert.equal(model.funnel[stage], null, `${stage} must be null, never 0`);
  }
});

test("observed stages reach the funnel unchanged, and unobserved ones stay null", () => {
  const model = buildHomepageHeroModel({
    locale: "en",
    lists: lists({
      over25: [row({ matchId: 1, over25Pct: 88 })],
      researchRun: observedResearchRun({
        analysed: 238,
        validated: 231,
        inScope: 214,
        qualified: 18,
        fetchedAt: "2026-08-03T09:15:00.000Z",
      }),
    }),
  });

  assert.equal(model.funnel.analysed, 238);
  assert.equal(model.funnel.validated, 231);
  assert.equal(model.funnel.inScope, 214);
});

test("a stage the run did not measure stays null even when its neighbours are known", () => {
  const model = buildHomepageHeroModel({
    locale: "en",
    lists: lists({
      over25: [row({ matchId: 1, over25Pct: 88 })],
      researchRun: observedResearchRun({ analysed: 238, qualified: 18 }),
    }),
  });

  // Both neighbours are present; the unmeasured stages between them are still absent.
  assert.equal(model.funnel.validated, null);
  assert.equal(model.funnel.inScope, null);
});

test("a stage is never derived by subtraction from its neighbours", () => {
  const model = buildHomepageHeroModel({
    locale: "en",
    lists: lists({
      over25: [row({ matchId: 1, over25Pct: 88 })],
      researchRun: observedResearchRun({ analysed: 238, validated: 231 }),
    }),
  });

  // 238 - 231 = 7 and 231 - 1 = 230 are both available. Neither may appear as a stage.
  assert.equal(model.funnel.inScope, null);
  assert.notEqual(model.funnel.inScope, 7);
  assert.notEqual(model.funnel.inScope, 230);
});

test("qualified counts the lists in hand, not the run's figure", () => {
  // The two agree by construction on a live run. When they disagree — an archive whose stored run
  // came from a different pass — the count of what is actually present wins, because that is the
  // observation this request can make.
  const model = buildHomepageHeroModel({
    locale: "en",
    lists: lists({
      over25: [row({ matchId: 1, over25Pct: 88 }), row({ matchId: 2, over25Pct: 91 })],
      researchRun: observedResearchRun({ analysed: 238, qualified: 99 }),
    }),
  });

  assert.equal(model.funnel.qualified, 2);
});

test("featured is what the composition presents, capped at the pick count", () => {
  const many = Array.from({ length: 9 }, (_, i) =>
    row({ matchId: i + 1, over25Pct: 70 + i })
  );
  const model = buildHomepageHeroModel({ locale: "en", lists: lists({ over25: many }) });

  assert.equal(model.funnel.qualified, 9);
  assert.equal(model.funnel.featured, HERO_PICK_COUNT);
  assert.equal(model.funnel.featured, model.picks.length);
});

test("an empty day reports zero featured — an observation, not an absence", () => {
  const model = buildHomepageHeroModel({ locale: "en", lists: lists() });

  // Zero IS the right value here: the composition genuinely presented nothing, and that is
  // observed rather than assumed. Only unmeasured stages are null.
  assert.equal(model.funnel.featured, 0);
  assert.equal(model.funnel.qualified, 0);
  assert.equal(model.funnel.analysed, null);
});

test("a run rejects impossible counts rather than passing them through", () => {
  const run = observedResearchRun({
    analysed: -1,
    validated: 12.5,
    qualified: Number.NaN,
    inScope: Number.POSITIVE_INFINITY,
  });

  for (const stage of ["analysed", "validated", "qualified", "inScope"] as const) {
    assert.equal(run[stage], null, `${stage} must reject a non-count`);
  }
});

test("rule identifiers exist only where a rule exists", () => {
  const model = buildHomepageHeroModel({
    locale: "en",
    lists: lists({ researchRun: observedResearchRun({ analysed: 238 }) }),
  });

  // Every stage names the rule that actually ran, and each name describes that rule.
  assert.equal(model.funnel.rules.validated, "schema_validation");
  assert.equal(model.funnel.rules.inScope, "exclude_cup_competitions");
  assert.equal(model.funnel.rules.qualified, "market_potential_threshold");
  assert.equal(model.funnel.rules.featured, "hero_pick_count");

  // `analysed` is the population the rules are applied to, so it has no rule of its own.
  assert.equal(model.funnel.rules.analysed, null);
});

test("no stage is named for something other than the rule that produced it (bible 18.4)", () => {
  // `validated` is schema validation — the meaning the word already carries in
  // `qualifiedFixture.ts`. The cup filter is `inScope`, named for the rule that runs there.
  assert.equal(RESEARCH_STAGE_RULES.validated, "schema_validation");
  assert.equal(RESEARCH_STAGE_RULES.inScope, "exclude_cup_competitions");
  assert.equal(RESEARCH_STAGES.indexOf("validated") < RESEARCH_STAGES.indexOf("inScope"), true);
});

test("the deleted shortlisted stage is gone, not nulled", () => {
  const run = observedResearchRun({ analysed: 1 });
  assert.equal("shortlisted" in run, false);
  assert.equal("shortlisted" in run.rules, false);
  assert.equal(RESEARCH_STAGES.includes("shortlisted" as never), false);
});

test("the funnel exposes every ResearchRun stage, so none can be silently dropped", () => {
  const model = buildHomepageHeroModel({ locale: "en", lists: lists() });

  for (const stage of RESEARCH_STAGES) {
    assert.ok(stage in model.funnel, `funnel is missing the ${stage} stage`);
    assert.ok(stage in model.funnel.rules, `rules are missing the ${stage} stage`);
  }
});

test("an empty day yields no picks and does not throw", () => {
  const model = buildHomepageHeroModel({ locale: "en", lists: lists() });
  assert.deepEqual(model.picks, []);
  assert.equal(model.funnel.qualified, 0);
});

test("an unusable retrieval stamp resolves to null rather than an invented time", () => {
  const model = buildHomepageHeroModel({
    locale: "en",
    lists: lists({ fetchedAt: "not-a-date" }),
  });
  assert.equal(model.fetchedAt, null);
});

test("rows the provider cannot identify are dropped, not rendered blank", () => {
  const model = buildHomepageHeroModel({
    locale: "en",
    lists: lists({
      over25: [
        row({ matchId: 1, over25Pct: 80, homeTeam: "  " }),
        row({ matchId: 2, over25Pct: 70 }),
        row({ matchId: 0, over25Pct: 99 }),
      ],
    }),
  });

  assert.equal(model.picks.length, 1);
  assert.equal(model.picks[0]?.matchId, 2);
});

test("competition keys fold accents so tint lookup is stable", () => {
  assert.equal(leagueKeyFor("Brasileirão"), "brasileirao");
  assert.equal(leagueKeyFor("Primeira Liga"), "primeira liga");
  assert.equal(leagueKeyFor("  LaLiga  "), "laliga");
});

test("pick links use the canonical fixture path with a hero source", () => {
  const model = buildHomepageHeroModel({
    locale: "en",
    lists: lists({ over25: [row({ matchId: 42, over25Pct: 88 })] }),
  });
  assert.equal(model.picks[0]?.matchHref, "/en/fixtures/42?market=over25&source=hero");
});

/* ------------------------------------------------------------------ *
 * The validated stage reads one schema, shared with the fixture parse
 * ------------------------------------------------------------------ */

test("the validated stage rejects exactly the rows the fixture parse rejects", () => {
  const usable = {
    matchId: 7,
    homeTeam: "Home",
    awayTeam: "Away",
    kickoffTime: 1_800_000_000,
    over15Pct: 90,
    fhOver05Pct: 85,
    over25Pct: 70,
    shOver05Pct: 90,
  };
  assert.equal(footyRowCoreSchema.safeParse(usable).success, true);

  // Each defect the contract exists to catch, one at a time.
  const defects: Array<Partial<typeof usable>> = [
    { matchId: 0 },
    { matchId: -1 },
    { matchId: 1.5 },
    { homeTeam: "" },
    { homeTeam: "   " },
    { awayTeam: "" },
    { kickoffTime: 0 },
    { kickoffTime: -1 },
    { over15Pct: Number.NaN },
    { fhOver05Pct: Number.POSITIVE_INFINITY },
    { over25Pct: -1 },
    { shOver05Pct: 101 },
  ];
  for (const defect of defects) {
    const row = { ...usable, ...defect };
    assert.equal(
      footyRowCoreSchema.safeParse(row).success,
      false,
      `expected ${JSON.stringify(defect)} to fail validation`
    );
  }
});

test("the fixture parse extends the same core contract rather than restating it", () => {
  // If the two ever diverged, `validated` would count a population the fixture parse does not
  // accept — a measured number describing nothing. Guarded at the source.
  const src = readFileSync(
    path.join(process.cwd(), "lib/research/qualifiedFixture.ts"),
    "utf8"
  );
  assert.match(src, /footyRowCoreSchema\.extend\(/);
  for (const field of ["matchId", "homeTeam", "awayTeam", "kickoffTime", "over15Pct"]) {
    assert.doesNotMatch(
      src,
      new RegExp(`${field}:\\s*z\\.`),
      `${field} must be constrained once, in footyRowContract`
    );
  }
});

/* ------------------------------------------------------------------ *
 * The funnel's last research number is what the homepage shows
 * ------------------------------------------------------------------ */

/**
 * `RankWagersHome` renders from `mapDailyListsToQualifiedFixtures`, which parses every row through
 * `footyRowSchema` — an extension of the same core contract — and drops what fails. If the funnel
 * counted rows that parse drops, it would claim more qualified fixtures than the page displays,
 * and rwdesign §21 requires every visible number to be explainable.
 *
 * This equality is the contract, not an implementation detail.
 */
function distinctRenderedFixtures(l: DailyMatchLists): number {
  return new Set(mapDailyListsToQualifiedFixtures(l).map((f) => f.matchId)).size;
}

test("qualified equals the distinct fixtures the homepage actually renders", () => {
  const l = lists({
    over25: [
      row({ matchId: 1, over25Pct: 88 }),
      row({ matchId: 2, over25Pct: 91 }),
      row({ matchId: 3, over25Pct: 77 }),
    ],
  });

  const model = buildHomepageHeroModel({ locale: "en", lists: l });
  assert.equal(model.funnel.qualified, distinctRenderedFixtures(l));
  assert.equal(model.funnel.qualified, 3);
});

test("a row the render drops is counted out of qualified", () => {
  // Blank away name: present in the lists, dropped by the fixture parse, so invisible on the page.
  const l = lists({
    over25: [
      row({ matchId: 1, over25Pct: 88 }),
      row({ matchId: 2, over25Pct: 91, awayTeam: "" }),
    ],
  });

  const model = buildHomepageHeroModel({ locale: "en", lists: l });
  assert.equal(distinctRenderedFixtures(l), 1);
  assert.equal(model.funnel.qualified, 1, "funnel must not claim a fixture the page cannot show");
});

test("the equality holds across every defect the contract rejects", () => {
  const defects: Array<Partial<FootyMatchRow>> = [
    { homeTeam: "" },
    { awayTeam: "   " },
    { kickoffTime: 0 },
    { over25Pct: 101 },
    { over15Pct: Number.NaN },
  ];

  for (const defect of defects) {
    const l = lists({
      over25: [
        row({ matchId: 1, over25Pct: 88 }),
        row({ matchId: 2, over25Pct: 91, ...defect }),
      ],
    });
    const model = buildHomepageHeroModel({ locale: "en", lists: l });
    assert.equal(
      model.funnel.qualified,
      distinctRenderedFixtures(l),
      `qualified must match the rendered count for ${JSON.stringify(defect)}`
    );
  }
});

test("a fixture in several lists counts once in both the funnel and the render", () => {
  const l = lists({
    over15: [row({ matchId: 1, over15Pct: 95 })],
    over25: [row({ matchId: 1, over25Pct: 88 })],
    fh: [row({ matchId: 1, fhOver05Pct: 90 })],
  });

  const model = buildHomepageHeroModel({ locale: "en", lists: l });
  assert.equal(model.funnel.qualified, 1);
  assert.equal(model.funnel.qualified, distinctRenderedFixtures(l));
});

/* ------------------------------------------------------------------ *
 * The last link: featured is what renders, drawn from qualified
 * ------------------------------------------------------------------ */

test("featured equals the rendered pick count", () => {
  const l = lists({
    over25: [70, 90, 50, 30].map((pct, i) => row({ matchId: i + 1, over25Pct: pct })),
  });
  const model = buildHomepageHeroModel({ locale: "en", lists: l });

  assert.equal(model.funnel.featured, model.picks.length);
  assert.equal(model.funnel.featured, 4);
});

test("every rendered pick is among the fixtures the page can show", () => {
  const l = lists({
    over25: [
      row({ matchId: 1, over25Pct: 88 }),
      // Nonsense kickoff: dropped by the research feed, so it must not reach the hero either.
      row({ matchId: 2, over25Pct: 99, kickoffTime: 0 }),
      row({ matchId: 3, over25Pct: 77 }),
    ],
  });
  const model = buildHomepageHeroModel({ locale: "en", lists: l });
  const renderable = new Set(mapDailyListsToQualifiedFixtures(l).map((f) => f.matchId));

  // The highest-probability row is the malformed one; it must not lead the hero.
  assert.equal(model.picks.some((pick) => pick.matchId === 2), false);
  for (const pick of model.picks) {
    assert.ok(renderable.has(pick.matchId), `pick ${pick.matchId} is not renderable by the feed`);
  }
  assert.equal(model.funnel.featured, 2);
  assert.equal(model.funnel.qualified, 2);
});

test("featured never exceeds qualified", () => {
  const defects: Array<Partial<FootyMatchRow>> = [
    { kickoffTime: 0 },
    { over25Pct: 101 },
    { over15Pct: Number.NaN },
    { homeTeam: "" },
    { matchId: 2.5 },
  ];

  for (const defect of defects) {
    const l = lists({
      over25: [
        row({ matchId: 1, over25Pct: 88 }),
        row({ matchId: 2, over25Pct: 99, ...defect }),
      ],
    });
    const model = buildHomepageHeroModel({ locale: "en", lists: l });

    assert.ok(
      (model.funnel.qualified ?? 0) >= (model.funnel.featured ?? 0),
      `featured exceeded qualified for ${JSON.stringify(defect)}`
    );
    assert.equal(model.funnel.featured, model.picks.length);
  }
});

test("the cap holds: featured is at most the composition's five", () => {
  const l = lists({
    over25: Array.from({ length: 12 }, (_, i) => row({ matchId: i + 1, over25Pct: 70 + i })),
  });
  const model = buildHomepageHeroModel({ locale: "en", lists: l });

  assert.equal(model.funnel.qualified, 12);
  assert.equal(model.funnel.featured, HERO_PICK_COUNT);
  assert.ok((model.funnel.qualified ?? 0) >= (model.funnel.featured ?? 0));
});

/* ------------------------------------------------------------------ *
 * FIX PASS — the lead meta line, and the country resolver behind it
 * ------------------------------------------------------------------ */

test("the lead meta prints one date, one kickoff, and the country with the league", () => {
  const { buildLeadMeta } = require("../lib/homepage/heroModel") as typeof import("../lib/homepage/heroModel");
  /*
   * The defect this pins: the old builder appended `pick.kickoff` — which already contained the
   * formatted date — after a date of its own, so the line read "TUE 04 AUG · TUE 04 AUG, 19:00".
   * Every part now derives from the one ISO stamp, so a second date cannot be assembled.
   */
  const meta = buildLeadMeta({
    league: "LFPB",
    country: "bo",
    kickoffDateTime: "2026-08-04T19:00:00.000Z",
  });
  assert.equal(meta, "LFPB (Bolivia) · Tue 04 Aug · 19:00 UTC");
  assert.equal((meta.match(/04 Aug/g) ?? []).length, 1, "the date prints exactly once");

  // No country → the league stands alone; no parenthesis, no placeholder.
  assert.equal(
    buildLeadMeta({ league: "Kakkonen", kickoffDateTime: "2026-08-04T16:00:00.000Z" }),
    "Kakkonen · Tue 04 Aug · 16:00 UTC"
  );
  // An unparseable stamp drops the date and time, never prints "Invalid Date".
  assert.equal(
    buildLeadMeta({ league: "LFPB", country: "bo", kickoffDateTime: "not-a-date" }),
    "LFPB (Bolivia)"
  );
});

test("countryDisplay resolves codes and names, and refuses to invent", () => {
  const { countryDisplay } = require("../lib/countryDisplay") as typeof import("../lib/countryDisplay");

  /*
   * `iso`, not an emoji: the resolver yields the asset key for the self-hosted SVG. Windows
   * renders flag emoji as bare letter pairs, so the emoji path is deleted — see masterFixPass
   * for the probe that keeps it deleted.
   */
  assert.deepEqual(countryDisplay("fi"), { name: "Finland", iso: "fi" });
  assert.deepEqual(countryDisplay("UZ"), { name: "Uzbekistan", iso: "uz" });
  assert.equal(countryDisplay("Bolivia")?.name, "Bolivia", "a full name passes through as given");
  assert.equal(countryDisplay("Bolivia")?.iso, "bo", "and recovers its asset key when the name is known");
  assert.equal(countryDisplay(undefined), null, "absent stays absent");
  assert.equal(countryDisplay("  "), null);
  /*
   * An unknown code is a country this module cannot name. Printing the raw code beside a
   * placeholder glyph is the rendering this resolver exists to end, so it returns null and the
   * cell prints the league alone.
   */
  assert.equal(countryDisplay("zz"), null, "an unknown code yields nothing, not a placeholder");
});

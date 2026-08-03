import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { archiveToDailyLists, type DailyArchive } from "../lib/footystats/dailyArchive";
import { buildHomepageHeroModel } from "../lib/homepage/heroModel";
import { observedResearchRun } from "../lib/research/researchRun";
import type { ArchivedRow } from "../lib/footystats/dailyArchive";

/**
 * The archive is the permanent record (§3.11) and the funnel's history has to be auditable
 * (§3.12). Twice the size of a filter correction has been unmeasurable because the archive stored
 * only what SURVIVED the filter — the counts are what make the removed population visible after
 * the fact.
 *
 * The distinction this suite protects: the counts are persisted FOR AUDIT and are never carried
 * back onto the lists, so an archive day still renders a funnel with no analysed population.
 * Presenting a previous run's population as today's would be the fabricated observation §3.2
 * forbids.
 */

function row(matchId: number): ArchivedRow {
  return {
    matchId,
    homeTeam: "Home",
    awayTeam: "Away",
    competition: "Premier Division",
    country: "Norway",
    flag: "",
    kickoffTime: 1_800_000_000,
    kickoff: "20:00",
    over15Pct: 0,
    fhOver05Pct: 0,
    over25Pct: 95,
    shOver05Pct: 0,
    status: "complete",
    isLive: false,
    isFinished: true,
    homeScore: 2,
    awayScore: 1,
    minute: 90,
    highlightPct: 95,
    listResult: "won",
  };
}

const SUMMARY = {
  fh: { total: 0, won: 0, lost: 0, pending: 0, postponed: 0 },
  over15: { total: 0, won: 0, lost: 0, pending: 0, postponed: 0 },
  over25: { total: 1, won: 1, lost: 0, pending: 0, postponed: 0 },
  sh: { total: 0, won: 0, lost: 0, pending: 0, postponed: 0 },
};

/** An archive exactly as it was written before `researchRun` existed. No counts key at all. */
function preChangeArchive(): Record<string, unknown> {
  return {
    date: "2026-08-01",
    savedAt: "2026-08-01T23:20:00.000Z",
    summary: SUMMARY,
    fh: [],
    over15: [],
    over25: [row(1)],
    sh: [],
  };
}

/* ------------------------------------------------------------------ *
 * A pre-change archive still parses
 * ------------------------------------------------------------------ */

test("an archive written before the change round-trips unchanged", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "rw-archive-"));
  const file = path.join(dir, "2026-08-01.json");
  const original = preChangeArchive();
  writeFileSync(file, JSON.stringify(original), "utf8");

  const parsed = JSON.parse(readFileSync(file, "utf8")) as DailyArchive;

  // Every field a pre-change archive carried is still readable.
  assert.equal(parsed.date, "2026-08-01");
  assert.equal(parsed.savedAt, "2026-08-01T23:20:00.000Z");
  assert.equal(parsed.over25.length, 1);
  assert.equal(parsed.over25[0]?.matchId, 1);
  assert.equal(parsed.summary.over25.won, 1);

  // The counts are ABSENT, which is not zero and is never reconstructed.
  assert.equal("researchRun" in parsed, false);
  assert.equal(parsed.researchRun, undefined);
});

test("a pre-change archive converts to lists without inventing counts", () => {
  const lists = archiveToDailyLists(preChangeArchive() as unknown as DailyArchive);

  assert.equal(lists.date, "2026-08-01");
  assert.equal(lists.over25.length, 1);
  assert.equal(lists.researchRun, undefined);
});

/* ------------------------------------------------------------------ *
 * A post-change archive carries the counts
 * ------------------------------------------------------------------ */

test("an archive written after the change round-trips carrying its counts", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "rw-archive-"));
  const file = path.join(dir, "2026-08-03.json");
  const written: DailyArchive = {
    date: "2026-08-03",
    savedAt: "2026-08-03T23:45:00.000Z",
    summary: SUMMARY,
    fh: [],
    over15: [],
    over25: [row(7)],
    sh: [],
    researchRun: observedResearchRun({
      analysed: 238,
      validated: 231,
      inScope: 214,
      qualified: 18,
      fetchedAt: "2026-08-03T09:15:00.000Z",
    }),
  };
  writeFileSync(file, JSON.stringify(written), "utf8");

  const parsed = JSON.parse(readFileSync(file, "utf8")) as DailyArchive;

  assert.equal(parsed.researchRun?.analysed, 238);
  assert.equal(parsed.researchRun?.validated, 231);
  assert.equal(parsed.researchRun?.inScope, 214);
  assert.equal(parsed.researchRun?.qualified, 18);
  // Never observed by the pipeline, so it survives the round trip as null rather than as 0.
  assert.equal(parsed.researchRun?.featured, null);
  // The rule identifiers travel with the counts, so a later audit can see WHICH rules produced them.
  assert.equal(parsed.researchRun?.rules.inScope, "exclude_cup_competitions");
  assert.equal(parsed.researchRun?.rules.validated, "schema_validation");
});

test("the persisted counts survive JSON exactly — no key is dropped or coerced", () => {
  const run = observedResearchRun({ analysed: 0, validated: 0, inScope: 0, qualified: 0 });
  const parsed = JSON.parse(JSON.stringify(run)) as typeof run;

  // A genuine zero is an observation and must not become null on the way through.
  assert.equal(parsed.analysed, 0);
  assert.equal(parsed.validated, 0);
  assert.equal(parsed.inScope, 0);
  assert.equal(parsed.qualified, 0);
  assert.equal(parsed.featured, null);
});

/* ------------------------------------------------------------------ *
 * Reading an archive still omits the counts from the funnel
 * ------------------------------------------------------------------ */

test("an archive's counts are stored for audit and never reach the hero funnel", () => {
  const archive: DailyArchive = {
    date: "2026-08-03",
    savedAt: "2026-08-03T23:45:00.000Z",
    summary: SUMMARY,
    fh: [],
    over15: [],
    over25: [row(7)],
    sh: [],
    researchRun: observedResearchRun({ analysed: 238, validated: 231, inScope: 214 }),
  };

  const lists = archiveToDailyLists(archive);
  // The conversion drops them deliberately: they describe the run that built the day, not this one.
  assert.equal(lists.researchRun, undefined);

  const model = buildHomepageHeroModel({ locale: "en", lists });
  // The hero shows exactly what it showed before this change — an archive day has no population.
  assert.equal(model.funnel.analysed, null);
  assert.equal(model.funnel.validated, null);
  assert.equal(model.funnel.inScope, null);
  // What IS observable from the lists in hand stays observable.
  assert.equal(model.funnel.qualified, 1);
  assert.equal(model.funnel.featured, 1);
});

test("the archive module records why the counts are not wired through", () => {
  // A later reader must not "helpfully" carry them into the hero.
  const source = readFileSync(
    path.join(process.cwd(), "lib/footystats/dailyArchive.ts"),
    "utf8"
  );
  assert.match(source, /FOR AUDIT, NOT FOR RENDERING/);
  assert.match(source, /deliberately NOT carried across/);
});

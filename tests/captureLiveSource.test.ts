import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  assertLiveSource,
  normalizeDailyArchive,
  normalizeDailyLists,
} from "../lib/evidence-capture/source";
import type { DailyMatchLists, FootyMatchRow } from "../lib/footystats/types";

/**
 * Capture's source must be the LIVE daily lists, not the day's archive.
 *
 * THE DEFECT. `mergeArchiveFromLists` writes a date's archive only once one of its fixtures has
 * FINISHED. Capture runs in the 60 minutes BEFORE kickoff. So the archive-backed loader returned
 * an empty source every morning until the day's first match ended: every morning fire discovered
 * 0, and the first kickoffs of any day were structurally uncapturable. An evening test cannot see
 * this — by then the archive exists, which is exactly why the earlier verification passed.
 */

function row(matchId: number, kickoff: string): FootyMatchRow {
  return {
    matchId,
    homeTeam: `Home ${matchId}`,
    awayTeam: `Away ${matchId}`,
    competition: "Test League",
    country: "Testland",
    flag: "",
    kickoffTime: Math.floor(new Date(kickoff).getTime() / 1000),
    kickoff,
    over15Pct: 88,
    fhOver05Pct: 82,
    over25Pct: 71,
    shOver05Pct: 79,
    status: "incomplete",
    isLive: false,
    // The whole point: NOTHING has finished. This is a morning board.
    isFinished: false,
    homeScore: 0,
    awayScore: 0,
    minute: 0,
    highlightPct: 88,
  };
}

function morningLists(date = "2026-08-04"): DailyMatchLists {
  const rows = [row(9001, `${date}T09:30:00.000Z`), row(9002, `${date}T11:00:00.000Z`)];
  return {
    date,
    over15: rows,
    fh: rows,
    over25: rows,
    sh: rows,
    fetchedAt: `${date}T08:00:00.000Z`,
    provenance: { source: "fresh_provider", requestedDate: date },
  };
}

/* -- the defect, and the fix -------------------------------------------------- */

test("a morning with an unwritten archive discovers today's fixtures from the lists", () => {
  const lists = morningLists();
  const fromLists = normalizeDailyLists(lists);
  assert.ok(
    fromLists.length > 0,
    "a board with no finished fixture must still yield capture candidates"
  );
  for (const p of fromLists) {
    assert.ok(Number.isInteger(p.fixtureId) && p.fixtureId > 0);
    assert.ok(p.kickoffAt, "a candidate without a kickoff cannot be windowed");
  }
});

test("the same morning through the archive path yields nothing — the original defect", () => {
  // The archive does not exist yet, because nothing has finished. This is what capture was fed.
  assert.deepEqual(normalizeDailyArchive(null), []);
  // And the live path, on the very same morning, does not.
  assert.notEqual(normalizeDailyLists(morningLists()).length, 0);
});

test("the capture pipeline defaults to the live loader, never the archive one", () => {
  const src = readFileSync(
    path.join(process.cwd(), "lib/evidence-capture/candidates/capture-pipeline.ts"),
    "utf8"
  );
  assert.match(src, /deps\.loadSource \?\? loadLiveDailyPredictions/);
  assert.equal(
    src.includes("loadPublishedDailyPredictions"),
    false,
    "the archive loader must not be capture's default source"
  );
});

/* -- fail-closed: never a silent fallback ------------------------------------- */

test("a failed live fetch fails the pass rather than falling back", () => {
  assert.throws(
    () => assertLiveSource({ error: "circuit_open" }, "2026-08-04"),
    /live daily lists unavailable.*circuit_open/,
    "a provider failure must surface, not degrade to the archive"
  );
});

test("a stale archive fallback is refused for capture", () => {
  const stale = {
    ...morningLists(),
    provenance: {
      source: "stale_daily_archive" as const,
      requestedDate: "2026-08-04",
      archiveCapturedAt: "2026-08-03T22:00:00.000Z",
      archiveAgeSeconds: 40000,
    },
  };
  assert.throws(
    () => assertLiveSource(stale, "2026-08-04"),
    /refusing a non-live source/,
    "a stale source presented as today would capture against kickoffs already past"
  );
});

test("an unavailable source is refused", () => {
  const gone = {
    ...morningLists(),
    provenance: { source: "unavailable" as const, requestedDate: "2026-08-04" },
  };
  assert.throws(() => assertLiveSource(gone, "2026-08-04"), /refusing a non-live source/);
});

test("fresh provider lists pass, including a legitimately empty day", () => {
  const lists = morningLists();
  assert.equal(assertLiveSource(lists, "2026-08-04"), lists);

  // An empty board is a FACT, not a failure. It must return [], never throw.
  const empty: DailyMatchLists = {
    date: "2026-08-04",
    over15: [],
    fh: [],
    over25: [],
    sh: [],
    fetchedAt: "2026-08-04T08:00:00.000Z",
    provenance: { source: "fresh_provider", requestedDate: "2026-08-04" },
  };
  assert.equal(assertLiveSource(empty, "2026-08-04"), empty);
  assert.deepEqual(normalizeDailyLists(empty), []);
});

test("absent provenance is treated as live, not as stale", () => {
  // Every stored archive predates the field and the fallback path always sets it, so absence
  // means "not recorded" rather than "stale". Refusing it would fail every pass.
  const noProv = { ...morningLists(), provenance: undefined };
  assert.equal(assertLiveSource(noProv, "2026-08-04"), noProv);
});

/* -- the settlement source is untouched --------------------------------------- */

test("settlement still reads the archive — finished matches are what it holds", () => {
  const src = readFileSync(
    path.join(process.cwd(), "lib/evidence-capture/candidates/settlement-pipeline.ts"),
    "utf8"
  );
  assert.equal(
    src.includes("loadLiveDailyPredictions"),
    false,
    "settlement must not switch to the live source"
  );
});

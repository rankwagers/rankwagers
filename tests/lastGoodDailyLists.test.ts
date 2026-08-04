import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  loadLastGoodLists,
  saveLastGoodLists,
  lastGoodDir,
} from "../lib/footystats/lastGoodLists";
import { assertLiveSource } from "../lib/evidence-capture/source";
import type { DailyMatchLists, FootyMatchRow } from "../lib/footystats/types";
import { observedResearchRun } from "../lib/research/researchRun";

/**
 * Last-good serving: the reader sees the last real board instead of a blank page.
 *
 * The same-day archive fallback cannot cover a morning outage — `mergeArchiveFromLists` writes a
 * date's archive only after one of its fixtures has FINISHED. This layer covers that window, and
 * is a DISPLAY fallback only: capture must still refuse it.
 */

const DATE = "2026-08-04";

function row(matchId: number): FootyMatchRow {
  return {
    matchId,
    homeTeam: `Home ${matchId}`,
    awayTeam: `Away ${matchId}`,
    competition: "Test League",
    country: "Testland",
    flag: "",
    kickoffTime: Math.floor(new Date(`${DATE}T18:00:00.000Z`).getTime() / 1000),
    kickoff: `${DATE}T18:00:00.000Z`,
    over15Pct: 88,
    fhOver05Pct: 82,
    over25Pct: 71,
    shOver05Pct: 79,
    status: "incomplete",
    isLive: false,
    isFinished: false,
    homeScore: 0,
    awayScore: 0,
    minute: 0,
    highlightPct: 88,
  };
}

function lists(date = DATE, fetchedAt = `${date}T08:14:00.000Z`): DailyMatchLists {
  const rows = [row(7001), row(7002)];
  return {
    date,
    fh: rows,
    over15: rows,
    over25: rows,
    sh: rows,
    fetchedAt,
    provenance: { source: "fresh_provider", requestedDate: date },
    researchRun: observedResearchRun({
      analysed: 120,
      validated: 96,
      qualified: 12,
      featured: 4,
    }),
  };
}

function tmpEnv() {
  const dir = mkdtempSync(path.join(os.tmpdir(), "rw-lastgood-"));
  return { env: { DAILY_LISTS_LAST_GOOD_DIR: dir } as NodeJS.ProcessEnv, dir };
}

/* -- provider down + snapshot present --------------------------------------- */

test("provider down with a snapshot present serves it, with its TRUE fetchedAt", async () => {
  const { env, dir } = tmpEnv();
  try {
    const good = lists();
    await saveLastGoodLists(good, env);

    const result = await loadLastGoodLists(DATE, "rate_limited", env);
    assert.equal(result.used, true);
    if (!result.used) return;

    // The rows come back.
    assert.equal(result.lists.fh.length, 2);
    assert.equal(result.lists.date, DATE);

    // The retrieval time is the ORIGINAL one. Restamping it to now would make the page claim a
    // freshness it does not have, and that line is the whole honesty mechanism.
    assert.equal(result.lists.fetchedAt, `${DATE}T08:14:00.000Z`);

    // Provenance marks it, and carries why the provider was not used.
    assert.equal(result.lists.provenance?.source, "last_good");
    assert.equal(result.lists.provenance?.providerFailureReasonCode, "rate_limited");

    // researchRun travels with the snapshot.
    assert.ok(result.lists.researchRun, "the run observation must survive the round trip");
    assert.equal(result.lists.researchRun?.qualified, 12);
    assert.equal(result.lists.researchRun?.featured, 4);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("every success overwrites the snapshot", async () => {
  const { env, dir } = tmpEnv();
  try {
    await saveLastGoodLists(lists(DATE, `${DATE}T08:00:00.000Z`), env);
    await saveLastGoodLists(lists(DATE, `${DATE}T09:30:00.000Z`), env);
    const result = await loadLastGoodLists(DATE, "timeout", env);
    assert.equal(result.used, true);
    if (!result.used) return;
    assert.equal(result.lists.fetchedAt, `${DATE}T09:30:00.000Z`, "the newer success wins");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the stored snapshot does not carry its own provenance", async () => {
  const { env, dir } = tmpEnv();
  try {
    await saveLastGoodLists(lists(), env);
    const onDisk = JSON.parse(
      readFileSync(path.join(dir, `${DATE}.json`), "utf8")
    ) as Record<string, unknown>;
    // Provenance describes how a RESPONSE was obtained; the serving path stamps its own. Storing
    // `fresh_provider` would let a replayed snapshot claim it came from the provider just now.
    assert.equal("provenance" in onDisk, false);
    assert.equal(onDisk.fetchedAt, `${DATE}T08:14:00.000Z`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/* -- yesterday's lists never wear today's date ------------------------------- */

test("a prior-day snapshot is never served for today", async () => {
  const { env, dir } = tmpEnv();
  try {
    // Yesterday's board, saved under yesterday's key — the ordinary case.
    await saveLastGoodLists(lists("2026-08-03", "2026-08-03T20:00:00.000Z"), env);
    const result = await loadLastGoodLists(DATE, "rate_limited", env);
    assert.equal(result.used, false);
    assert.equal(result.used === false && result.reason, "missing");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a snapshot whose stored date disagrees with its filename is refused", async () => {
  const { env, dir } = tmpEnv();
  try {
    mkdirSync(dir, { recursive: true });
    // A file named for today holding yesterday's board — the exact shape that would put stale
    // fixtures under today's heading. The filename is not trusted on its own.
    writeFileSync(
      path.join(dir, `${DATE}.json`),
      JSON.stringify({ ...lists("2026-08-03"), provenance: undefined }),
      "utf8"
    );
    const result = await loadLastGoodLists(DATE, "rate_limited", env);
    assert.equal(result.used, false);
    assert.equal(result.used === false && result.reason, "wrong_date");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/* -- first boot, and unusable snapshots -------------------------------------- */

test("first-ever boot with no snapshot falls through to the empty-day copy", async () => {
  const { env, dir } = tmpEnv();
  try {
    const result = await loadLastGoodLists(DATE, "rate_limited", env);
    assert.equal(result.used, false);
    assert.equal(result.used === false && result.reason, "missing");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a stored empty day is not served — it is no better than the empty-day copy", async () => {
  const { env, dir } = tmpEnv();
  try {
    const empty: DailyMatchLists = {
      date: DATE,
      fh: [],
      over15: [],
      over25: [],
      sh: [],
      fetchedAt: `${DATE}T08:00:00.000Z`,
    };
    await saveLastGoodLists(empty, env);
    const result = await loadLastGoodLists(DATE, "rate_limited", env);
    assert.equal(result.used, false);
    assert.equal(result.used === false && result.reason, "empty");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a corrupt snapshot is refused, not repaired", async () => {
  const { env, dir } = tmpEnv();
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, `${DATE}.json`), "{ not json", "utf8");
    const result = await loadLastGoodLists(DATE, "rate_limited", env);
    assert.equal(result.used, false);
    assert.equal(result.used === false && result.reason, "unreadable");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a failed write never throws — a good response must not be turned into a failure", async () => {
  // A regular FILE standing where the directory should be: mkdir fails with ENOTDIR immediately.
  const base = mkdtempSync(path.join(os.tmpdir(), "rw-lastgood-blocked-"));
  const blocked = path.join(base, "not-a-dir");
  writeFileSync(blocked, "x", "utf8");
  try {
    await saveLastGoodLists(lists(), {
      DAILY_LISTS_LAST_GOOD_DIR: blocked,
    } as NodeJS.ProcessEnv);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("the shared directory is the production default, not a release-local one", () => {
  assert.equal(
    lastGoodDir({ NODE_ENV: "production" } as NodeJS.ProcessEnv),
    "/opt/rankwagers/shared/daily-lists-last-good",
    "the snapshot must survive a deploy swap — that is when a cold cache bites"
  );
});

/* -- capture is excluded ----------------------------------------------------- */

test("capture refuses a last_good serving", async () => {
  const { env, dir } = tmpEnv();
  try {
    await saveLastGoodLists(lists(), env);
    const result = await loadLastGoodLists(DATE, "rate_limited", env);
    assert.equal(result.used, true);
    if (!result.used) return;

    // This is a DISPLAY fallback. Capture mints permanent snapshots and must never do so from a
    // replayed board — its kickoff times may already have passed.
    assert.throws(
      () => assertLiveSource(result.lists, DATE),
      /refusing a non-live source.*last_good/,
      "capture must refuse the display fallback"
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/* -- the serving chain and the surfaces that read it ------------------------- */

test("last_good is tried before the archive fallback", () => {
  const src = readFileSync(
    path.join(process.cwd(), "lib/footystats/client.ts"),
    "utf8"
  );
  const lastGood = src.indexOf("loadLastGoodLists(d");
  const archive = src.indexOf("loadSameDayArchiveFallback(d");
  assert.ok(lastGood > 0 && archive > 0);
  assert.ok(
    lastGood < archive,
    "the archive only exists once a fixture has finished; last-good covers the morning"
  );
});

test("only a genuinely fresh board is persisted", () => {
  const src = readFileSync(path.join(process.cwd(), "lib/footystats/client.ts"), "utf8");
  assert.match(src, /=== "fresh_provider"\) \{\s*\n\s*void saveLastGoodLists\(fresh\);/);
});

test("a last_good serving is disclosed on the page and withheld from the live feed", () => {
  const home = readFileSync(
    path.join(process.cwd(), "components/bible/RankWagersHome.tsx"),
    "utf8"
  );
  assert.match(home, /source === "last_good"/, "the page must state that it is not live");
  assert.match(home, /formatArchiveCaptureTime\(lists\.fetchedAt\)/);

  const feed = readFileSync(
    path.join(process.cwd(), "app/api/live-feed/route.ts"),
    "utf8"
  );
  assert.match(
    feed,
    /source === "last_good"/,
    "a replayed board must not feed a present-tense live surface"
  );
});

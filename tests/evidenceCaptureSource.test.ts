import assert from "node:assert/strict";
import test from "node:test";

import {
  MARKET_SELECTION_BY_KIND,
  kindForMarketKey,
  marketSelectionForKind,
} from "../lib/evidence-capture/markets";
import {
  captureWindowKey,
  numericFixtureId,
} from "../lib/evidence-capture/identity";
import { normalizeDailyArchive } from "../lib/evidence-capture/source";
import type { DailyArchive, ArchivedRow } from "../lib/footystats/dailyArchive";
import type { MatchListKind } from "../lib/footystats/types";

/**
 * Sprint 23B — Phase 2 (capture source discovery & stable identity).
 *
 * Acceptance: given a fixed daily archive, discovery is deterministic and returns
 * a stable numeric id + market/selection + window key per prediction across
 * repeated calls. Every expected value was produced by executing the code.
 */

// ---- markets.ts -----------------------------------------------------------

test("MatchListKind maps 1:1 to (marketKey, selectionKey), always over", () => {
  assert.deepEqual(marketSelectionForKind("fh"), {
    marketKey: "fh",
    selectionKey: "over",
  });
  assert.deepEqual(marketSelectionForKind("over15"), {
    marketKey: "over15",
    selectionKey: "over",
  });
  assert.deepEqual(marketSelectionForKind("over25"), {
    marketKey: "over25",
    selectionKey: "over",
  });
  assert.deepEqual(marketSelectionForKind("sh"), {
    marketKey: "sh",
    selectionKey: "over",
  });
  for (const kind of Object.keys(MARKET_SELECTION_BY_KIND) as MatchListKind[]) {
    assert.equal(MARKET_SELECTION_BY_KIND[kind].selectionKey, "over");
  }
});

test("reverse market lookup round-trips and rejects unknown keys", () => {
  for (const kind of Object.keys(MARKET_SELECTION_BY_KIND) as MatchListKind[]) {
    const { marketKey } = marketSelectionForKind(kind);
    assert.equal(kindForMarketKey(marketKey), kind);
  }
  assert.equal(kindForMarketKey("btts"), null);
  assert.equal(kindForMarketKey(""), null);
});

// ---- identity.ts ----------------------------------------------------------

test("numericFixtureId returns matchId and rejects non-positive integers", () => {
  assert.equal(numericFixtureId({ matchId: 90231 }), 90231);
  for (const bad of [0, -1, 1.5, Number.NaN]) {
    assert.throws(() => numericFixtureId({ matchId: bad }), /positive integer/);
  }
});

test("captureWindowKey is deterministic and window = [kickoff-lead, kickoff)", () => {
  const input = {
    fixtureId: 90231,
    kickoffAt: "2026-08-01T18:00:00.000Z",
    leadMinutes: 60,
  };
  const a = captureWindowKey(input);
  const b = captureWindowKey(input);
  assert.deepEqual(a, b, "same inputs must yield an identical window");
  assert.equal(a.windowStart, "2026-08-01T17:00:00.000Z");
  assert.equal(a.windowEnd, "2026-08-01T18:00:00.000Z");
  assert.equal(a.quantizedCapturedAt, "2026-08-01T17:00:00.000Z");
  assert.equal(a.key, "90231|2026-08-01T17:00:00.000Z");

  // a different lead moves the window → a different key (config change ≠ rewrite)
  const wider = captureWindowKey({ ...input, leadMinutes: 90 });
  assert.notEqual(wider.key, a.key);
  assert.equal(wider.windowStart, "2026-08-01T16:30:00.000Z");
  assert.equal(wider.windowEnd, a.windowEnd);
});

test("captureWindowKey validates kickoff and lead", () => {
  assert.throws(
    () =>
      captureWindowKey({
        fixtureId: 1,
        kickoffAt: "not-a-date",
        leadMinutes: 60,
      }),
    /invalid kickoffAt/
  );
  for (const lead of [0, -5, 1.5]) {
    assert.throws(
      () =>
        captureWindowKey({
          fixtureId: 1,
          kickoffAt: "2026-08-01T18:00:00.000Z",
          leadMinutes: lead,
        }),
      /positive integer/
    );
  }
});

// ---- source.ts ------------------------------------------------------------

function makeRow(matchId: number, kickoffTime: number): ArchivedRow {
  return {
    matchId,
    homeTeam: `Home ${matchId}`,
    awayTeam: `Away ${matchId}`,
    competition: "English Premier League",
    country: "England",
    countryCode: "ENG",
    flag: "🏴",
    kickoffTime,
    kickoff: "kick",
    over15Pct: 80,
    fhOver05Pct: 55,
    over25Pct: 62,
    shOver05Pct: 58,
    status: "scheduled",
    isLive: false,
    isFinished: false,
    homeScore: 0,
    awayScore: 0,
    minute: 0,
    highlightPct: 62,
    listResult: "pending",
  };
}

function fixtureArchive(): DailyArchive {
  const kickoff = 1_785_000_000; // fixed unix seconds → stable ISO
  const summaryTab = { total: 1, won: 0, lost: 0, pending: 1, postponed: 0 };
  return {
    date: "2026-07-25",
    savedAt: "2026-07-25T09:00:00.000Z",
    summary: {
      fh: summaryTab,
      over15: summaryTab,
      over25: summaryTab,
      sh: summaryTab,
    },
    fh: [makeRow(1001, kickoff)],
    over15: [makeRow(1002, kickoff)],
    over25: [makeRow(1003, kickoff)],
    sh: [makeRow(1004, kickoff)],
  };
}

test("normalizeDailyArchive is deterministic and daily-list only", () => {
  const archive = fixtureArchive();
  const first = normalizeDailyArchive(archive);
  const second = normalizeDailyArchive(archive);
  assert.deepEqual(first, second, "repeated calls must be identical");

  // one prediction per tab, in fh → over15 → over25 → sh order
  assert.deepEqual(
    first.map((p) => p.marketKind),
    ["fh", "over15", "over25", "sh"]
  );
  assert.deepEqual(
    first.map((p) => p.fixtureId),
    [1001, 1002, 1003, 1004]
  );

  const over25 = first.find((p) => p.marketKind === "over25");
  assert.ok(over25);
  assert.equal(over25.fixtureId, 1003);
  assert.equal(over25.marketKey, "over25");
  assert.equal(over25.selectionKey, "over");
  assert.equal(over25.modelProbabilityPct, 62);
  assert.equal(over25.kickoffAt, new Date(1_785_000_000 * 1000).toISOString());
  assert.equal(over25.leagueCode, "EPL");
});

test("normalizeDailyArchive returns empty for a missing archive", () => {
  assert.deepEqual(normalizeDailyArchive(null), []);
});

test("source id + window compose into a stable capture identity", () => {
  const [prediction] = normalizeDailyArchive(fixtureArchive());
  assert.ok(prediction);
  const window = captureWindowKey({
    fixtureId: prediction.fixtureId,
    kickoffAt: prediction.kickoffAt,
    leadMinutes: 60,
  });
  const again = captureWindowKey({
    fixtureId: prediction.fixtureId,
    kickoffAt: prediction.kickoffAt,
    leadMinutes: 60,
  });
  assert.equal(window.key, again.key);
  assert.equal(window.windowEnd, prediction.kickoffAt);
});

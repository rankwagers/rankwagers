import assert from "node:assert/strict";
import test from "node:test";

import { buildAutoFillPicks, buildEditorBandPicks } from "../lib/v3/editorPicks.server";
import { emptyLists } from "../lib/footystats/client";
import { predictionsEn } from "../lib/translations/predictionsEn";
import type { DailyMatchLists, FootyMatchRow } from "../lib/footystats/types";
import type { MatchDetailPublic, VenueSideStats } from "../lib/footystats/matchDetail";

/**
 * V3 POLISH 2, GROUP 1 — the band-fill probe on the LIVE TABLE SHAPE.
 *
 * The incident: a board full of n≥9 rows and no band, because auto-fill
 * drew only from the ranked section's six fixtures and none of the six
 * yielded a list-kind lead. The probe reconstructs that day: the six
 * HIGHEST provider-potential fixtures are statistically flat (no signal
 * clears the engine's bar), the strong venue records sit BELOW them in
 * the ranking — and the band must still fill from the deeper pool.
 */

function row(matchId: number, pct: number): FootyMatchRow {
  return {
    matchId,
    homeTeam: `Home ${matchId}`,
    awayTeam: `Away ${matchId}`,
    kickoffTime: 1_800_000_000 + matchId,
    over15Pct: pct,
    fhOver05Pct: pct - 5,
    over25Pct: pct - 10,
    shOver05Pct: pct - 8,
    competition: "Probe League",
  } as unknown as FootyMatchRow;
}

function stat(hits: number, played: number) {
  return { hits, played, pct: played ? Math.round((hits / played) * 100) : 0 };
}

function venue(strong: boolean): VenueSideStats {
  // Strong: 10/11 over15 against a 60% league — clears the lead bar.
  // Flat: 6/11 against 60% — |rate−baseline| ≈ 0, nothing ranks.
  const over15 = strong ? stat(10, 11) : stat(6, 11);
  return {
    played: 11,
    over15,
    over25: strong ? stat(9, 11) : stat(6, 11),
    over35: stat(3, 11),
    fh05: stat(7, 11),
    sh05: stat(7, 11),
    btts: stat(6, 11),
    cleanSheets: stat(3, 11),
    failedToScore: stat(2, 11),
    scoredAvg: 1.5,
    concededAvg: 1.1,
  } as VenueSideStats;
}

function detail(matchId: number, strong: boolean): MatchDetailPublic {
  return {
    matchId,
    homeTeam: `Home ${matchId}`,
    awayTeam: `Away ${matchId}`,
    homeAtHome: venue(strong),
    awayAtAway: venue(false),
    matchPotential: { over15: 70, over25: 55, fh05: 60, sh05: 62 },
    leagueSeason: {
      played: 120,
      avgGoals: 2.6,
      over15: 60,
      over25: 50,
      fh05: 58,
      sh05: 60,
      btts: 50,
    },
    history: { homeAtHome: [], awayAtAway: [], headToHead: [] },
    ai: null,
  } as unknown as MatchDetailPublic;
}

/*
 * Fixtures 1–6 carry the TOP provider potentials (90…85) but flat venue
 * records; fixtures 7–9 sit lower (80…78) with strong records. Under the
 * old six-fixture cap the band was empty; now it must hold picks 7–9.
 */
const FLAT_IDS = [1, 2, 3, 4, 5, 6];
const STRONG_IDS = [7, 8, 9];

function board(): DailyMatchLists {
  const lists = emptyLists();
  return {
    ...lists,
    over15: [
      ...FLAT_IDS.map((id, i) => row(id, 90 - i)),
      ...STRONG_IDS.map((id, i) => row(id, 80 - i)),
    ],
  };
}

const loadDetails = (async (ids: number[]) =>
  new Map(ids.map((id) => [id, detail(id, STRONG_IDS.includes(id))]))) as never;

test("auto-fill scans past the ranked six: strong picks emerge from deeper in the board", async () => {
  const picks = await buildAutoFillPicks({
    lists: board(),
    locale: "en" as never,
    country: null,
    p: predictionsEn as never,
    loadDetails,
  });
  assert.ok(picks.length >= 2, `expected ≥2 picks from the deep pool, got ${picks.length}`);
  for (const pick of picks) {
    assert.ok(STRONG_IDS.includes(pick.matchId), "picks come from the strong fixtures");
    assert.equal(pick.isManual, false);
    assert.match(pick.sample, /^\d+\/\d+$/, "every card number is sample-backed");
  }
});

test("the band renders at ≥2 picks and hides below two — never a one-card band", async () => {
  process.env.EDITOR_PICKS_DIR = "/tmp/definitely-missing-editor-picks-dir";
  const filled = await buildEditorBandPicks({
    lists: board(),
    locale: "en" as never,
    country: null,
    p: predictionsEn as never,
    loadDetails,
  });
  assert.ok(filled.length >= 2 && filled.length <= 4, `band holds 2–4, got ${filled.length}`);

  // One strong fixture only → a single pick → the band is omitted whole.
  const thin = {
    ...board(),
    over15: [...FLAT_IDS.map((id, i) => row(id, 90 - i)), row(7, 80)],
  };
  const single = await buildEditorBandPicks({
    lists: thin,
    locale: "en" as never,
    country: null,
    p: predictionsEn as never,
    loadDetails,
  });
  assert.equal(single.length, 0, "a single qualifying pick renders no band");
  delete process.env.EDITOR_PICKS_DIR;
});

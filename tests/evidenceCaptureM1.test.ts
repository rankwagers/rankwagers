import assert from "node:assert/strict";
import test from "node:test";

import {
  CANONICAL_MARKETS,
  CANONICAL_MARKET_KEYS,
  CANONICAL_SELECTION_KEYS,
  allowedSelectionsFor,
  canonicalForListKind,
  isCanonicalMarketKey,
  isCanonicalPairing,
  isCanonicalSelectionKey,
  isListKind,
  listKindForMarketKey,
  marketLabel,
  selectionLabel,
} from "../lib/evidence-capture/keys";
import {
  captureId,
  captureWindowKey,
  isValidFixtureId,
  isValidInstant,
  numericFixtureId,
} from "../lib/evidence-capture/identity";
import {
  archiveMarketLabel,
  archiveSelectionLabel,
} from "../lib/archive/markets";
import type { MatchListKind } from "../lib/footystats/types";

/**
 * Sprint 23B — Milestone M1 (canonical key registry + capture-identity primitives).
 *
 * Deterministic and hermetic: no clock, no network, no environment. Every expected
 * value was produced by executing the code.
 */

// ---- Canonical registry (Contract §2.B) -----------------------------------

test("canonical registries are exactly the frozen closed sets", () => {
  assert.deepEqual(
    [...CANONICAL_MARKET_KEYS],
    ["over15", "over25", "fh", "sh", "1x2", "btts"]
  );
  assert.deepEqual(
    [...CANONICAL_SELECTION_KEYS],
    ["over", "under", "home", "draw", "away", "yes", "no"]
  );
});

test("every canonical market has the frozen valid pairings and labels", () => {
  const expected: Record<string, { label: string; selections: [string, string][] }> = {
    over15: { label: "Over 1.5 Goals", selections: [["over", "Over 1.5"], ["under", "Under 1.5"]] },
    over25: { label: "Over 2.5 Goals", selections: [["over", "Over 2.5"], ["under", "Under 2.5"]] },
    fh: { label: "1st Half Over 0.5", selections: [["over", "FH Over 0.5"], ["under", "FH Under 0.5"]] },
    sh: { label: "2nd Half Over 0.5", selections: [["over", "SH Over 0.5"], ["under", "SH Under 0.5"]] },
    "1x2": { label: "Match Result", selections: [["home", "Home"], ["draw", "Draw"], ["away", "Away"]] },
    btts: { label: "Both Teams To Score", selections: [["yes", "Yes"], ["no", "No"]] },
  };
  for (const key of CANONICAL_MARKET_KEYS) {
    assert.equal(marketLabel(key), expected[key].label);
    for (const [sel, label] of expected[key].selections) {
      assert.equal(isCanonicalPairing(key, sel), true, `${key}/${sel}`);
      assert.equal(selectionLabel(key, sel), label);
    }
    assert.deepEqual(
      [...allowedSelectionsFor(key)],
      expected[key].selections.map(([s]) => s)
    );
  }
});

test("daily-list market/over labels match the existing archive labels", () => {
  for (const kind of ["fh", "over15", "over25", "sh"] as MatchListKind[]) {
    assert.equal(marketLabel(kind), archiveMarketLabel(kind));
    assert.equal(selectionLabel(kind, "over"), archiveSelectionLabel(kind));
  }
});

test("provider/list kind → canonical mapping (all four)", () => {
  assert.deepEqual(canonicalForListKind("fh"), { marketKey: "fh", selectionKey: "over" });
  assert.deepEqual(canonicalForListKind("over15"), { marketKey: "over15", selectionKey: "over" });
  assert.deepEqual(canonicalForListKind("over25"), { marketKey: "over25", selectionKey: "over" });
  assert.deepEqual(canonicalForListKind("sh"), { marketKey: "sh", selectionKey: "over" });
});

test("reverse mapping: canonical market → list kind (fail closed)", () => {
  assert.equal(listKindForMarketKey("over25"), "over25");
  assert.equal(listKindForMarketKey("fh"), "fh");
  // canonical but not a daily-list source:
  assert.equal(listKindForMarketKey("1x2"), null);
  assert.equal(listKindForMarketKey("btts"), null);
  // unknown:
  assert.equal(listKindForMarketKey("nope"), null);
});

test("unsupported / unknown values fail closed (no fuzzy matching)", () => {
  assert.equal(isCanonicalMarketKey("over15"), true);
  assert.equal(isCanonicalMarketKey("1x2"), true);
  assert.equal(isCanonicalMarketKey("Over15"), false); // no implicit normalization
  assert.equal(isCanonicalMarketKey("over_1_5"), false); // no alias
  assert.equal(isCanonicalMarketKey(""), false);
  assert.equal(isCanonicalSelectionKey("over"), true);
  assert.equal(isCanonicalSelectionKey("OVER"), false);
  assert.equal(isCanonicalPairing("1x2", "over"), false); // invalid pairing
  assert.equal(isCanonicalPairing("btts", "under"), false);
  assert.equal(isCanonicalPairing("ghost", "over"), false);
  assert.equal(isListKind("1x2"), false); // 1x2 is canonical but not a list kind
  assert.equal(canonicalForListKind("1x2"), null);
  assert.equal(canonicalForListKind("unknown"), null);
  assert.equal(marketLabel("ghost"), null);
  assert.equal(selectionLabel("over15", "home"), null);
  assert.deepEqual([...allowedSelectionsFor("ghost")], []);
});

// ---- Capture identity primitives (Contract §2.C/§3) -----------------------

test("numericFixtureId validates; predicate is non-throwing", () => {
  assert.equal(numericFixtureId({ matchId: 90231 }), 90231);
  for (const bad of [0, -1, 1.5, Number.NaN]) {
    assert.throws(() => numericFixtureId({ matchId: bad }));
    assert.equal(isValidFixtureId(bad), false);
  }
  assert.equal(isValidFixtureId(90231), true);
  assert.equal(isValidInstant("2026-08-01T18:00:00.000Z"), true);
  assert.equal(isValidInstant("not-a-date"), false);
  assert.equal(isValidInstant(""), false);
});

test("capture window boundaries are deterministic", () => {
  const w = captureWindowKey({
    fixtureId: 90231,
    kickoffAt: "2026-08-01T18:00:00.000Z",
    leadMinutes: 60,
  });
  assert.equal(w.windowStart, "2026-08-01T17:00:00.000Z"); // kickoff − lead
  assert.equal(w.windowEnd, "2026-08-01T18:00:00.000Z"); // kickoff
  assert.equal(w.quantizedCapturedAt, "2026-08-01T17:00:00.000Z");
  assert.equal(w.key, "90231|2026-08-01T17:00:00.000Z");
});

test("captureId format + same-input equality + repeated-run determinism", () => {
  const w = captureWindowKey({
    fixtureId: 90231,
    kickoffAt: "2026-08-01T18:00:00.000Z",
    leadMinutes: 60,
  });
  const id = captureId({ fixtureId: 90231, captureWindowKey: w.key });
  assert.match(id, /^cap_[0-9a-f]{24}$/);
  // same logical input → same id, across repeated offline executions
  for (let i = 0; i < 5; i++) {
    assert.equal(captureId({ fixtureId: 90231, captureWindowKey: w.key }), id);
  }
  // input-order independence of the object literal
  assert.equal(captureId({ captureWindowKey: w.key, fixtureId: 90231 }), id);
});

test("captureId differs for different canonical identity inputs", () => {
  const base = captureId({ fixtureId: 90231, captureWindowKey: "90231|2026-08-01T17:00:00.000Z" });
  const diffFixture = captureId({ fixtureId: 90232, captureWindowKey: "90232|2026-08-01T17:00:00.000Z" });
  const diffWindow = captureId({ fixtureId: 90231, captureWindowKey: "90231|2026-08-01T16:30:00.000Z" });
  assert.notEqual(base, diffFixture);
  assert.notEqual(base, diffWindow);
});

test("timezone independence: equivalent instants yield one window and one captureId", () => {
  const utc = captureWindowKey({
    fixtureId: 90231,
    kickoffAt: "2026-08-01T18:00:00.000Z",
    leadMinutes: 60,
  });
  const offset = captureWindowKey({
    fixtureId: 90231,
    kickoffAt: "2026-08-01T20:00:00+02:00", // same instant as 18:00Z
    leadMinutes: 60,
  });
  assert.deepEqual(offset, utc);
  assert.equal(
    captureId({ fixtureId: 90231, captureWindowKey: offset.key }),
    captureId({ fixtureId: 90231, captureWindowKey: utc.key })
  );
});

test("serialization round-trip of the window is identity-stable", () => {
  const w = captureWindowKey({
    fixtureId: 90231,
    kickoffAt: "2026-08-01T18:00:00.000Z",
    leadMinutes: 60,
  });
  const roundTripped = JSON.parse(JSON.stringify(w)) as typeof w;
  assert.equal(
    captureId({ fixtureId: 90231, captureWindowKey: roundTripped.key }),
    captureId({ fixtureId: 90231, captureWindowKey: w.key })
  );
});

test("malformed identity input is rejected (fail closed)", () => {
  assert.throws(() =>
    captureWindowKey({ fixtureId: 1, kickoffAt: "bad", leadMinutes: 60 })
  );
  for (const lead of [0, -5, 1.5]) {
    assert.throws(() =>
      captureWindowKey({
        fixtureId: 1,
        kickoffAt: "2026-08-01T18:00:00.000Z",
        leadMinutes: lead,
      })
    );
  }
  assert.throws(() =>
    captureId({ fixtureId: 0, captureWindowKey: "0|x" })
  );
  assert.throws(() => captureId({ fixtureId: 90231, captureWindowKey: "" }));
});

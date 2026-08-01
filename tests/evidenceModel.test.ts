import assert from "node:assert/strict";
import test from "node:test";

import {
  deriveEvidenceModel,
  qualificationReasons,
  toModelProbabilityFraction,
  type MarketInput,
} from "../lib/evidence-capture/model";

/**
 * Sprint 23B — Milestone M5 (evidence-model derivation). Pure, deterministic. Expected
 * values were computed from the frozen formulas (Contract §4.4/§4.5) + model constants.
 */

const over25 = (over: Partial<MarketInput> = {}): MarketInput => ({
  marketKey: "over25",
  selectionKey: "over",
  home: { pct: 72, played: 19 },
  away: { pct: 68, played: 19 },
  leagueBaseline: { pct: 50, played: 190 },
  modelProbabilityPct: 72,
  ...over,
});

const shOpposing: MarketInput = {
  marketKey: "sh",
  selectionKey: "over",
  home: { pct: 40, played: 16 },
  away: { pct: 46, played: 14 },
  leagueBaseline: { pct: 55, played: 190 },
  modelProbabilityPct: 40,
};

// ---- Scoring / qualification derivation ------------------------------------

test("strong qualified Over 2.5 (worked example)", () => {
  const r = deriveEvidenceModel({ fixtureId: 90231, markets: [over25()] });
  assert.ok(r.ok);
  if (!r.ok) throw new Error("unreachable");
  assert.equal(r.model.evidenceScore, 90);
  assert.equal(r.model.qualification, "qualified");
  assert.equal(r.model.sampleSize, 19);
  assert.equal(r.model.confidenceBand, "high");
  assert.equal(r.model.evidenceStrength, "strong");
  assert.deepEqual(r.model.qualificationReasons, [
    "score_ge_qualified(70)",
    "sample_ge_min(6)",
    "binding_market:over25",
  ]);
  assert.equal(r.model.supportedMarkets.length, 1);
  const sm = r.model.supportedMarkets[0];
  assert.deepEqual(
    [sm.marketKey, sm.marketLabel, sm.selectionKey, sm.selectionLabel, sm.modelProbability, sm.qualification],
    ["over25", "Over 2.5 Goals", "over", "Over 2.5", 0.72, "qualified"]
  );
  // signals are contract-valid without minting anything
  for (const s of r.model.signals) {
    assert.ok(s.weight >= 0 && s.weight <= 100);
    assert.equal(s.source, "footystats:team");
    assert.ok(["supporting", "opposing", "neutral"].includes(s.direction));
  }
});

test("provisional First-half Over 0.5 (worked example)", () => {
  const r = deriveEvidenceModel({
    fixtureId: 90231,
    markets: [{ marketKey: "fh", selectionKey: "over", home: { pct: 66, played: 16 }, away: { pct: 60, played: 14 }, leagueBaseline: { pct: 40, played: 190 }, modelProbabilityPct: 66 }],
  });
  assert.ok(r.ok);
  if (!r.ok) throw new Error("unreachable");
  assert.equal(r.model.evidenceScore, 62.31);
  assert.equal(r.model.qualification, "provisional");
  assert.equal(r.model.sampleSize, 14);
  assert.equal(r.model.confidenceBand, "moderate");
  assert.equal(r.model.evidenceStrength, "moderate");
  assert.deepEqual(r.model.qualificationReasons, [
    "score_ge_provisional(45)",
    "score_lt_qualified(70)",
    "sample_ge_min(6)",
    "binding_market:fh",
  ]);
});

test("opposing Second-half evidence → unqualified, clamped to 0", () => {
  const r = deriveEvidenceModel({ fixtureId: 90231, markets: [shOpposing] });
  assert.ok(r.ok);
  if (!r.ok) throw new Error("unreachable");
  assert.equal(r.model.evidenceScore, 0);
  assert.equal(r.model.qualification, "unqualified");
  assert.equal(r.model.confidenceBand, "insufficient");
  assert.equal(r.model.evidenceStrength, "limited");
  assert.deepEqual(r.model.signals.map((s) => s.direction), ["opposing", "opposing"]);
});

test("multi-market fixture uses the conservative binding (weak not hidden by strong)", () => {
  const r = deriveEvidenceModel({ fixtureId: 90231, markets: [over25(), shOpposing] });
  assert.ok(r.ok);
  if (!r.ok) throw new Error("unreachable");
  assert.equal(r.model.diagnostics.bindingMarketKey, "sh"); // weakest scored market binds
  assert.equal(r.model.evidenceScore, 0);
  assert.equal(r.model.qualification, "unqualified");
  assert.equal(r.model.supportedMarkets.length, 2);
  assert.equal(r.model.diagnostics.marketsScored, 2);
  // invariant §4.5: fixture qualification ≤ every scored per-market qualification
  const rank = { qualified: 3, provisional: 2, unqualified: 1, excluded: 0 } as const;
  for (const m of r.model.diagnostics.perMarket) {
    assert.ok(rank[r.model.qualification] <= rank[m.qualification]);
  }
});

// ---- Neutral band + counter signals ----------------------------------------

test("near-baseline rates are neutral (weight 0); counters oppose", () => {
  const neutral = deriveEvidenceModel({
    fixtureId: 1,
    markets: [{ marketKey: "over25", selectionKey: "over", home: { pct: 51, played: 19 }, away: { pct: 51, played: 19 }, leagueBaseline: { pct: 50, played: 190 } }],
  });
  assert.ok(neutral.ok);
  if (!neutral.ok) throw new Error("unreachable");
  assert.deepEqual(neutral.model.signals.map((s) => [s.direction, s.weight]), [["neutral", 0], ["neutral", 0]]);
  assert.equal(neutral.model.evidenceScore, 0);

  const withCounter = deriveEvidenceModel({ fixtureId: 1, markets: [over25({ counters: { home: [{ pct: 60, played: 15 }] } })] });
  assert.ok(withCounter.ok);
  if (!withCounter.ok) throw new Error("unreachable");
  assert.equal(withCounter.model.evidenceScore, 80.77); // 90 − counter 9.23
  assert.ok(withCounter.model.signals.some((s) => s.key.startsWith("counter_")));
});

// ---- Omission / diagnostics ------------------------------------------------

test("markets omitted fail-closed with reasons; a good market still derives", () => {
  const r = deriveEvidenceModel({
    fixtureId: 90231,
    markets: [
      over25(),
      { marketKey: "over15", selectionKey: "over", home: { pct: 80, played: 19 }, away: { pct: 78, played: 19 }, leagueBaseline: null },
      { marketKey: "fh", selectionKey: "over", home: { pct: 60, played: 19 }, away: { pct: 60, played: 19 }, leagueBaseline: { pct: 40, played: 10 } },
      { marketKey: "sh", selectionKey: "over", home: null, away: null, leagueBaseline: { pct: 55, played: 190 } },
      { marketKey: "1x2", selectionKey: "over", home: { pct: 50, played: 19 }, away: { pct: 50, played: 19 }, leagueBaseline: { pct: 50, played: 190 } },
    ],
  });
  assert.ok(r.ok);
  if (!r.ok) throw new Error("unreachable");
  const reasons = Object.fromEntries(r.model.diagnostics.marketsOmitted.map((o) => [o.marketKey, o.reason]));
  assert.equal(reasons.over15, "baseline_unavailable");
  assert.equal(reasons.fh, "baseline_unavailable"); // played 10 < LEAGUE_MIN_SAMPLE 20
  assert.equal(reasons.sh, "no_venue_data");
  assert.equal(reasons["1x2"], "non_canonical_market"); // 1x2/over is not a valid pairing
  assert.equal(r.model.diagnostics.marketsWithData, 1);
});

test("no scored markets → fail closed; invalid fixture → fail closed", () => {
  const lowSample = deriveEvidenceModel({
    fixtureId: 90231,
    markets: [over25({ home: { pct: 72, played: 3 }, away: { pct: 68, played: 4 } })],
  });
  assert.equal(lowSample.ok, false);
  assert.equal(!lowSample.ok && lowSample.reason, "no_scored_markets");

  const noData = deriveEvidenceModel({ fixtureId: 90231, markets: [{ marketKey: "over25", selectionKey: "over", home: null, away: null, leagueBaseline: { pct: 50, played: 190 } }] });
  assert.equal(!noData.ok && noData.reason, "no_markets_with_data");

  const badFixture = deriveEvidenceModel({ fixtureId: 0, markets: [over25()] });
  assert.equal(!badFixture.ok && badFixture.reason, "invalid_fixture_id");
});

// ---- Axis separation, determinism, purity ----------------------------------

test("evidenceScore is independent of modelProbability (§4.6)", () => {
  const a = deriveEvidenceModel({ fixtureId: 1, markets: [over25({ modelProbabilityPct: 72 })] });
  const b = deriveEvidenceModel({ fixtureId: 1, markets: [over25({ modelProbabilityPct: 30 })] });
  assert.ok(a.ok && b.ok);
  if (!a.ok || !b.ok) throw new Error("unreachable");
  assert.equal(a.model.evidenceScore, b.model.evidenceScore); // 90, unchanged by probability
  assert.equal(a.model.supportedMarkets[0].modelProbability, 0.72);
  assert.equal(b.model.supportedMarkets[0].modelProbability, 0.3);
  assert.notEqual(a.model.evidenceScore, a.model.supportedMarkets[0].modelProbability);
});

test("modelProbability conversion clamps/rejects out of range", () => {
  assert.equal(toModelProbabilityFraction(72), 0.72);
  assert.equal(toModelProbabilityFraction(0), 0);
  assert.equal(toModelProbabilityFraction(100), 1);
  for (const bad of [-1, 101, 150, Number.NaN, Infinity, null, undefined]) {
    assert.equal(toModelProbabilityFraction(bad as never), null);
  }
});

test("qualificationReasons mirror deriveQualification branches", () => {
  assert.deepEqual(qualificationReasons(90, 19), ["score_ge_qualified(70)", "sample_ge_min(6)"]);
  assert.deepEqual(qualificationReasons(90, 3), ["score_ge_qualified(70)", "sample_lt_min(6)"]);
  assert.deepEqual(qualificationReasons(55, 10), ["score_ge_provisional(45)", "score_lt_qualified(70)", "sample_ge_min(6)"]);
  assert.deepEqual(qualificationReasons(20, 10), ["score_lt_provisional(45)"]);
});

test("derivation is deterministic across repeated runs", () => {
  const input = { fixtureId: 90231, markets: [over25(), shOpposing] };
  const r1 = deriveEvidenceModel(input);
  const r2 = deriveEvidenceModel(input);
  assert.deepEqual(r1, r2);
});

test("importing the model has no side effects", async () => {
  const before = { ...process.env };
  const mod = await import("../lib/evidence-capture/model");
  assert.equal(typeof mod.deriveEvidenceModel, "function");
  assert.deepEqual({ ...process.env }, before);
});

// ---- Defensive input hardening (malformed shapes fail closed) --------------

test("malformed market elements (null / non-object) fail closed, never throw", () => {
  for (const bad of [null, 42, "x", true, undefined]) {
    assert.doesNotThrow(() =>
      deriveEvidenceModel({ fixtureId: 90231, markets: [bad] } as never)
    );
    const r = deriveEvidenceModel({ fixtureId: 90231, markets: [bad] } as never);
    assert.equal(r.ok, false);
    if (r.ok) throw new Error("unreachable");
    assert.equal(r.reason, "no_markets_with_data");
    assert.deepEqual(r.diagnostics.marketsOmitted, [
      { marketKey: "?", reason: "malformed_market_input" },
    ]);
  }
  // a malformed element alongside a valid market: valid one still derives
  const mixed = deriveEvidenceModel({ fixtureId: 90231, markets: [null, over25()] } as never);
  assert.ok(mixed.ok);
  if (!mixed.ok) throw new Error("unreachable");
  assert.equal(mixed.model.evidenceScore, 90);
  assert.equal(mixed.model.diagnostics.marketsWithData, 1);
  assert.deepEqual(mixed.model.diagnostics.marketsOmitted, [
    { marketKey: "?", reason: "malformed_market_input" },
  ]);
});

test("malformed counters (non-array) fail closed; valid arrays unchanged", () => {
  const badHome = deriveEvidenceModel({ fixtureId: 1, markets: [over25({ counters: { home: {} } as never })] });
  const badAway = deriveEvidenceModel({ fixtureId: 1, markets: [over25({ counters: { away: "invalid" } as never })] });
  for (const r of [badHome, badAway]) {
    assert.ok(r.ok);
    if (!r.ok) throw new Error("unreachable");
    assert.equal(r.model.evidenceScore, 90); // no counter fabricated → identical to no-counter
    assert.ok(!r.model.signals.some((s) => s.key.startsWith("counter_")));
  }
  // a valid counter array still applies (unchanged behavior)
  const good = deriveEvidenceModel({ fixtureId: 1, markets: [over25({ counters: { home: [{ pct: 60, played: 15 }] } })] });
  assert.ok(good.ok && good.model.evidenceScore === 80.77);
});

test("malformed inputs are deterministic and do not mutate the input", () => {
  const input = { fixtureId: 90231, markets: [null, over25({ counters: { home: {} } as never })] } as never;
  const snapshot = JSON.parse(JSON.stringify(input));
  const r1 = deriveEvidenceModel(input);
  const r2 = deriveEvidenceModel(input);
  assert.deepEqual(r1, r2); // deterministic
  assert.deepEqual(input, snapshot); // input not mutated
});

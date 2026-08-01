import assert from "node:assert/strict";
import test from "node:test";
import {
  applyEvidenceGates,
  buildCandidatesFromFixtures,
  buildFeaturedVariants,
  canAddSelection,
  createMapOddsLookup,
  defaultComboRequest,
  generateEvidenceCombo,
  getRiskProfile,
  optimizeCombo,
  removeSelection,
  replaceSelection,
  resetComboCaches,
  selectionToLeg,
  validateComboRequest,
  STRENGTH_RANK,
} from "../lib/combo";
import type { QualifiedFixture } from "../lib/research/qualifiedFixture";

const futureKickoff = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
const oddsFetchedAt = new Date().toISOString();

function fixture(
  matchId: number,
  kind: QualifiedFixture["marketKind"],
  home: string,
  away: string,
  league: string,
  modelProbability: number
): QualifiedFixture {
  return {
    id: `${matchId}-${kind}`,
    matchId,
    marketKind: kind,
    league,
    country: "England",
    leagueCode: "EPL",
    home,
    away,
    kickoff: "Tonight",
    kickoffDateTime: futureKickoff,
    market: kind,
    marketCode: kind,
    modelProbability,
    updatedAt: "just now",
    updatedDateTime: oddsFetchedAt,
    venue: "Venue data pending",
    operatorStatus: "unavailable",
  };
}

function sampleFixtures(): QualifiedFixture[] {
  return [
    fixture(101, "over15", "Arsenal", "Brighton", "Premier League", 94),
    fixture(102, "over15", "PSV", "AZ", "Eredivisie", 91),
    fixture(104, "over25", "Inter", "Torino", "Serie A", 78),
    fixture(105, "fh", "Benfica", "Porto", "Primeira Liga", 88),
    fixture(106, "over15", "Ajax", "Feyenoord", "Eredivisie", 90),
    fixture(107, "over25", "Milan", "Napoli", "Serie A", 76),
    fixture(108, "sh", "Lyon", "Nice", "Ligue 1", 92),
  ];
}

function oddsFor(fixtures: QualifiedFixture[]) {
  const entries = fixtures.map((f, i) => ({
    matchId: f.matchId,
    oddsKey:
      f.marketKind === "over15"
        ? "over15"
        : f.marketKind === "over25"
          ? "over25"
          : f.marketKind === "fh"
            ? "fh"
            : "sh",
    decimal: 1.35 + (i % 5) * 0.15,
    fetchedAt: oddsFetchedAt,
  }));
  return createMapOddsLookup(entries);
}

test("request validation rejects bad odds range and unsupported-only markets", () => {
  const bad = validateComboRequest({
    targetOddsMin: 1,
    targetOddsMax: 2,
    riskProfile: "balanced",
    marketPreferences: ["mixed"],
  });
  assert.equal(bad.ok, false);

  const unsupported = validateComboRequest({
    targetOddsMin: 2,
    targetOddsMax: 3,
    riskProfile: "balanced",
    marketPreferences: ["btts", "home_win"],
  });
  assert.equal(unsupported.ok, false);
  if (!unsupported.ok) {
    assert.equal(unsupported.failure.reason, "unsupported_market");
  }

  const ok = validateComboRequest({
    locale: "pt-BR",
    country: "br",
    targetOddsMin: 2,
    targetOddsMax: 3,
    riskProfile: "balanced",
    marketPreferences: ["over_1_5", "btts"],
    maxSelections: 3,
  });
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.request.locale, "pt");
    assert.equal(ok.request.country, "BR");
  }
});

test("risk profiles never disable evidence floors", () => {
  assert.equal(getRiskProfile("conservative").minimumStrength, "strong");
  assert.ok(getRiskProfile("value").minimumSample >= 10);
  assert.ok(STRENGTH_RANK.strong > STRENGTH_RANK.moderate);
});

test("candidate generation + gates + deterministic optimizer", () => {
  resetComboCaches();
  const fixtures = sampleFixtures();
  const request = defaultComboRequest({
    riskProfile: "balanced",
    targetOddsMin: 2.0,
    targetOddsMax: 4.5,
    maxSelections: 3,
    marketPreferences: ["mixed"],
  });
  const candidates = buildCandidatesFromFixtures(
    fixtures,
    request,
    oddsFor(fixtures)
  );
  assert.ok(candidates.length >= 4);
  const { qualified } = applyEvidenceGates(candidates, request);
  assert.ok(qualified.length >= 2);

  const a = optimizeCombo(qualified, request);
  const b = optimizeCombo(qualified, request);
  assert.equal(a.status, b.status);
  if (a.status === "success" && b.status === "success") {
    assert.equal(a.combo.id, b.combo.id);
    assert.equal(a.combo.selections.length, b.combo.selections.length);
    assert.ok(a.combo.combinedOdds > 1);
    assert.ok(
      a.combo.aggregateEvidenceStrength === "strong" ||
        a.combo.aggregateEvidenceStrength === "moderate" ||
        a.combo.aggregateEvidenceStrength === "very_strong"
    );
  }
});

test("correlation rejects same fixture twice", () => {
  const request = defaultComboRequest();
  const fixtures = [
    fixture(201, "over15", "A", "B", "L1", 95),
    fixture(201, "over25", "A", "B", "L1", 80),
  ];
  const candidates = buildCandidatesFromFixtures(
    fixtures,
    request,
    oddsFor(fixtures)
  );
  assert.equal(candidates.length, 2);
  assert.equal(
    canAddSelection(
      [selectionToLeg(candidates[0])],
      selectionToLeg(candidates[1]),
      request
    ),
    false
  );
});

test("generateEvidenceCombo returns operators without scoring weights", () => {
  resetComboCaches();
  const fixtures = sampleFixtures();
  const result = generateEvidenceCombo({
    request: {
      locale: "en",
      country: "NG",
      targetOddsMin: 2,
      targetOddsMax: 5,
      riskProfile: "balanced",
      marketPreferences: ["mixed"],
      maxSelections: 3,
    },
    fixtures,
    oddsLookup: oddsFor(fixtures),
  });
  assert.equal(result.status, "success");
  if (result.status === "success") {
    assert.ok(result.operators.length > 0);
    assert.ok(result.operators[0].outboundPath.startsWith("/go/"));
    assert.ok(
      result.operators[0].availability === "unknown" ||
        result.operators[0].availability === "full"
    );
    const json = JSON.stringify(result);
    assert.ok(!json.includes("SCORING_WEIGHTS"));
    assert.ok(!json.includes("volatilityPenalty"));
  }
});

test("replace and remove keep evidence gates", () => {
  resetComboCaches();
  const fixtures = sampleFixtures();
  const result = generateEvidenceCombo({
    request: defaultComboRequest({
      targetOddsMin: 2,
      targetOddsMax: 6,
      maxSelections: 3,
    }),
    fixtures,
    oddsLookup: oddsFor(fixtures),
  });
  assert.equal(result.status, "success");
  if (result.status !== "success") return;

  const candidates = buildCandidatesFromFixtures(
    fixtures,
    result.combo.request,
    oddsFor(fixtures)
  );
  const { qualified } = applyEvidenceGates(candidates, result.combo.request);
  const first = result.combo.selections[0];
  const replaced = replaceSelection(
    result.combo,
    { matchId: first.matchId, marketId: first.marketId },
    "stronger_evidence",
    qualified
  );
  assert.ok(replaced.status === "success" || replaced.status === "failure");

  if (result.combo.selections.length > 2) {
    const removed = removeSelection(
      result.combo,
      {
        matchId: result.combo.selections[2].matchId,
        marketId: result.combo.selections[2].marketId,
      },
      qualified
    );
    assert.equal(removed.status, "success");
  }
});

test("featured variants use evidence-first labels", () => {
  const fixtures = sampleFixtures();
  const request = defaultComboRequest();
  const candidates = buildCandidatesFromFixtures(
    fixtures,
    request,
    oddsFor(fixtures)
  );
  const { qualified } = applyEvidenceGates(candidates, request);
  const featured = buildFeaturedVariants(qualified, request);
  assert.deepEqual(
    featured.map((f) => f.label),
    ["Stronger Evidence", "Balanced", "Higher Target Odds"]
  );
});

test("target miss returns closest option without weakening gates", () => {
  resetComboCaches();
  const fixtures = sampleFixtures();
  const result = generateEvidenceCombo({
    request: {
      ...defaultComboRequest(),
      targetOddsMin: 20,
      targetOddsMax: 22,
      maxSelections: 2,
      riskProfile: "balanced",
    },
    fixtures,
    oddsLookup: oddsFor(fixtures),
  });
  assert.equal(result.status, "no_qualified_combo");
  if (result.status === "no_qualified_combo") {
    assert.equal(result.reason, "target_range_unavailable");
    assert.ok(result.closestQualifiedOption?.combinedOdds);
    assert.ok(result.suggestedRange);
  }
});

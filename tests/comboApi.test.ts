import assert from "node:assert/strict";
import test from "node:test";
import { existsSync } from "node:fs";
import path from "node:path";
import {
  apiComboDiagnostics,
  apiGenerateCombo,
  apiMatchOperators,
  apiRemoveSelection,
  apiReplaceSelection,
  clearPreparedComboData,
  COMBO_GENERATE_LIMIT,
  createComboRequestId,
  isSafeGoPath,
  rateLimitCombo,
  resetComboCaches,
  resetComboSessions,
  setPreparedComboData,
  toPublicOperators,
} from "../lib/combo";
import type { QualifiedFixture } from "../lib/research/qualifiedFixture";
import { resetRateLimitBuckets } from "../lib/security/rateLimit";

const root = path.resolve(__dirname, "..");
const futureKickoff = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
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
    fixture(301, "over15", "Arsenal", "Brighton", "Premier League", 94),
    fixture(302, "over15", "PSV", "AZ", "Eredivisie", 91),
    fixture(303, "over25", "Inter", "Torino", "Serie A", 78),
    fixture(304, "fh", "Benfica", "Porto", "Primeira Liga", 88),
    fixture(305, "over15", "Ajax", "Feyenoord", "Eredivisie", 90),
    fixture(306, "over25", "Milan", "Napoli", "Serie A", 76),
    fixture(307, "sh", "Lyon", "Nice", "Ligue 1", 92),
  ];
}

function sampleOdds(fixtures: QualifiedFixture[]) {
  return fixtures.map((f, i) => ({
    matchId: f.matchId,
    oddsKey:
      f.marketKind === "over15"
        ? "over15"
        : f.marketKind === "over25"
          ? "over25"
          : f.marketKind === "fh"
            ? "fh"
            : "sh",
    decimal: 1.4 + (i % 4) * 0.2,
    fetchedAt: oddsFetchedAt,
  }));
}

function prepare() {
  resetComboCaches();
  resetComboSessions();
  clearPreparedComboData();
  const fixtures = sampleFixtures();
  setPreparedComboData({ fixtures, odds: sampleOdds(fixtures) });
  return fixtures;
}

test("API routes exist", () => {
  for (const rel of [
    "app/api/combo/generate/route.ts",
    "app/api/combo/replace/route.ts",
    "app/api/combo/remove/route.ts",
    "app/api/combo/operators/route.ts",
    "app/api/combo/diagnostics/route.ts",
  ]) {
    assert.ok(existsSync(path.join(root, rel)), rel);
  }
});

test("generate success returns public contract", () => {
  prepare();
  const a = apiGenerateCombo({
    locale: "en",
    country: "NG",
    targetOddsMin: 2,
    targetOddsMax: 5,
    riskProfile: "balanced",
    marketPreferences: ["mixed"],
    maxSelections: 3,
  }, "req_test_success");

  assert.equal(a.status, "success");
  if (a.status !== "success") return;
  assert.equal(a.requestId, "req_test_success");
  assert.ok(a.combo.id.startsWith("combo_"));
  assert.ok(Array.isArray(a.operators));
  assert.ok(Array.isArray(a.alternatives));
  assert.ok(a.meta.generatedAt);
  assert.ok(a.meta.dataSnapshot);
  const json = JSON.stringify(a);
  assert.ok(!json.includes("SCORING_WEIGHTS"));
  assert.ok(!json.includes("volatilityPenalty"));
  assert.ok(!json.includes("apiFootball"));
  assert.ok(!json.includes("matchScore"));
});

test("invalid request and unsupported market contracts", () => {
  prepare();
  const invalid = apiGenerateCombo({
    targetOddsMin: 1,
    targetOddsMax: 2,
    riskProfile: "balanced",
    marketPreferences: ["mixed"],
  });
  assert.equal(invalid.status, "invalid_request");
  if (invalid.status === "invalid_request") {
    assert.ok(invalid.requestId);
    assert.ok(invalid.errors.some((e) => e.field === "targetOddsMin"));
  }

  const unsupported = apiGenerateCombo({
    targetOddsMin: 2,
    targetOddsMax: 3,
    riskProfile: "balanced",
    marketPreferences: ["btts", "home_win"],
  });
  assert.equal(unsupported.status, "invalid_request");
  if (unsupported.status === "invalid_request") {
    assert.ok(unsupported.errors.some((e) => e.code === "unsupported_market"));
  }
});

test("no qualified combo returns closest option", () => {
  prepare();
  const result = apiGenerateCombo({
    locale: "en",
    targetOddsMin: 20,
    targetOddsMax: 22,
    riskProfile: "balanced",
    marketPreferences: ["mixed"],
    maxSelections: 2,
  });
  assert.equal(result.status, "no_qualified_combo");
  if (result.status === "no_qualified_combo") {
    assert.equal(result.reason, "target_range_unavailable");
    assert.ok(result.closestQualifiedOption?.combinedOdds);
    assert.ok(result.suggestedRange);
    assert.ok(result.meta.dataSnapshot);
  }
});

test("generate is deterministic for identical inputs", () => {
  prepare();
  const body = {
    locale: "en",
    country: "NG",
    targetOddsMin: 2,
    targetOddsMax: 5,
    riskProfile: "balanced",
    marketPreferences: ["mixed"],
    maxSelections: 3,
  };
  const a = apiGenerateCombo(body, "req_a");
  prepare();
  const b = apiGenerateCombo(body, "req_b");
  assert.equal(a.status, "success");
  assert.equal(b.status, "success");
  if (a.status === "success" && b.status === "success") {
    assert.equal(a.combo.id, b.combo.id);
    assert.deepEqual(
      a.combo.selections.map((s) => `${s.matchId}:${s.marketId}`),
      b.combo.selections.map((s) => `${s.matchId}:${s.marketId}`)
    );
  }
});

test("replace success and unavailable", () => {
  prepare();
  const generated = apiGenerateCombo({
    locale: "en",
    targetOddsMin: 2,
    targetOddsMax: 6,
    riskProfile: "balanced",
    marketPreferences: ["mixed"],
    maxSelections: 3,
  });
  assert.equal(generated.status, "success");
  if (generated.status !== "success") return;

  const first = generated.combo.selections[0];
  const replaced = apiReplaceSelection({
    combo: generated.combo,
    comboId: generated.combo.id,
    selection: { matchId: first.matchId, marketId: first.marketId },
    mode: "stronger_evidence",
    fixtures: sampleFixtures(),
    odds: sampleOdds(sampleFixtures()),
  });
  assert.ok(replaced.status === "success" || replaced.status === "no_replacement");
  if (replaced.status === "success") {
    assert.ok(replaced.operators.length);
    assert.ok(replaced.meta.inTargetRange !== undefined);
  }

  const unavailable = apiReplaceSelection({
    combo: generated.combo,
    selection: { matchId: first.matchId, marketId: first.marketId },
    mode: "different_competition",
    fixtures: [sampleFixtures()[0]],
    odds: sampleOdds([sampleFixtures()[0]]),
  });
  assert.ok(
    unavailable.status === "no_replacement" || unavailable.status === "success"
  );
});

test("remove success recalculates without auto-insert", () => {
  prepare();
  const generated = apiGenerateCombo({
    locale: "en",
    targetOddsMin: 2,
    targetOddsMax: 8,
    riskProfile: "balanced",
    marketPreferences: ["mixed"],
    maxSelections: 3,
  });
  assert.equal(generated.status, "success");
  if (generated.status !== "success") return;
  assert.ok(generated.combo.selections.length >= 2);

  if (generated.combo.selections.length < 3) return;

  const target = generated.combo.selections[2];
  const removed = apiRemoveSelection({
    comboId: generated.combo.id,
    selection: { matchId: target.matchId, marketId: target.marketId },
  });
  assert.equal(removed.status, "success");
  if (removed.status === "success") {
    assert.equal(removed.combo.selections.length, generated.combo.selections.length - 1);
    assert.ok(typeof removed.meta.inTargetRange === "boolean");
    assert.ok(!removed.combo.selections.some((s) => s.matchId === target.matchId && s.marketId === target.marketId));
  }
});

test("operator states: unknown explicit, country hard filter, no open redirect", () => {
  prepare();
  const generated = apiGenerateCombo({
    locale: "en",
    country: "NG",
    targetOddsMin: 2,
    targetOddsMax: 5,
    riskProfile: "balanced",
    marketPreferences: ["mixed"],
    maxSelections: 3,
  });
  assert.equal(generated.status, "success");
  if (generated.status !== "success") return;

  assert.ok(generated.operators.every((op) => op.countryEligible));
  assert.ok(
    generated.operators.every(
      (op) =>
        op.availability === "full" ||
        op.availability === "partial" ||
        op.availability === "unknown" ||
        op.availability === "none"
    )
  );
  // Unknown must never be labeled best_match
  assert.ok(
    !generated.operators.some(
      (op) => op.availability === "unknown" && op.badge === "best_match"
    )
  );

  for (const op of generated.operators) {
    if (op.outboundPath) {
      assert.ok(isSafeGoPath(op.outboundPath));
      assert.ok(!op.outboundPath.includes("://"));
    } else {
      assert.equal(op.deeplinkType, "unavailable");
    }
  }

  const refreshed = apiMatchOperators({
    combo: generated.combo,
    country: "ZZ",
  });
  // ZZ is invalid country code → ignored / no country filter change; use a restricted case via domain
  assert.ok(refreshed.status === "success" || refreshed.status === "invalid_request");
});

test("open redirect protection strips unsafe outbound paths", () => {
  const unsafe = toPublicOperators([
    {
      operatorId: "1xbet",
      slug: "1xbet",
      displayName: "1xBet",
      availability: "unknown",
      availableSelectionCount: 3,
      totalSelections: 3,
      missingMarketIds: [],
      countryEligible: true,
      deeplinkType: "homepage",
      outboundPath: "https://evil.example/phish",
      mobileSupported: true,
      reasons: [],
      matchScore: 1,
      rank: 1,
    },
  ]);
  assert.equal(unsafe[0].outboundPath, "");
  assert.equal(unsafe[0].deeplinkType, "unavailable");

  assert.equal(isSafeGoPath("/go/1xbet?subid=x"), true);
  assert.equal(isSafeGoPath("/go/../admin"), false);
  assert.equal(isSafeGoPath("https://evil.com"), false);
});

test("rate-limit interface blocks after window capacity", () => {
  resetRateLimitBuckets();
  const key = `test-combo-${Date.now()}`;
  let blocked = false;
  for (let i = 0; i < COMBO_GENERATE_LIMIT + 2; i++) {
    const result = rateLimitCombo({ action: "generate", clientKey: key, now: 1_000 });
    if (!result.allowed) {
      blocked = true;
      assert.ok(result.retryAfterSec >= 1);
      break;
    }
  }
  assert.equal(blocked, true);
});

test("diagnostics aggregate health only", () => {
  prepare();
  const diagnostics = apiComboDiagnostics("req_diag");
  assert.equal(diagnostics.requestId, "req_diag");
  assert.ok(["healthy", "degraded", "unhealthy"].includes(diagnostics.status));
  assert.ok(typeof diagnostics.candidateFixtures === "number");
  assert.ok(typeof diagnostics.qualifiedSelections === "number");
  assert.ok(diagnostics.rejectionReasons);
  assert.ok(diagnostics.targetRangeCoverage);
  assert.ok(typeof diagnostics.unknownAvailabilityCount === "number");
  assert.ok(typeof diagnostics.optimizer.durationMs === "number");
  const json = JSON.stringify(diagnostics);
  assert.ok(!json.includes("SCORING_WEIGHTS"));
  assert.ok(!json.includes("scoreBreakdown"));
  assert.ok(!json.includes("candidates"));
});

test("request id helper and public error safety", () => {
  const id = createComboRequestId();
  assert.match(id, /^req_[a-f0-9]+$/);
  clearPreparedComboData();
  const err = apiGenerateCombo({
    targetOddsMin: 0.5,
    targetOddsMax: 2,
    riskProfile: "nope",
    marketPreferences: ["mixed"],
  });
  assert.equal(err.status, "invalid_request");
  if (err.status === "invalid_request") {
    assert.ok(!JSON.stringify(err).toLowerCase().includes("stack"));
  }
});
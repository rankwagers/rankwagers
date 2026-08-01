import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  ACCA_BUILDER_ANALYTICS_EVENTS,
  RISK_MODE_RULES,
  applyEligibility,
  buildAccaCombinations,
  canAddToCombo,
  combineDecimalOddsSafe,
  defaultBuilderConfig,
  generateCombinations,
  normalizeDecimalOdds,
  normalizeListRow,
  parseBuilderConfig,
  scoreCandidate,
  sortByScore,
} from "../lib/acca-builder";
import {
  emptySlip,
  mergeSelections,
  replaceSelections,
} from "../lib/acca/rules";
import { analyticsEventNames } from "../lib/analytics/types";
import type { DailyMatchLists, FootyMatchRow } from "../lib/footystats/types";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NOW = Date.parse("2026-07-25T12:00:00.000Z");
const FUTURE = Math.floor((NOW + 8 * 3600_000) / 1000);

function row(
  matchId: number,
  pct: number,
  extras: Partial<FootyMatchRow> = {}
): FootyMatchRow {
  return {
    matchId,
    homeTeam: `Home${matchId}`,
    awayTeam: `Away${matchId}`,
    competition: extras.competition ?? "Premier League",
    country: "England",
    countryCode: "GB",
    flag: "",
    kickoffTime: FUTURE,
    kickoff: "Tonight",
    over15Pct: pct,
    fhOver05Pct: pct - 2,
    over25Pct: pct - 5,
    shOver05Pct: pct - 8,
    status: "NS",
    isLive: false,
    isFinished: false,
    homeScore: 0,
    awayScore: 0,
    minute: 0,
    highlightPct: pct,
    ...extras,
  };
}

function lists(rows: FootyMatchRow[]): DailyMatchLists {
  return {
    date: "2026-07-25",
    fetchedAt: new Date(NOW).toISOString(),
    over15: rows,
    over25: rows.map((r) => ({ ...r, highlightPct: r.over25Pct })),
    fh: rows.map((r) => ({ ...r, highlightPct: r.fhOver05Pct })),
    sh: rows.map((r) => ({ ...r, highlightPct: r.shOver05Pct })),
  };
}

test("sprint 19.5 builder files exist", () => {
  for (const rel of [
    "lib/acca-builder/contracts.ts",
    "lib/acca-builder/service.ts",
    "lib/acca-builder/load.server.ts",
    "app/api/acca/builder/route.ts",
    "app/[locale]/acca/builder/page.tsx",
    "components/acca-builder/AccaBuilderView.tsx",
    "docs/acca-builder.md",
    "docs/acca-builder-methodology.md",
    "docs/acca-builder-provider-matrix.md",
    "docs/acca-builder-localhost-acceptance.md",
    "docs/sprint-19-5-completion-report.md",
  ]) {
    assert.ok(existsSync(path.join(root, rel)), rel);
  }
});

test("builder analytics events are registered", () => {
  for (const name of ACCA_BUILDER_ANALYTICS_EVENTS) {
    assert.ok(
      (analyticsEventNames as readonly string[]).includes(name),
      name
    );
  }
});

test("parseBuilderConfig validates risk modes and bounds", () => {
  const bad = parseBuilderConfig({ riskMode: "yolo", legCount: 99 });
  assert.equal(bad.ok, false);

  const ok = parseBuilderConfig({
    riskMode: "conservative",
    legCount: 3,
    locale: "en",
  });
  assert.equal(ok.ok, true);
  if (!ok.ok) return;
  assert.equal(ok.config.riskMode, "conservative");
  assert.equal(ok.config.minConfidence, RISK_MODE_RULES.conservative.minConfidence);
  assert.ok(ok.config.legCount <= RISK_MODE_RULES.conservative.maxLegs);
});

test("normalize skips cancelled fixtures and maps confidence", () => {
  const good = normalizeListRow(row(1, 82), "over25", "en", {
    decimal: 1.72,
    fetchedAt: new Date(NOW).toISOString(),
  }, NOW);
  assert.ok(good);
  assert.equal(good?.confidence, 77);
  assert.equal(good?.odds, 1.72);

  const cancelled = normalizeListRow(
    row(2, 90, { status: "Match Postponed" }),
    "over15",
    "en",
    null,
    NOW
  );
  assert.equal(cancelled, null);
});

test("eligibility gates confidence, kickoff, exclusions, target odds", () => {
  const base = normalizeListRow(row(10, 80), "over15", "en", null, NOW)!;
  const past = {
    ...base,
    kickoffAt: new Date(NOW - 1000).toISOString(),
    confidence: 90,
  };
  const cfg = defaultBuilderConfig({
    riskMode: "balanced",
    minConfidence: 70,
    targetOddsMin: 5,
  });
  const gated = applyEligibility(past, cfg, NOW);
  assert.equal(gated.eligible, false);
  assert.ok(gated.exclusionReasons.includes("kickoff_passed"));
  assert.ok(gated.exclusionReasons.includes("odds_required_for_target"));

  const excluded = applyEligibility(
    { ...base, homeTeam: "Arsenal", awayTeam: "X", confidence: 90, odds: 1.5 },
    { ...cfg, excludedTeams: ["Arsenal"], targetOddsMin: null },
    NOW
  );
  assert.ok(excluded.exclusionReasons.includes("team_excluded"));
});

test("scoring and ranking are deterministic", () => {
  const cfg = defaultBuilderConfig({ riskMode: "balanced" });
  const a = scoreCandidate(
    normalizeListRow(row(1, 88), "over15", "en", { decimal: 1.4 }, NOW)!,
    cfg,
    NOW
  );
  const b = scoreCandidate(
    normalizeListRow(row(2, 70), "over25", "en", null, NOW)!,
    cfg,
    NOW
  );
  const sorted1 = sortByScore([a, b]).map((c) => c.id);
  const sorted2 = sortByScore([b, a]).map((c) => c.id);
  assert.deepEqual(sorted1, sorted2);
});

test("conflicts: one per fixture and duplicate prevention", () => {
  const cfg = defaultBuilderConfig();
  const c1 = normalizeListRow(row(5, 85), "over15", "en", { decimal: 1.5 }, NOW)!;
  const c2 = normalizeListRow(row(5, 80), "over25", "en", { decimal: 1.9 }, NOW)!;
  assert.equal(canAddToCombo([c1], c2, true).ok, false);
  assert.equal(canAddToCombo([c1], c2, false).ok, true);
  assert.equal(canAddToCombo([c1], c1, true).ok, false);
  void cfg;
});

test("combination generation respects leg count and modes", () => {
  const pool = [11, 12, 13, 14, 15, 16].map((id, i) =>
    scoreCandidate(
      applyEligibility(
        normalizeListRow(
          row(id, 90 - i),
          i % 2 === 0 ? "over15" : "over25",
          "en",
          { decimal: 1.4 + i * 0.05 },
          NOW
        )!,
        defaultBuilderConfig({ riskMode: "balanced", legCount: 3 }),
        NOW
      ),
      defaultBuilderConfig({ riskMode: "balanced", legCount: 3 }),
      NOW
    )
  );
  const eligible = pool.filter((c) => c.eligible);
  const combos = generateCombinations(
    eligible,
    defaultBuilderConfig({ riskMode: "balanced", legCount: 3 })
  );
  assert.ok(combos.length >= 1);
  assert.equal(combos[0]?.legCount, 3);
  assert.equal(combos[0]?.drafts[0]?.source, "builder");
});

test("buildAccaCombinations end-to-end with injected lists", () => {
  const cfg = defaultBuilderConfig({
    riskMode: "conservative",
    legCount: 3,
    minConfidence: 70,
  });
  const result = buildAccaCombinations({
    config: cfg,
    lists: lists([
      row(101, 90),
      row(102, 88),
      row(103, 86),
      row(104, 84),
    ]),
    oddsLookup: {
      get(matchId, marketKey) {
        return { decimal: 1.5 + (matchId % 5) * 0.05, fetchedAt: new Date(NOW).toISOString() };
      },
    },
    requestId: "req_test_195",
    now: NOW,
  });
  assert.equal(result.requestId, "req_test_195");
  assert.equal(result.status, "success");
  assert.ok(result.combinations.length >= 1);

  const again = buildAccaCombinations({
    config: cfg,
    lists: lists([
      row(101, 90),
      row(102, 88),
      row(103, 86),
      row(104, 84),
    ]),
    oddsLookup: {
      get(matchId) {
        return { decimal: 1.5 + (matchId % 5) * 0.05, fetchedAt: new Date(NOW).toISOString() };
      },
    },
    requestId: "req_test_195b",
    now: NOW,
  });
  assert.deepEqual(
    result.combinations[0]?.legs.map((l) => l.id),
    again.combinations[0]?.legs.map((l) => l.id)
  );
});

test("target odds: missing odds excluded; impossible range still quality-first", () => {
  const cfg = defaultBuilderConfig({
    legCount: 2,
    targetOddsMin: 50,
    targetOddsMax: 60,
  });
  const result = buildAccaCombinations({
    config: cfg,
    lists: lists([row(201, 92), row(202, 91), row(203, 90)]),
    oddsLookup: {
      get() {
        return { decimal: 1.4, fetchedAt: new Date(NOW).toISOString() };
      },
    },
    now: NOW,
    requestId: "req_target",
  });
  assert.ok(result.combinations.length <= 1);
  if (result.combinations[0]) {
    assert.ok(
      result.combinations[0].limitations.some((l) =>
        l.toLowerCase().includes("target odds")
      )
    );
  }
});

test("odds helpers never invent values", () => {
  assert.equal(normalizeDecimalOdds(0), null);
  assert.equal(normalizeDecimalOdds(1), null);
  assert.equal(normalizeDecimalOdds(1.85), 1.85);
  const c = combineDecimalOddsSafe([1.5, null, 2]);
  assert.equal(c.complete, false);
  assert.ok(c.combined != null);
});

test("Studio transfer merge and replace preserve builder source", () => {
  let slip = emptySlip("en");
  const drafts = [
    {
      matchId: 1,
      homeTeam: "A",
      awayTeam: "B",
      competition: "L",
      marketKey: "over15",
      odds: 1.5,
      confidence: 80,
      matchHref: "/en/fixtures/1",
      source: "builder" as const,
      evidenceSummary: ["Published list"],
    },
    {
      matchId: 2,
      homeTeam: "C",
      awayTeam: "D",
      competition: "L",
      marketKey: "over25",
      odds: 1.8,
      confidence: 75,
      matchHref: "/en/fixtures/2",
      source: "builder" as const,
    },
  ];
  const replaced = replaceSelections(slip, drafts);
  assert.equal(replaced.ok, true);
  assert.equal(replaced.slip.selections.length, 2);
  assert.equal(replaced.slip.selections[0]?.source, "builder");

  slip = replaced.slip;
  const merged = mergeSelections(slip, [
    {
      matchId: 3,
      homeTeam: "E",
      awayTeam: "F",
      competition: "L",
      marketKey: "fh",
      odds: 1.4,
      confidence: 82,
      matchHref: "/en/fixtures/3",
      source: "builder" as const,
    },
  ]);
  assert.equal(merged.slip.selections.length, 3);
});

test("combo page redirects to builder; builder route wired", () => {
  const combo = readFileSync(
    path.join(root, "app/[locale]/combo/page.tsx"),
    "utf8"
  );
  assert.match(combo, /acca\/builder/);
  assert.match(combo, /redirect/);
  const builder = readFileSync(
    path.join(root, "app/[locale]/acca/builder/page.tsx"),
    "utf8"
  );
  assert.match(builder, /AccaBuilderView/);
  const api = readFileSync(
    path.join(root, "app/api/acca/builder/route.ts"),
    "utf8"
  );
  assert.match(api, /runAccaBuilder/);
  assert.match(api, /rateLimitAccaBuilder/);
  assert.match(api, /x-request-id/);
});

test("launch docs keep staging-gated wording after 19.5 approval", () => {
  const sprint20 = readFileSync(
    path.join(root, "docs/sprint-20-completion-report.md"),
    "utf8"
  );
  assert.match(sprint20, /PRODUCT READY FOR STAGING OPERATIONS/i);
  assert.match(sprint20, /operator-gated/i);
  assert.match(sprint20, /Sprint 20B/i);
  assert.doesNotMatch(sprint20, /Live production deploy \| \*\*EXECUTED\*\*/i);
});

import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  buildBaselineView,
  buildSampleQualityView,
  classifyBaselineRelation,
  evidenceStrengthLabel,
  formatSampleSummary,
  fromCompetitionStats,
  fromMarketStats,
  getEvidenceDiagnostics,
  resetEvidenceUiCache,
  resolveEvidenceStrength,
} from "../lib/evidence-ui";
import type { CompetitionResearchStats } from "../lib/competitions/types";
import type { MarketHistoricalStats } from "../lib/markets/types";

const root = path.resolve(__dirname, "..");

test("evidence strength cutoffs are deterministic", () => {
  assert.equal(
    resolveEvidenceStrength({ sampleSize: 20, coveragePercent: 90, qualified: true }),
    "very_strong"
  );
  assert.equal(
    resolveEvidenceStrength({ sampleSize: 12, coveragePercent: 70 }),
    "strong"
  );
  assert.equal(
    resolveEvidenceStrength({ sampleSize: 6, coveragePercent: 50 }),
    "moderate"
  );
  assert.equal(resolveEvidenceStrength({ sampleSize: 3, coveragePercent: 40 }), "limited");
  assert.equal(resolveEvidenceStrength({ sampleSize: 2, coveragePercent: 90 }), "insufficient");
  assert.equal(
    resolveEvidenceStrength({ sampleSize: 20, coveragePercent: 90, providerComplete: false }),
    "insufficient"
  );
  assert.equal(evidenceStrengthLabel("very_strong"), "Very Strong");
});

test("sample quality normalization exposes coverage and exclusions", () => {
  const sample = buildSampleQualityView({
    sampleSize: 32,
    eligible: 32,
    skipped: 5,
    unknown: 2,
  });
  assert.equal(sample.sampleSize, 32);
  assert.equal(sample.skipped, 5);
  assert.ok(sample.coveragePercent != null);
  assert.match(formatSampleSummary(sample), /32 qualified/);
  assert.match(formatSampleSummary(sample), /5 excluded/);
});

test("baseline classification is Above Near Below", () => {
  assert.equal(classifyBaselineRelation(80, 70), "above");
  assert.equal(classifyBaselineRelation(71, 70), "near");
  assert.equal(classifyBaselineRelation(60, 70), "below");
  assert.equal(classifyBaselineRelation(null, 70), "unavailable");
  const view = buildBaselineView({
    kind: "league",
    label: "League average",
    value: 80,
    baseline: 70,
  });
  assert.equal(view.relation, "above");
  assert.ok(view.deltaDisplay?.includes("pp"));
});

test("competition adapter produces EvidenceBundle without inventing metrics", () => {
  resetEvidenceUiCache();
  const stats: CompetitionResearchStats = {
    qualifiedFixtureCount: 10,
    uniqueMatchCount: 8,
    averageModelProbability: 72,
    marketBreakdown: [{ market: "Over 2.5", count: 4, averageProbability: 70 }],
    sampleQuality: "adequate",
    sampleNote: "Adequate unique fixtures in sample.",
  };
  const bundle = fromCompetitionStats(stats, "competition:premier-league");
  assert.ok(bundle.metrics.length >= 2);
  assert.ok(bundle.qualification);
  assert.ok(bundle.provenance?.provider);
  assert.equal(bundle.summaryStrength, resolveEvidenceStrength({
    sampleSize: 8,
    coveragePercent: bundle.metrics[0]?.sample.coveragePercent ?? null,
    qualified: true,
  }));
  const warm = fromCompetitionStats(stats, "competition:premier-league");
  assert.equal(warm.entityKey, bundle.entityKey);
});

test("market adapter maps historical stats", () => {
  resetEvidenceUiCache();
  const stats: MarketHistoricalStats = {
    qualifiedFixtureCount: 15,
    averageModelProbability: 68,
    highestModelProbability: 88,
    leagueCoverage: 4,
    topLeagues: [{ league: "EPL", count: 5 }],
    sampleNote: "Sample from qualified lists.",
  };
  const bundle = fromMarketStats(stats, "market:over-2-5");
  assert.ok(bundle.metrics.some((m) => m.id === "market-qualified"));
  assert.ok(bundle.timeline.length > 0);
});

test("diagnostics dashboard payload is public-safe", () => {
  const diagnostics = getEvidenceDiagnostics();
  assert.ok(diagnostics.generatedAt);
  assert.ok(Array.isArray(diagnostics.findings));
  assert.ok(diagnostics.entityBreakdown.length > 0);
  const json = JSON.stringify(diagnostics);
  assert.equal(json.includes("FOOTYSTATS_API_KEY"), false);
  assert.equal(json.includes("api_key"), false);
});

test("developer evidence routes and components exist", () => {
  assert.ok(existsSync(path.join(root, "lib/evidence-ui/index.ts")));
  assert.ok(existsSync(path.join(root, "components/evidence-ui/EvidenceCard.tsx")));
  assert.ok(existsSync(path.join(root, "components/evidence-ui/QualificationPanel.tsx")));
  assert.ok(existsSync(path.join(root, "components/evidence-ui/BaselineComparison.tsx")));
  assert.ok(existsSync(path.join(root, "components/evidence-ui/SplitCard.tsx")));
  assert.ok(existsSync(path.join(root, "components/evidence-ui/EvidenceTimeline.tsx")));
  assert.ok(existsSync(path.join(root, "components/evidence-ui/ProvenanceBlock.tsx")));
  assert.ok(existsSync(path.join(root, "app/developer/evidence/page.tsx")));
  assert.ok(existsSync(path.join(root, "app/api/evidence/diagnostics/route.ts")));
});

test("evidence analytics events are registered", () => {
  const types = readFileSync(path.join(root, "lib/analytics/types.ts"), "utf8");
  for (const name of [
    "evidence_expand",
    "evidence_compare",
    "baseline_view",
    "qualification_view",
    "split_toggle",
    "source_view",
  ]) {
    assert.match(types, new RegExp(`"${name}"`));
  }
});

test("evidence components expose accessibility affordances", () => {
  const section = readFileSync(
    path.join(root, "components/evidence-ui/EvidenceSection.tsx"),
    "utf8"
  );
  assert.match(section, /aria-expanded/);
  assert.match(section, /aria-labelledby/);
  assert.match(section, /stickyNav/);
  const badge = readFileSync(
    path.join(root, "components/evidence-ui/EvidenceStrengthBadge.tsx"),
    "utf8"
  );
  assert.match(badge, /aria-label/);
  const split = readFileSync(
    path.join(root, "components/evidence-ui/SplitCard.tsx"),
    "utf8"
  );
  assert.match(split, /role="tablist"/);
  assert.match(split, /touchTarget/);
  const tokens = readFileSync(path.join(root, "lib/evidence-ui/tokens.ts"), "utf8");
  assert.match(tokens, /min-h-11/);
});

test("entity detail views mount EvidenceSection", () => {
  for (const file of [
    "components/competitions/CompetitionDetailView.tsx",
    "components/teams/TeamDetailView.tsx",
    "components/seasons/SeasonDetailView.tsx",
    "components/markets/MarketDetailView.tsx",
    "components/bible/BibleFixtureExplorer.tsx",
  ]) {
    const source = readFileSync(path.join(root, file), "utf8");
    assert.match(source, /EvidenceSection|EvidenceCard/);
  }
});

test("warm adapter cache stays under 50ms", () => {
  resetEvidenceUiCache();
  const stats: CompetitionResearchStats = {
    qualifiedFixtureCount: 10,
    uniqueMatchCount: 8,
    averageModelProbability: 70,
    marketBreakdown: [],
    sampleQuality: "limited",
    sampleNote: "Limited sample.",
  };
  fromCompetitionStats(stats, "competition:warm-test");
  const started = performance.now();
  fromCompetitionStats(stats, "competition:warm-test");
  assert.ok(performance.now() - started < 50);
});

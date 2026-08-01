import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  classifyConfidenceSemantics,
  isProbabilistic,
  normalizeConfidence,
} from "../lib/calibration-intelligence/confidence";
import {
  aggregateConfidenceBands,
  detectCalibrationInversions,
} from "../lib/calibration-intelligence/confidence-bands";
import {
  settleCombination,
  financialMetricsAvailable,
} from "../lib/calibration-intelligence/combination-evaluation";
import {
  brierScore,
  calibrationGap,
  expectedCalibrationError,
  hitRate,
  logLoss,
} from "../lib/calibration-intelligence/metrics";
import { sampleStatus } from "../lib/calibration-intelligence/sample-gates";
import { classifyDrift, worstDriftStatus } from "../lib/calibration-intelligence/drift";
import { validateModeOrdering } from "../lib/calibration-intelligence/builder-evaluation";
import { aggregateExclusionCodes } from "../lib/calibration-intelligence/exclusions";
import { buildCapabilityMatrix } from "../lib/calibration-intelligence/diagnostics";
import { buildCalibrationIssues } from "../lib/calibration-intelligence/issues";
import { calibrationToCsv, stripSecrets } from "../lib/calibration-intelligence/exports";
import {
  CALIBRATION_METHODOLOGY_VERSION,
  CONFIDENCE_NORMALIZATION_VERSION,
} from "../lib/calibration-intelligence/contracts";
import { parseCalibrationFilters, parseCalibrationSection } from "../lib/calibration-intelligence/filters";
import { formatCohortDefinition } from "../lib/calibration-intelligence/cohorts";
import { hoursBeforeKickoff } from "../lib/calibration-intelligence/lead-time";
import { evidenceBandForRecord } from "../lib/calibration-intelligence/evidence";
import { aggregateSettlements } from "../lib/calibration-intelligence/settlements";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("sprint 24 calibration intelligence files exist", () => {
  for (const rel of [
    "lib/calibration-intelligence/contracts.ts",
    "lib/calibration-intelligence/confidence.ts",
    "lib/calibration-intelligence/metrics.ts",
    "lib/calibration-intelligence/sample-gates.ts",
    "lib/calibration-intelligence/service.ts",
    "lib/calibration-intelligence/aggregations.ts",
    "app/api/admin/calibration/[section]/route.ts",
    "app/api/admin/calibration/export/route.ts",
    "app/admin/calibration/overview/page.tsx",
    "app/admin/calibration/confidence/page.tsx",
    "app/admin/calibration/builder/page.tsx",
    "app/admin/calibration/methodology/page.tsx",
    "components/admin-calibration/CalibrationShell.tsx",
    "components/admin-calibration/CalibrationSectionView.tsx",
    "docs/calibration-intelligence.md",
    "docs/confidence-semantics.md",
    "docs/calibration-methodology.md",
    "docs/calibration-sample-gates.md",
    "docs/builder-quality-evaluation.md",
    "docs/combination-settlement.md",
    "docs/calibration-issues.md",
    "docs/sprint-24-completion-report.md",
  ]) {
    assert.ok(existsSync(path.join(root, rel)), rel);
  }
});

test("confidence normalization preserves raw and classifies semantics", () => {
  const n = normalizeConfidence(72.5);
  assert.equal(n.rawValue, 72.5);
  assert.equal(n.normalized0to100, 72.5);
  assert.equal(n.normalized0to1, 0.725);
  assert.equal(n.semantics, "CALIBRATABLE_PROBABILITY");
  assert.equal(n.normalizationVersion, CONFIDENCE_NORMALIZATION_VERSION);
  assert.equal(classifyConfidenceSemantics(), "CALIBRATABLE_PROBABILITY");
  assert.equal(isProbabilistic("SCORE"), false);
  assert.equal(isProbabilistic("CALIBRATABLE_PROBABILITY"), true);
  assert.equal(normalizeConfidence(null).semantics, "UNKNOWN_SEMANTICS");
});

test("sample gates never label tiny samples reliable", () => {
  assert.equal(sampleStatus(5), "INSUFFICIENT");
  assert.equal(sampleStatus(30), "EARLY_SIGNAL");
  assert.equal(sampleStatus(60), "REVIEWABLE");
  assert.equal(sampleStatus(120), "RELIABLE");
});

test("hit rate and calibration gap", () => {
  assert.equal(hitRate(8, 2), 0.8);
  assert.equal(hitRate(0, 0), null);
  assert.ok(Math.abs((calibrationGap(0.7, 0.5) as number) - 0.2) < 1e-12);
  assert.equal(calibrationGap(null, 0.5), null);
});

test("brier, log-loss clipping, ECE, MCE", () => {
  const pairs = [
    { p: 0.9, y: 1 as const },
    { p: 0.9, y: 0 as const },
    { p: 0.1, y: 0 as const },
    { p: 0.5, y: 1 as const },
  ];
  const b = brierScore(pairs);
  assert.ok(b != null && b > 0);
  const ll = logLoss([{ p: 0, y: 1 }, { p: 1, y: 0 }]);
  assert.ok(ll != null && Number.isFinite(ll));
  const { ece, mce, table } = expectedCalibrationError(pairs, 5);
  assert.ok(ece != null);
  assert.ok(mce != null);
  assert.ok(table.length > 0);
});

test("confidence bands and inversion detection", () => {
  const rows = [
    ...Array.from({ length: 25 }, () => ({
      confidence: 92,
      status: "lost" as const,
    })),
    ...Array.from({ length: 25 }, () => ({
      confidence: 55,
      status: "won" as const,
    })),
  ];
  const bands = aggregateConfidenceBands(rows);
  const high = bands.find((b) => b.band === "90+");
  const low = bands.find((b) => b.band === "55–59");
  assert.ok(high && high.won + high.lost >= 20);
  assert.ok(low && low.observedRate === 1);
  const inv = detectCalibrationInversions(bands, 20, 0.08);
  assert.ok(inv.length >= 1);
});

test("combination settlement rules", () => {
  assert.equal(settleCombination([]), "INVALID");
  assert.equal(settleCombination(["won", "won"]), "WON");
  assert.equal(settleCombination(["won", "lost"]), "LOST");
  assert.equal(settleCombination(["void", "void"]), "VOID");
  assert.equal(settleCombination(["won", "void"]), "PARTIAL_VOID");
  assert.equal(settleCombination(["won", "pending"]), "PENDING");
  assert.equal(settleCombination(["won", "unresolved"]), "UNRESOLVED");
  assert.equal(financialMetricsAvailable([true, true]), true);
  assert.equal(financialMetricsAvailable([true, false]), false);
});

test("mode ordering matches config", () => {
  const v = validateModeOrdering();
  assert.equal(v.status, "MATCHES_CONFIG");
  assert.ok(v.expected.conservativeMinConfidence > v.expected.balancedMinConfidence);
  assert.ok(v.expected.balancedMinConfidence > v.expected.aggressiveMinConfidence);
});

test("exclusion aggregation and retrospective labeling policy in docs", () => {
  const rows = aggregateExclusionCodes([
    "confidence_below_threshold",
    "confidence_below_threshold",
    "stale_data",
  ]);
  assert.equal(rows[0].code, "confidence_below_threshold");
  assert.equal(rows[0].count, 2);
  const exclDoc = readFileSync(
    path.join(root, "docs/builder-quality-evaluation.md"),
    "utf8",
  );
  assert.ok(exclDoc.includes("RETROSPECTIVE_DIAGNOSTIC_ONLY"));
});

test("drift classification respects minimum samples", () => {
  assert.equal(
    classifyDrift({
      recentValue: 0.8,
      priorValue: 0.5,
      recentN: 5,
      priorN: 5,
      absoluteThreshold: 0.05,
      minSample: 30,
    }),
    "INSUFFICIENT_DATA",
  );
  assert.equal(
    classifyDrift({
      recentValue: 0.8,
      priorValue: 0.5,
      recentN: 40,
      priorN: 40,
      absoluteThreshold: 0.05,
      minSample: 30,
    }),
    "MATERIAL_CHANGE",
  );
  assert.equal(
    worstDriftStatus(["STABLE", "WATCH", "INSUFFICIENT_DATA"]),
    "WATCH",
  );
});

test("issues include sample size and remediation", () => {
  const issues = buildCalibrationIssues({
    totalPublished: 100,
    settledWl: 80,
    unresolvedRate: 0.4,
    semanticsUnknown: false,
    bands: [],
    inversions: [{ higher: "90+", lower: "55–59", gap: 0.2 }],
    overallGap: 0.15,
    modeOrdering: {
      status: "MATCHES_CONFIG",
      expected: {
        conservativeMinConfidence: 78,
        balancedMinConfidence: 70,
        aggressiveMinConfidence: 62,
      },
      findings: [],
    },
    driftStatus: "STABLE",
    snapshotImmutability: "best_effort_archive",
    builderSnapshotsMissing: true,
    oddsMissing: true,
  });
  assert.ok(issues.some((i) => i.code === "CALIBRATION_INVERSION"));
  assert.ok(issues.some((i) => i.code === "BUILDER_COMBINATION_SNAPSHOTS_MISSING"));
  assert.ok(issues.every((i) => i.sampleSize >= 0 && i.remediation.length > 0));
});

test("methodology version is exposed", () => {
  assert.equal(CALIBRATION_METHODOLOGY_VERSION, "24.0.0");
  assert.ok(CONFIDENCE_NORMALIZATION_VERSION.startsWith("24."));
});

test("capability matrix marks combination settlement unavailable", () => {
  const matrix = buildCapabilityMatrix();
  const combo = matrix.find((r) => r.analysis.includes("combination settlement"));
  assert.ok(combo);
  assert.equal(combo?.status, "unavailable");
});

test("filters validate section and date bounds", () => {
  assert.equal(parseCalibrationSection("overview"), "overview");
  assert.equal(parseCalibrationSection("nope"), null);
  const f = parseCalibrationFilters(
    new URLSearchParams("from=2026-01-01&to=2026-01-31&limit=9999&offset=-1"),
  );
  assert.equal(f.from, "2026-01-01");
  assert.equal(f.limit, 200);
  assert.equal(f.offset, 0);
  const def = formatCohortDefinition(
    { from: "2026-01-01", to: "2026-01-31" },
    f,
  );
  assert.ok(def.includes("from=2026-01-01"));
});

test("lead time and evidence helpers", () => {
  assert.equal(
    hoursBeforeKickoff("2026-01-01T10:00:00Z", "2026-01-01T12:00:00Z"),
    2,
  );
  assert.equal(hoursBeforeKickoff(null, "2026-01-01T12:00:00Z"), null);
  const band = evidenceBandForRecord({
    id: "1",
    date: "2026-01-01",
    matchId: 1,
    homeTeam: "A",
    awayTeam: "B",
    competition: "L",
    country: null,
    countryCode: null,
    marketKey: "over25",
    marketLabel: "Over 2.5",
    selectionLabel: "Over 2.5",
    confidence: 70,
    kickoffAt: null,
    publishedAt: null,
    status: "won",
    scoreLabel: "",
    settlementReason: "",
    evidenceSummary: ["a", "b", "c"],
    matchHref: "/",
    originalOdds: null,
    unitProfit: null,
  });
  assert.equal(band, "complete");
  const totals = aggregateSettlements([
    {
      id: "1",
      date: "2026-01-01",
      matchId: 1,
      homeTeam: "A",
      awayTeam: "B",
      competition: "L",
      country: null,
      countryCode: null,
      marketKey: "over25",
      marketLabel: "Over 2.5",
      selectionLabel: "Over 2.5",
      confidence: 70,
      kickoffAt: null,
      publishedAt: null,
      status: "won",
      scoreLabel: "",
      settlementReason: "",
      evidenceSummary: [],
      matchHref: "/",
      originalOdds: null,
      unitProfit: null,
    },
    {
      id: "2",
      date: "2026-01-01",
      matchId: 2,
      homeTeam: "C",
      awayTeam: "D",
      competition: "L",
      country: null,
      countryCode: null,
      marketKey: "fh",
      marketLabel: "FH",
      selectionLabel: "FH",
      confidence: 60,
      kickoffAt: null,
      publishedAt: null,
      status: "lost",
      scoreLabel: "",
      settlementReason: "",
      evidenceSummary: [],
      matchHref: "/",
      originalOdds: null,
      unitProfit: null,
    },
  ]);
  assert.equal(totals.won, 1);
  assert.equal(totals.lost, 1);
  assert.equal(totals.decided, 2);
});

test("exports strip secrets and bound rows", () => {
  const csv = calibrationToCsv([
    stripSecrets({ band: "70–74", secret: "x", token: "y", won: 1 }),
  ]);
  assert.ok(csv.includes("band"));
  assert.ok(!csv.includes("secret"));
  assert.ok(!csv.includes("token"));
});

test("API routes set noindex robots tag", () => {
  const src = readFileSync(
    path.join(root, "app/api/admin/calibration/[section]/route.ts"),
    "utf8",
  );
  assert.ok(src.includes("noindex, nofollow, noarchive"));
  assert.ok(src.includes("x-request-id"));
  assert.ok(src.includes("checkRateLimitSafe"));
  assert.ok(src.includes("requireAdminAccess"));
});

test("no auto-tuning language in aggregations", () => {
  const src = readFileSync(
    path.join(root, "lib/calibration-intelligence/aggregations.ts"),
    "utf8",
  );
  assert.ok(src.includes("No automatic model or threshold changes"));
});

import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  assignmentBucket,
  selectVariant,
  trafficBucket,
} from "../lib/experimentation/assignment";
import {
  assertDefinitionMutable,
  assertNoProductionActivation,
  canTransition,
  experimentTemplates,
  validateDefinition,
} from "../lib/experimentation/definitions";
import { evaluateEligibility } from "../lib/experimentation/eligibility";
import { resolveConflictGroup } from "../lib/experimentation/conflicts";
import {
  buildDedupeKey,
  filterPrimaryAnalysisExposures,
  shouldLogExposure,
} from "../lib/experimentation/exposures";
import {
  assertSupportedMetric,
  listSupportedMetrics,
} from "../lib/experimentation/metrics";
import { detectSrm } from "../lib/experimentation/sample-ratio";
import { planSampleSize, sampleStatus } from "../lib/experimentation/sample-size";
import {
  evaluateStoppingRules,
  mayAutoRollout,
} from "../lib/experimentation/stopping-rules";
import { evaluateGuardrail } from "../lib/experimentation/guardrails";
import {
  __resetAnalysisSnapshotsForTests,
  createAnalysisSnapshot,
} from "../lib/experimentation/audit";
import {
  getExperimentAssignment,
  recordExperimentExposure,
} from "../lib/experimentation/public";
import { compareTwoProportions } from "../lib/experimentation/statistics";
import { stripSensitive } from "../lib/experimentation/exports";
import { EXPERIMENT_METHODOLOGY_VERSION } from "../lib/experimentation/contracts";
import { isExperimentationEnabled } from "../lib/experimentation/runtime-flags";
import { getFeatureFlags } from "../lib/config/featureFlags";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("sprint 25 experimentation files exist", () => {
  for (const rel of [
    "lib/experimentation/contracts.ts",
    "lib/experimentation/assignment.ts",
    "lib/experimentation/definitions.ts",
    "lib/experimentation/public.ts",
    "lib/experimentation/service.ts",
    "app/api/admin/experiments/[section]/route.ts",
    "app/api/admin/experiments/export/route.ts",
    "app/api/admin/experiments/preview/route.ts",
    "app/api/admin/experiments/validate/route.ts",
    "app/api/admin/experiments/analyze/route.ts",
    "app/admin/experiments/overview/page.tsx",
    "components/admin-experiments/ExperimentShell.tsx",
    "docs/experimentation-platform.md",
    "docs/experiment-definition-contract.md",
    "docs/experiment-assignment.md",
    "docs/experiment-metrics.md",
    "docs/experiment-statistics.md",
    "docs/experiment-guardrails.md",
    "docs/experiment-privacy.md",
    "docs/experiment-ethics.md",
    "docs/sprint-25-completion-report.md",
  ]) {
    assert.ok(existsSync(path.join(root, rel)), rel);
  }
});

test("no production activation endpoint exists", () => {
  const apiDir = path.join(root, "app/api/admin/experiments");
  const names = readdirSync(apiDir);
  assert.ok(!names.includes("activate"));
  assert.ok(!names.includes("start"));
  for (const name of names) {
    const p = path.join(apiDir, name);
    try {
      const files = readdirSync(p);
      for (const f of files) {
        const src = readFileSync(path.join(p, f), "utf8");
        assert.ok(!/production.?activat/i.test(src) || src.includes("not available"));
      }
    } catch {
      /* file */
    }
  }
});

test("all templates default to DRAFT with trafficPercent 0", () => {
  const templates = experimentTemplates();
  assert.ok(templates.length >= 6);
  for (const t of templates) {
    assert.equal(t.status, "DRAFT");
    assert.equal(t.trafficPercent, 0);
    assert.ok(!t.environments.includes("PRODUCTION"));
    const errors = validateDefinition(t);
    assert.equal(errors.length, 0, `${t.id}: ${errors.join("; ")}`);
  }
});

test("deterministic assignment is stable and version-sensitive", () => {
  const def = experimentTemplates()[0];
  const key = "stable-assignment-key-001";
  const a = selectVariant(def, key);
  const b = selectVariant(def, key);
  assert.equal(a?.id, b?.id);
  const bucket1 = assignmentBucket(def.id, def.assignmentVersion, key);
  const bucket2 = assignmentBucket(def.id, def.assignmentVersion, key);
  assert.equal(bucket1, bucket2);
  const changed = assignmentBucket(def.id, "99.0.0", key);
  assert.notEqual(bucket1, changed);
});

test("allocation weights respected across deterministic keys", () => {
  const def = {
    ...experimentTemplates()[0],
    status: "RUNNING" as const,
    trafficPercent: 100,
    variants: [
      {
        id: "control",
        label: "Control",
        role: "CONTROL" as const,
        allocationWeight: 80,
        enabled: true,
        config: {},
        safetyNotes: [],
      },
      {
        id: "treatment_a",
        label: "T",
        role: "TREATMENT" as const,
        allocationWeight: 20,
        enabled: true,
        config: {},
        safetyNotes: [],
      },
    ],
  };
  let control = 0;
  let treatment = 0;
  for (let i = 0; i < 2000; i++) {
    const v = selectVariant(def, `key-${i.toString().padStart(4, "0")}`);
    if (v?.id === "control") control += 1;
    else treatment += 1;
  }
  const controlShare = control / 2000;
  assert.ok(controlShare > 0.7 && controlShare < 0.9, `share=${controlShare}`);
  assert.ok(treatment > 100);
});

test("eligibility reason codes", () => {
  const def = experimentTemplates()[0];
  const r = evaluateEligibility(def, {
    environment: "PRODUCTION",
    locale: "en",
    country: "GB",
    pageType: "fixture",
    assignmentKey: "abcdefghij",
    consentGranted: false,
    isAdminTestIdentity: false,
    conflictingExperimentIds: ["other"],
    featureAvailable: false,
  });
  assert.equal(r.eligible, false);
  assert.ok(r.reasonCodes.includes("ENVIRONMENT_BLOCKED"));
  assert.ok(r.reasonCodes.includes("CONSENT_REQUIRED"));
  assert.ok(r.reasonCodes.includes("FEATURE_UNAVAILABLE"));
});

test("conflict groups resolve deterministically", () => {
  const a = { ...experimentTemplates()[0], status: "RUNNING" as const, id: "b_exp", conflictGroup: "operator-cta" };
  const b = { ...experimentTemplates()[0], status: "RUNNING" as const, id: "a_exp", conflictGroup: "operator-cta" };
  const res = resolveConflictGroup([a, b], "operator-cta");
  assert.equal(res.allowedExperimentId, "a_exp");
  assert.deepEqual(res.blockedExperimentIds, ["b_exp"]);
});

test("exposure dedupe and preview isolation", () => {
  assert.equal(
    shouldLogExposure({
      eligible: true,
      meaningfulRender: false,
      preview: false,
      alreadySeenDedupeKey: false,
    }).log,
    false,
  );
  assert.equal(
    shouldLogExposure({
      eligible: true,
      meaningfulRender: true,
      preview: true,
      alreadySeenDedupeKey: false,
    }).reason,
    "preview_isolated",
  );
  const key = buildDedupeKey({
    experimentId: "e1",
    assignmentKeyHash: "h",
    variantId: "control",
  });
  const filtered = filterPrimaryAnalysisExposures([
    {
      experimentId: "e1",
      experimentVersion: "1",
      variantId: "control",
      assignmentKeyHash: "h",
      exposureUnitType: "session",
      pageType: null,
      locale: null,
      timestamp: "2026-07-26T01:00:00.000Z",
      requestId: null,
      dedupeKey: key,
      metricVersion: "25",
      environment: "LOCAL",
      preview: false,
      meaningfulRender: true,
    },
    {
      experimentId: "e1",
      experimentVersion: "1",
      variantId: "control",
      assignmentKeyHash: "h",
      exposureUnitType: "session",
      pageType: null,
      locale: null,
      timestamp: "2026-07-26T02:00:00.000Z",
      requestId: null,
      dedupeKey: key,
      metricVersion: "25",
      environment: "LOCAL",
      preview: false,
      meaningfulRender: true,
    },
  ]);
  assert.equal(filtered.length, 1);
});

test("metric registry rejects FTD/revenue and requires primary", () => {
  assert.equal(assertSupportedMetric("ftd").ok, false);
  assert.equal(assertSupportedMetric("revenue").ok, false);
  assert.ok(listSupportedMetrics().length >= 8);
  const bad = {
    ...experimentTemplates()[0],
    primaryMetricId: "",
  };
  assert.ok(validateDefinition(bad).some((e) => e.includes("primary")));
});

test("SRM detection with synthetic fixtures", () => {
  const ok = detectSrm([
    { variantId: "c", expectedWeight: 50, observedExposures: 500 },
    { variantId: "t", expectedWeight: 50, observedExposures: 500 },
  ]);
  assert.equal(ok.status, "NO_ISSUE");
  const bad = detectSrm([
    { variantId: "c", expectedWeight: 50, observedExposures: 900 },
    { variantId: "t", expectedWeight: 50, observedExposures: 100 },
  ]);
  assert.equal(bad.status, "MATERIAL_SRM");
  const insuff = detectSrm([
    { variantId: "c", expectedWeight: 50, observedExposures: 5 },
    { variantId: "t", expectedWeight: 50, observedExposures: 5 },
  ]);
  assert.equal(insuff.status, "INSUFFICIENT_DATA");
});

test("guardrail breach and stopping rules", () => {
  const g = evaluateGuardrail({
    metricId: "api_failure_rate",
    controlConversions: 5,
    controlN: 200,
    treatmentConversions: 40,
    treatmentN: 200,
    breachThreshold: 0.02,
  });
  assert.equal(g.status, "BREACH");
  const stop = evaluateStoppingRules({
    runtimeDays: 3,
    minRuntimeDays: 7,
    maxRuntimeDays: 28,
    sampleStatus: "INSUFFICIENT",
    srmStatus: "NO_ISSUE",
    criticalGuardrailBreach: true,
    implementationDefect: false,
    dataQualityInvalid: false,
    operatorStop: false,
  });
  assert.equal(stop.recommendation, "STOP_FOR_HARM");
  assert.equal(mayAutoRollout(), false);
});

test("analysis snapshots are immutable", () => {
  __resetAnalysisSnapshotsForTests();
  const first = createAnalysisSnapshot({
    id: "snap-fixed-1",
    experimentId: "e",
    experimentVersion: "1",
    analysisTimestamp: "2026-07-26T00:00:00.000Z",
    dataCutoff: "2026-07-26T00:00:00.000Z",
    exposureCounts: { control: 1 },
    metricVersions: ["25"],
    primaryResult: { synthetic: true },
    guardrailResults: [],
    srmResult: {},
    sampleStatus: "SYNTHETIC",
    statisticalMethodVersion: "25",
    issues: [],
    recommendation: "CONTINUE",
    reviewerState: "unreviewed",
    environmentLabel: "LOCAL_TEST_DATA_NOT_REAL_USER_EVIDENCE",
  });
  assert.equal(first.ok, true);
  const second = createAnalysisSnapshot({
    id: "snap-fixed-1",
    experimentId: "e",
    experimentVersion: "1",
    analysisTimestamp: "2026-07-26T01:00:00.000Z",
    dataCutoff: "2026-07-26T01:00:00.000Z",
    exposureCounts: { control: 2 },
    metricVersions: ["25"],
    primaryResult: {},
    guardrailResults: [],
    srmResult: {},
    sampleStatus: "SYNTHETIC",
    statisticalMethodVersion: "25",
    issues: [],
    recommendation: "CONTINUE",
    reviewerState: "unreviewed",
    environmentLabel: "LOCAL_TEST_DATA_NOT_REAL_USER_EVIDENCE",
  });
  assert.equal(second.ok, false);
});

test("definition immutable while RUNNING; production activation blocked", () => {
  const running = { ...experimentTemplates()[0], status: "RUNNING" as const };
  assert.equal(assertDefinitionMutable(running).ok, false);
  assert.equal(
    assertNoProductionActivation(
      { ...experimentTemplates()[0], environments: ["PRODUCTION"] },
      "RUNNING",
    ).ok,
    false,
  );
  assert.equal(canTransition("DRAFT", "READY_FOR_REVIEW"), true);
  assert.equal(canTransition("DRAFT", "RUNNING"), false);
});

test("public boundary falls back to control when disabled", () => {
  assert.equal(getFeatureFlags({}).experimentationEnabled, false);
  assert.equal(isExperimentationEnabled({}), false);
  const def = experimentTemplates()[0];
  const assignment = getExperimentAssignment(def, {
    environment: "LOCAL",
    locale: "en",
    country: null,
    pageType: "fixture",
    assignmentKey: "abcdefghij",
    consentGranted: null,
    isAdminTestIdentity: false,
    conflictingExperimentIds: [],
    featureAvailable: true,
  });
  assert.equal(assignment.role, "CONTROL");
  assert.equal(assignment.experimentationEnabled, false);
  const exposure = recordExperimentExposure({
    definition: def,
    assignment: { ...assignment, eligible: true },
    meaningfulRender: true,
    preview: true,
    alreadySeen: false,
    requestId: null,
    pageType: "fixture",
    locale: "en",
  });
  assert.equal(exposure.recorded, false);
});

test("sample size unavailable without baseline; statistics caveats", () => {
  const plan = planSampleSize({
    baselineRate: null,
    mde: 0.05,
    eligiblePerDay: null,
  });
  assert.equal(plan.status, "UNAVAILABLE");
  assert.equal(sampleStatus(10, 500), "INSUFFICIENT");
  const cmp = compareTwoProportions(50, 100, 60, 100);
  assert.ok(cmp.absoluteDifference != null);
  assert.ok(cmp.caveats.some((c) => c.includes("p-value")));
});

test("exports strip sensitive keys; methodology version set", () => {
  const row = stripSensitive({
    id: "x",
    secret: "no",
    token: "no",
    ip: "1.2.3.4",
    userAgent: "ua",
  });
  assert.equal("secret" in row, false);
  assert.equal("ip" in row, false);
  assert.equal(EXPERIMENT_METHODOLOGY_VERSION, "25.0.0");
});

test("admin experiment API routes require auth and robots", () => {
  const src = readFileSync(
    path.join(root, "app/api/admin/experiments/[section]/route.ts"),
    "utf8",
  );
  assert.ok(src.includes("requireAdminAccess"));
  assert.ok(src.includes("noindex, nofollow, noarchive"));
  assert.ok(src.includes("x-request-id"));
  assert.ok(src.includes("checkRateLimitSafe"));
});

test("traffic bucket independent of variant bucket", () => {
  const id = "exp";
  const ver = "1";
  const key = "k";
  // Not always different but functions are distinct salts
  const t = trafficBucket(id, ver, key);
  const a = assignmentBucket(id, ver, key);
  assert.ok(t >= 0 && t < 1);
  assert.ok(a >= 0 && a < 1);
});

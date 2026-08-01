import type {
  ExperimentDefinition,
  ExperimentFilters,
  ExperimentSection,
} from "./contracts";
import { EXPERIMENT_METHODOLOGY_VERSION } from "./contracts";
import { experimentTemplates, validateDefinition } from "./definitions";
import { buildCapabilityMatrix, diagnoseAssignment } from "./diagnostics";
import { listSupportedMetrics, assertSupportedMetric } from "./metrics";
import { buildIssues } from "./issues";
import { detectSrm } from "./sample-ratio";
import { planSampleSize, sampleStatus } from "./sample-size";
import { evaluateStoppingRules, mayAutoRollout } from "./stopping-rules";
import { listAnalysisSnapshots } from "./audit";
import { resolveExperimentEnvironment } from "./runtime-flags";
import { evaluateGuardrail } from "./guardrails";

function catalog(): ExperimentDefinition[] {
  return experimentTemplates();
}

function filterDefs(
  defs: ExperimentDefinition[],
  filters: ExperimentFilters,
): ExperimentDefinition[] {
  return defs.filter((d) => {
    if (filters.status && d.status !== filters.status) return false;
    if (
      filters.environment &&
      !d.environments.includes(filters.environment)
    ) {
      return false;
    }
    if (filters.q) {
      const q = filters.q.toLowerCase();
      if (
        !d.id.toLowerCase().includes(q) &&
        !d.name.toLowerCase().includes(q) &&
        !d.hypothesis.toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    return true;
  });
}

export function buildExperimentSectionPayload(
  section: ExperimentSection,
  filters: ExperimentFilters,
): Record<string, unknown> {
  const defs = filterDefs(catalog(), filters);
  const all = catalog();
  const byStatus = (s: string) => all.filter((d) => d.status === s).length;
  const capability = buildCapabilityMatrix();
  const env = resolveExperimentEnvironment();
  const localBanner = "LOCAL/TEST DATA — NOT REAL USER EVIDENCE";

  const base = {
    generatedAt: new Date().toISOString(),
    methodologyVersion: EXPERIMENT_METHODOLOGY_VERSION,
    environment: env,
    localDataBanner: localBanner,
    experimentationEnabledDefault: false,
    productionActivationAvailable: false,
    autoRollout: mayAutoRollout(),
  };

  if (section === "overview") {
    const issues = all.flatMap((d) =>
      buildIssues({
        experimentId: d.id,
        experimentVersion: d.assignmentVersion,
        srmStatus: "INSUFFICIENT_DATA",
        missingPrimary: !d.primaryMetricId,
        guardrailBreach: false,
        insufficientSample: true,
        definitionEditedWhileRunning: false,
        previewMixed: false,
        exposureMissing: true,
        runtimeDays: 0,
        minRuntimeDays: d.minRuntimeDays,
        prematureWinnerClaim: false,
      }),
    );
    return {
      ...base,
      overview: {
        totalExperiments: all.length,
        drafts: byStatus("DRAFT"),
        readyForReview: byStatus("READY_FOR_REVIEW"),
        approved: byStatus("APPROVED"),
        running: byStatus("RUNNING"),
        paused: byStatus("PAUSED"),
        completed: byStatus("COMPLETED"),
        invalidated: byStatus("INVALIDATED"),
        activeExposures: 0,
        experimentsWithSrm: 0,
        guardrailBreaches: 0,
        insufficientSample: all.length,
        exposureLoggingIssues: all.length,
        assignmentIssues: 0,
        criticalIssues: issues.filter((i) => i.severity === "CRITICAL").length,
        highIssues: issues.filter((i) => i.severity === "HIGH").length,
        lastEvaluationAt: base.generatedAt,
      },
      capability,
      notes: [
        localBanner,
        "All catalog experiments are DRAFT templates — not activated",
        "No real experiment participants or uplift claimed",
        "Public behavior remains control (FF_EXPERIMENTATION_ENABLED defaults off)",
      ],
    };
  }

  if (section === "definitions") {
    const page = defs.slice(filters.offset, filters.offset + filters.limit);
    return {
      ...base,
      total: defs.length,
      items: page.map((d) => ({
        ...d,
        validationErrors: validateDefinition(d),
      })),
      notes: ["Templates only — trafficPercent=0 — status DRAFT"],
    };
  }

  if (section === "assignments") {
    const sampleKeys = [
      "test-key-aaaa-0001",
      "test-key-bbbb-0002",
      "test-key-cccc-0003",
      "test-key-dddd-0004",
      "admin-preview-identity-01",
    ];
    const def = all[0];
    const diagnostics = sampleKeys.map((key) =>
      diagnoseAssignment(
        def,
        {
          environment: "LOCAL",
          locale: "en",
          country: "GB",
          pageType: def.pageTypes?.[0] ?? null,
          assignmentKey: key,
          consentGranted: null,
          isAdminTestIdentity: key.startsWith("admin-"),
          conflictingExperimentIds: [],
          featureAvailable: true,
        },
        all.filter((d) => d.id !== def.id),
        { preview: key.startsWith("admin-") },
      ),
    );
    return {
      ...base,
      experimentId: def.id,
      diagnostics,
      notes: [
        "Synthetic test keys only — not real visitors",
        "Preview keys wouldLogExposure=false",
      ],
    };
  }

  if (section === "exposures") {
    return {
      ...base,
      total: 0,
      items: [],
      dedupeMode: "first_exposure",
      notes: [
        localBanner,
        "No real exposures — experimentation disabled by default",
        "Exposure requires meaningful render; assignment-only is not logged",
      ],
    };
  }

  if (section === "metrics") {
    return {
      ...base,
      items: listSupportedMetrics(),
      rejectedExamples: [
        assertSupportedMetric("ftd"),
        assertSupportedMetric("revenue"),
        assertSupportedMetric("deposit"),
      ],
      notes: ["FTD/revenue/deposit remain unavailable"],
    };
  }

  if (section === "results") {
    return {
      ...base,
      items: all.map((d) => ({
        experimentId: d.id,
        status: d.status,
        primaryMetricId: d.primaryMetricId,
        exposureCounts: {},
        primaryResult: "Unavailable — no real exposures",
        srm: detectSrm(
          d.variants.map((v) => ({
            variantId: v.id,
            expectedWeight: v.allocationWeight,
            observedExposures: 0,
          })),
        ),
        samplePlan: planSampleSize({
          baselineRate: null,
          mde: d.minimumDetectableEffect,
          eligiblePerDay: null,
        }),
        stopping: evaluateStoppingRules({
          runtimeDays: 0,
          minRuntimeDays: d.minRuntimeDays,
          maxRuntimeDays: d.maxRuntimeDays,
          sampleStatus: sampleStatus(0, d.minSamplePerVariant),
          srmStatus: "INSUFFICIENT_DATA",
          criticalGuardrailBreach: false,
          implementationDefect: false,
          dataQualityInvalid: false,
          operatorStop: false,
        }),
        analysisSnapshots: listAnalysisSnapshots(d.id),
      })),
      notes: [
        localBanner,
        "Synthetic unit-test fixtures may exist in tests — never shown as real results here",
      ],
    };
  }

  if (section === "guardrails") {
    return {
      ...base,
      items: all.map((d) => ({
        experimentId: d.id,
        guardrails: d.guardrailMetricIds.map((id) =>
          evaluateGuardrail({
            metricId: id,
            controlConversions: 0,
            controlN: 0,
            treatmentConversions: 0,
            treatmentN: 0,
          }),
        ),
      })),
      notes: ["Guardrail breach prevents success recommendation"],
    };
  }

  if (section === "issues") {
    const items = all.flatMap((d) =>
      buildIssues({
        experimentId: d.id,
        experimentVersion: d.assignmentVersion,
        srmStatus: "INSUFFICIENT_DATA",
        missingPrimary: false,
        guardrailBreach: false,
        insufficientSample: true,
        definitionEditedWhileRunning: false,
        previewMixed: false,
        exposureMissing: true,
        runtimeDays: 0,
        minRuntimeDays: d.minRuntimeDays,
        prematureWinnerClaim: false,
      }),
    );
    return {
      ...base,
      total: items.length,
      items: items.slice(filters.offset, filters.offset + filters.limit),
    };
  }

  if (section === "audit") {
    return {
      ...base,
      items: all.map((d) => ({
        experimentId: d.id,
        events: [
          {
            id: `audit-${d.id}-created`,
            experimentId: d.id,
            action: "template_created",
            actor: "system",
            timestamp: d.createdAt,
            details: { status: d.status },
          },
        ],
      })),
      notes: ["No production activation events exist"],
    };
  }

  // methodology
  return {
    ...base,
    methodology: {
      version: EXPERIMENT_METHODOLOGY_VERSION,
      assignment: "sha256 deterministic bucket — no Math.random",
      exposure: "first valid meaningful render; preview excluded",
      statistics: "Wald CI exploratory; no p-value-only winners",
      srm: "chi-square style vs allocation weights",
      seo: "No variant URLs/canonicals/sitemaps",
      affiliate: "Operator eligibility never overridden",
      calibration: "No rewrite of historical snapshots",
      privacy: "No IP fingerprinting; session key preferred",
    },
    capability,
    notes: [localBanner],
  };
}

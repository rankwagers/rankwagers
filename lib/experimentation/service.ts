import "server-only";
import type { ExperimentFilters, ExperimentSection } from "./contracts";
import { buildExperimentSectionPayload } from "./aggregations";
import { experimentTemplates } from "./definitions";
import { diagnoseAssignment } from "./diagnostics";
import { experimentToCsv, experimentToJson, stripSensitive } from "./exports";
import { createAnalysisSnapshot } from "./audit";
import { compareTwoProportions } from "./statistics";
import { detectSrm } from "./sample-ratio";
import { EXPERIMENT_METHODOLOGY_VERSION } from "./contracts";

export async function getExperimentSection(
  section: ExperimentSection,
  filters: ExperimentFilters,
): Promise<Record<string, unknown>> {
  return buildExperimentSectionPayload(section, filters);
}

export async function validateExperimentDefinition(id: string) {
  const def = experimentTemplates().find((d) => d.id === id);
  if (!def) return { ok: false, error: "not_found" as const };
  const { validateDefinition } = await import("./definitions");
  return { ok: true as const, errors: validateDefinition(def), definition: def };
}

export async function previewExperimentAssignment(input: {
  experimentId: string;
  assignmentKey: string;
  locale?: string | null;
  country?: string | null;
  pageType?: string | null;
}) {
  const def = experimentTemplates().find((d) => d.id === input.experimentId);
  if (!def) return { ok: false as const, error: "not_found" };
  const diag = diagnoseAssignment(
    def,
    {
      environment: "LOCAL",
      locale: input.locale ?? "en",
      country: input.country ?? null,
      pageType: input.pageType ?? def.pageTypes?.[0] ?? null,
      assignmentKey: input.assignmentKey,
      consentGranted: null,
      isAdminTestIdentity: true,
      conflictingExperimentIds: [],
      featureAvailable: true,
    },
    experimentTemplates().filter((d) => d.id !== def.id),
    { preview: true },
  );
  return {
    ok: true as const,
    preview: true,
    recordsProductionExposure: false,
    diagnostics: diag,
  };
}

/** Synthetic analyze for integrity tests / admin — never claims real uplift. */
export async function analyzeExperimentSynthetic(input: {
  experimentId: string;
  controlConversions: number;
  controlN: number;
  treatmentConversions: number;
  treatmentN: number;
  controlExposures: number;
  treatmentExposures: number;
}) {
  const def = experimentTemplates().find((d) => d.id === input.experimentId);
  if (!def) return { ok: false as const, error: "not_found" };
  const primary = compareTwoProportions(
    input.controlConversions,
    input.controlN,
    input.treatmentConversions,
    input.treatmentN,
  );
  const srm = detectSrm([
    {
      variantId: "control",
      expectedWeight:
        def.variants.find((v) => v.role === "CONTROL")?.allocationWeight ?? 50,
      observedExposures: input.controlExposures,
    },
    {
      variantId: "treatment",
      expectedWeight:
        def.variants.find((v) => v.role === "TREATMENT")?.allocationWeight ?? 50,
      observedExposures: input.treatmentExposures,
    },
  ]);
  const snap = createAnalysisSnapshot({
    id: `snap-${def.id}-${Date.now()}`,
    experimentId: def.id,
    experimentVersion: def.assignmentVersion,
    analysisTimestamp: new Date().toISOString(),
    dataCutoff: new Date().toISOString(),
    exposureCounts: {
      control: input.controlExposures,
      treatment: input.treatmentExposures,
    },
    metricVersions: [def.metricVersion],
    primaryResult: { ...primary, label: "SYNTHETIC_FIXTURE_NOT_REAL" },
    guardrailResults: [],
    srmResult: srm,
    sampleStatus: "SYNTHETIC",
    statisticalMethodVersion: primary.methodVersion,
    issues: srm.status === "MATERIAL_SRM" ? ["MATERIAL_SRM"] : [],
    recommendation:
      srm.status === "MATERIAL_SRM" ? "INVALIDATE" : "CONTINUE",
    reviewerState: "unreviewed",
    environmentLabel: "LOCAL_TEST_DATA_NOT_REAL_USER_EVIDENCE",
  });
  return {
    ok: true as const,
    methodologyVersion: EXPERIMENT_METHODOLOGY_VERSION,
    synthetic: true,
    realUserEvidence: false,
    snapshot: snap.ok ? snap.snapshot : null,
    snapshotError: snap.ok ? null : snap.error,
    primary,
    srm,
  };
}

export async function exportExperimentSection(
  section: ExperimentSection,
  format: "csv" | "json",
  filters: ExperimentFilters,
): Promise<{ body: string; contentType: string; filename: string }> {
  const payload = buildExperimentSectionPayload(section, {
    ...filters,
    offset: 0,
    limit: 2000,
  });
  let rows: Array<Record<string, unknown>> = [];
  if (section === "definitions") {
    rows = ((payload.items as Array<Record<string, unknown>>) ?? []).map((d) =>
      stripSensitive({
        id: d.id,
        name: d.name,
        status: d.status,
        primaryMetricId: d.primaryMetricId,
        conflictGroup: d.conflictGroup,
        trafficPercent: d.trafficPercent,
      }),
    );
  } else if (section === "metrics") {
    rows = ((payload.items as Array<Record<string, unknown>>) ?? []).map((m) =>
      stripSensitive({
        id: m.id,
        displayName: m.displayName,
        type: m.type,
        dataAvailability: m.dataAvailability,
        direction: m.direction,
      }),
    );
  } else if (section === "issues") {
    rows = ((payload.items as Array<Record<string, unknown>>) ?? []).map((i) =>
      stripSensitive({
        code: i.code,
        severity: i.severity,
        experimentId: i.experimentId,
        explanation: i.explanation,
      }),
    );
  } else {
    rows = [
      stripSensitive({
        section,
        methodologyVersion: payload.methodologyVersion,
        localDataBanner: payload.localDataBanner,
        productionActivationAvailable: payload.productionActivationAvailable,
      }),
    ];
  }
  const stamp = new Date().toISOString().slice(0, 10);
  if (format === "csv") {
    return {
      body: experimentToCsv(rows),
      contentType: "text/csv; charset=utf-8",
      filename: `experiments-${section}-${stamp}.csv`,
    };
  }
  return {
    body: experimentToJson({
      section,
      localDataBanner: payload.localDataBanner,
      rows,
      notes: ["Secrets, IPs, and signed tokens are never exported"],
    }),
    contentType: "application/json; charset=utf-8",
    filename: `experiments-${section}-${stamp}.json`,
  };
}

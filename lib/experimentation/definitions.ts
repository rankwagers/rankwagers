import type {
  ExperimentDefinition,
  ExperimentStatus,
  ExperimentVariant,
} from "./contracts";
import {
  EXPERIMENT_ASSIGNMENT_VERSION_DEFAULT,
  EXPERIMENT_METHODOLOGY_VERSION,
} from "./contracts";
import { assertSupportedMetric } from "./metrics";

const ALLOWED_TRANSITIONS: Record<ExperimentStatus, ExperimentStatus[]> = {
  DRAFT: ["READY_FOR_REVIEW", "ARCHIVED"],
  READY_FOR_REVIEW: ["DRAFT", "APPROVED", "ARCHIVED"],
  APPROVED: ["SCHEDULED", "DRAFT", "ARCHIVED"],
  SCHEDULED: ["RUNNING", "PAUSED", "APPROVED", "ARCHIVED"],
  RUNNING: ["PAUSED", "STOPPED", "COMPLETED", "INVALIDATED"],
  PAUSED: ["RUNNING", "STOPPED", "INVALIDATED"],
  STOPPED: ["COMPLETED", "ARCHIVED", "INVALIDATED"],
  COMPLETED: ["ARCHIVED"],
  ARCHIVED: [],
  INVALIDATED: ["ARCHIVED"],
};

export function canTransition(
  from: ExperimentStatus,
  to: ExperimentStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Production RUNNING activation is not available in Sprint 25. */
export function assertNoProductionActivation(
  definition: ExperimentDefinition,
  nextStatus: ExperimentStatus,
): { ok: boolean; error?: string } {
  if (
    nextStatus === "RUNNING" &&
    definition.environments.includes("PRODUCTION")
  ) {
    return {
      ok: false,
      error:
        "Production experiment activation is not available in Sprint 25 — deferred to operator-approved workflow",
    };
  }
  return { ok: true };
}

export function validateDefinition(def: ExperimentDefinition): string[] {
  const errors: string[] = [];
  if (!def.id || !/^[a-z0-9][a-z0-9_-]{2,63}$/.test(def.id)) {
    errors.push("id must be stable slug [a-z0-9_-] length 3–64");
  }
  if (!def.name?.trim()) errors.push("name required");
  if (!def.hypothesis || def.hypothesis.trim().length < 20) {
    errors.push("hypothesis required (≥20 chars)");
  }
  if (!def.owner?.trim()) errors.push("owner required");
  if (!def.primaryMetricId) errors.push("primaryMetricId required");
  const primary = assertSupportedMetric(def.primaryMetricId);
  if (!primary.ok) errors.push(primary.error || "primary metric invalid");

  for (const id of def.secondaryMetricIds) {
    const m = assertSupportedMetric(id);
    if (!m.ok) errors.push(m.error || `secondary ${id}`);
  }
  for (const id of def.guardrailMetricIds) {
    const m = assertSupportedMetric(id);
    if (!m.ok) errors.push(m.error || `guardrail ${id}`);
    else if (m.metric && !m.metric.guardrailSuitable) {
      errors.push(`metric ${id} is not guardrail-suitable`);
    }
  }

  if (def.variants.length < 2) errors.push("at least control + one treatment");
  const controls = def.variants.filter((v) => v.role === "CONTROL");
  if (controls.length !== 1) errors.push("exactly one CONTROL variant required");
  const weightSum = def.variants.reduce((s, v) => s + v.allocationWeight, 0);
  if (weightSum <= 0) errors.push("allocation weights must sum > 0");
  for (const v of def.variants) {
    errors.push(...validateVariantConfig(v));
  }
  if (def.minSamplePerVariant < 1) errors.push("minSamplePerVariant ≥ 1");
  if (def.minRuntimeDays < 1) errors.push("minRuntimeDays ≥ 1");
  if (def.maxRuntimeDays < def.minRuntimeDays) {
    errors.push("maxRuntimeDays ≥ minRuntimeDays");
  }
  return errors;
}

const FORBIDDEN_CONFIG_KEYS = [
  "secret",
  "token",
  "password",
  "apiKey",
  "signature",
  "executable",
  "script",
];

export function validateVariantConfig(v: ExperimentVariant): string[] {
  const errors: string[] = [];
  if (!v.id) errors.push(`variant missing id`);
  if (v.allocationWeight < 0) errors.push(`variant ${v.id} weight < 0`);
  for (const key of Object.keys(v.config)) {
    if (FORBIDDEN_CONFIG_KEYS.some((f) => key.toLowerCase().includes(f))) {
      errors.push(`variant ${v.id} config key "${key}" forbidden`);
    }
    const val = v.config[key];
    if (typeof val === "string" && val.length > 500) {
      errors.push(`variant ${v.id} config value too long`);
    }
  }
  return errors;
}

/** Reject definition mutation once RUNNING (immutable). */
export function assertDefinitionMutable(
  current: ExperimentDefinition,
): { ok: boolean; error?: string } {
  if (current.status === "RUNNING") {
    return {
      ok: false,
      error:
        "Definition immutable while RUNNING — create a new version or experiment",
    };
  }
  return { ok: true };
}

function baseTemplate(
  partial: Omit<
    ExperimentDefinition,
    | "status"
    | "assignmentVersion"
    | "metricVersion"
    | "methodologyVersion"
    | "createdAt"
    | "approvedAt"
    | "activatedAt"
  > & { createdAt?: string },
): ExperimentDefinition {
  return {
    ...partial,
    status: "DRAFT",
    assignmentVersion: EXPERIMENT_ASSIGNMENT_VERSION_DEFAULT,
    metricVersion: "25.0.0",
    methodologyVersion: EXPERIMENT_METHODOLOGY_VERSION,
    createdAt: partial.createdAt ?? "2026-07-26T00:00:00.000Z",
    approvedAt: null,
    activatedAt: null,
  };
}

/** Internal templates only — all DRAFT, never activated. */
export function experimentTemplates(): ExperimentDefinition[] {
  return [
    baseTemplate({
      id: "tpl_match_cta_placement",
      name: "Match CTA placement",
      hypothesis:
        "A clearer operator CTA position increases qualified CTA clicks without reducing evidence engagement.",
      owner: "product",
      environments: ["LOCAL", "TEST"],
      exposureUnit: "session",
      variants: [
        {
          id: "control",
          label: "Control",
          role: "CONTROL",
          allocationWeight: 50,
          enabled: true,
          config: { ctaPlacement: "default" },
          safetyNotes: ["Preserve signed redirects"],
        },
        {
          id: "treatment_a",
          label: "Clearer CTA",
          role: "TREATMENT",
          allocationWeight: 50,
          enabled: true,
          config: { ctaPlacement: "primary_column" },
          safetyNotes: ["Must not override availability"],
        },
      ],
      primaryMetricId: "operator_cta_click_rate",
      secondaryMetricIds: ["signed_redirect_success_rate"],
      guardrailMetricIds: ["evidence_view_rate", "api_failure_rate"],
      conflictGroup: "operator-cta",
      trafficPercent: 0,
      locales: null,
      countries: null,
      pageTypes: ["fixture", "match_detail"],
      minSamplePerVariant: 500,
      minRuntimeDays: 7,
      maxRuntimeDays: 28,
      minimumDetectableEffect: 0.05,
      ethicalReviewNotes: [
        "No deceptive urgency or fake scarcity",
        "Operator eligibility remains authoritative",
      ],
      risks: ["CTA prominence may reduce evidence focus"],
    }),
    baseTemplate({
      id: "tpl_evidence_summary_density",
      name: "Evidence summary density",
      hypothesis:
        "A concise evidence summary improves fixture-to-prediction engagement without increasing abandonment.",
      owner: "product",
      environments: ["LOCAL", "TEST"],
      exposureUnit: "session",
      variants: [
        {
          id: "control",
          label: "Control",
          role: "CONTROL",
          allocationWeight: 50,
          enabled: true,
          config: { density: "full" },
          safetyNotes: [],
        },
        {
          id: "treatment_a",
          label: "Concise",
          role: "TREATMENT",
          allocationWeight: 50,
          enabled: true,
          config: { density: "concise" },
          safetyNotes: ["Must remain accessible"],
        },
      ],
      primaryMetricId: "prediction_open_rate",
      secondaryMetricIds: ["evidence_view_rate"],
      guardrailMetricIds: ["page_error_rate"],
      conflictGroup: "match-page-layout",
      trafficPercent: 0,
      locales: null,
      countries: null,
      pageTypes: ["fixture", "match_detail"],
      minSamplePerVariant: 400,
      minRuntimeDays: 7,
      maxRuntimeDays: 21,
      minimumDetectableEffect: 0.04,
      ethicalReviewNotes: ["No hiding material risk disclosures"],
      risks: ["Over-compression may harm comprehension"],
    }),
    baseTemplate({
      id: "tpl_builder_entry_point",
      name: "Acca Builder entry point",
      hypothesis:
        "A clearer Builder entry point increases Builder opens without reducing direct match research.",
      owner: "product",
      environments: ["LOCAL", "TEST"],
      exposureUnit: "session",
      variants: [
        {
          id: "control",
          label: "Control",
          role: "CONTROL",
          allocationWeight: 50,
          enabled: true,
          config: { entry: "nav" },
          safetyNotes: [],
        },
        {
          id: "treatment_a",
          label: "Homepage accent",
          role: "TREATMENT",
          allocationWeight: 50,
          enabled: true,
          config: { entry: "homepage_accent" },
          safetyNotes: [],
        },
      ],
      primaryMetricId: "acca_builder_open_rate",
      secondaryMetricIds: ["builder_to_studio_rate", "fixture_open_rate"],
      guardrailMetricIds: ["page_error_rate", "api_failure_rate"],
      conflictGroup: "Builder-entry",
      trafficPercent: 0,
      locales: null,
      countries: null,
      pageTypes: ["homepage", "acca"],
      minSamplePerVariant: 400,
      minRuntimeDays: 7,
      maxRuntimeDays: 28,
      minimumDetectableEffect: 0.05,
      ethicalReviewNotes: ["No tipster guarantees"],
      risks: ["May divert research traffic"],
    }),
    baseTemplate({
      id: "tpl_builder_result_presentation",
      name: "Builder result presentation",
      hypothesis:
        "Clearer explanation of excluded candidates increases Builder-to-Studio transfers.",
      owner: "product",
      environments: ["LOCAL", "TEST"],
      exposureUnit: "session",
      variants: [
        {
          id: "control",
          label: "Control",
          role: "CONTROL",
          allocationWeight: 50,
          enabled: true,
          config: { exclusionsUi: "default" },
          safetyNotes: [],
        },
        {
          id: "treatment_a",
          label: "Explain exclusions",
          role: "TREATMENT",
          allocationWeight: 50,
          enabled: true,
          config: { exclusionsUi: "explained" },
          safetyNotes: [],
        },
      ],
      primaryMetricId: "builder_to_studio_rate",
      secondaryMetricIds: ["builder_generation_success_rate"],
      guardrailMetricIds: ["api_failure_rate"],
      conflictGroup: "Builder-results",
      trafficPercent: 0,
      locales: null,
      countries: null,
      pageTypes: ["acca_builder"],
      minSamplePerVariant: 200,
      minRuntimeDays: 7,
      maxRuntimeDays: 21,
      minimumDetectableEffect: 0.06,
      ethicalReviewNotes: ["No fabricated combination quality claims"],
      risks: [],
    }),
    baseTemplate({
      id: "tpl_search_empty_state",
      name: "Search empty-state guidance",
      hypothesis:
        "Better search recovery reduces no-result abandonment.",
      owner: "product",
      environments: ["LOCAL", "TEST"],
      exposureUnit: "session",
      variants: [
        {
          id: "control",
          label: "Control",
          role: "CONTROL",
          allocationWeight: 50,
          enabled: true,
          config: { emptyState: "default" },
          safetyNotes: [],
        },
        {
          id: "treatment_a",
          label: "Guided recovery",
          role: "TREATMENT",
          allocationWeight: 50,
          enabled: true,
          config: { emptyState: "guided" },
          safetyNotes: [],
        },
      ],
      primaryMetricId: "no_result_search_rate",
      secondaryMetricIds: ["search_result_click_rate"],
      guardrailMetricIds: ["page_error_rate"],
      conflictGroup: "search-experience",
      trafficPercent: 0,
      locales: null,
      countries: null,
      pageTypes: ["search"],
      minSamplePerVariant: 400,
      minRuntimeDays: 7,
      maxRuntimeDays: 21,
      minimumDetectableEffect: 0.05,
      ethicalReviewNotes: [],
      risks: [],
    }),
    baseTemplate({
      id: "tpl_competition_navigation",
      name: "Competition navigation",
      hypothesis:
        "Improved related-fixture navigation increases meaningful fixture opens.",
      owner: "product",
      environments: ["LOCAL", "TEST"],
      exposureUnit: "session",
      variants: [
        {
          id: "control",
          label: "Control",
          role: "CONTROL",
          allocationWeight: 50,
          enabled: true,
          config: { relatedNav: "default" },
          safetyNotes: [],
        },
        {
          id: "treatment_a",
          label: "Enhanced related",
          role: "TREATMENT",
          allocationWeight: 50,
          enabled: true,
          config: { relatedNav: "enhanced" },
          safetyNotes: ["SEO-stable URLs only — no variant query params"],
        },
      ],
      primaryMetricId: "fixture_open_rate",
      secondaryMetricIds: ["prediction_open_rate"],
      guardrailMetricIds: ["page_error_rate"],
      conflictGroup: "navigation",
      trafficPercent: 0,
      locales: null,
      countries: null,
      pageTypes: ["competition"],
      minSamplePerVariant: 500,
      minRuntimeDays: 7,
      maxRuntimeDays: 28,
      minimumDetectableEffect: 0.04,
      ethicalReviewNotes: ["No cloaking or variant-indexable URLs"],
      risks: ["SEO review required before any future activation"],
    }),
  ];
}

export function getDefinitionById(
  id: string,
  catalog: ExperimentDefinition[] = experimentTemplates(),
): ExperimentDefinition | null {
  return catalog.find((d) => d.id === id) ?? null;
}

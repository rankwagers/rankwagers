import type {
  EligibilityReasonCode,
  ExperimentDefinition,
  ExperimentEnvironment,
} from "./contracts";
import { isInTrafficPercent } from "./assignment";
import { isExperimentationEnabled } from "./runtime-flags";

export type EligibilityContext = {
  environment: ExperimentEnvironment;
  locale: string | null;
  country: string | null;
  pageType: string | null;
  assignmentKey: string | null;
  consentGranted: boolean | null;
  isAdminTestIdentity: boolean;
  conflictingExperimentIds: string[];
  featureAvailable: boolean;
};

export type EligibilityResult = {
  eligible: boolean;
  reasonCodes: EligibilityReasonCode[];
};

export function evaluateEligibility(
  definition: ExperimentDefinition,
  ctx: EligibilityContext,
  opts?: { allowPreviewDraft?: boolean },
): EligibilityResult {
  const reasons: EligibilityReasonCode[] = [];

  if (!isExperimentationEnabled() && !opts?.allowPreviewDraft) {
    reasons.push("EXPERIMENTATION_DISABLED");
  }

  if (!definition.environments.includes(ctx.environment)) {
    reasons.push("ENVIRONMENT_BLOCKED");
  }

  const active =
    definition.status === "RUNNING" ||
    (opts?.allowPreviewDraft &&
      (definition.status === "DRAFT" ||
        definition.status === "APPROVED" ||
        definition.status === "READY_FOR_REVIEW"));
  if (!active) {
    reasons.push(
      definition.status === "RUNNING" ? "EXPERIMENT_NOT_RUNNING" : "STATUS_NOT_ACTIVE",
    );
  }

  if (!ctx.assignmentKey || ctx.assignmentKey.length < 8) {
    reasons.push("INVALID_ASSIGNMENT_KEY");
  }

  if (definition.locales?.length && ctx.locale) {
    if (!definition.locales.includes(ctx.locale)) {
      reasons.push("LOCALE_EXCLUDED");
    }
  } else if (definition.locales?.length && !ctx.locale) {
    reasons.push("LOCALE_EXCLUDED");
  }

  if (definition.countries?.length && ctx.country) {
    if (!definition.countries.map((c) => c.toUpperCase()).includes(ctx.country.toUpperCase())) {
      reasons.push("COUNTRY_EXCLUDED");
    }
  }

  if (definition.pageTypes?.length && ctx.pageType) {
    if (!definition.pageTypes.includes(ctx.pageType)) {
      reasons.push("PAGE_TYPE_EXCLUDED");
    }
  }

  if (!ctx.featureAvailable) {
    reasons.push("FEATURE_UNAVAILABLE");
  }

  if (ctx.consentGranted === false) {
    reasons.push("CONSENT_REQUIRED");
  }

  if (
    definition.conflictGroup &&
    ctx.conflictingExperimentIds.length > 0
  ) {
    reasons.push("CONFLICTING_EXPERIMENT");
  }

  if (
    ctx.assignmentKey &&
    definition.status === "RUNNING" &&
    !isInTrafficPercent(definition, ctx.assignmentKey)
  ) {
    reasons.push("TRAFFIC_BUCKET_EXCLUDED");
  }

  if (
    ctx.environment === "PRODUCTION" &&
    !ctx.isAdminTestIdentity &&
    definition.environments.includes("PRODUCTION") === false
  ) {
    reasons.push("ENVIRONMENT_BLOCKED");
  }

  // TEST_IDENTITY_ONLY when only admin preview path should see it
  if (
    opts?.allowPreviewDraft &&
    definition.status !== "RUNNING" &&
    !ctx.isAdminTestIdentity
  ) {
    reasons.push("TEST_IDENTITY_ONLY");
  }

  const blocking = reasons.filter((r) => r !== "ELIGIBLE");
  if (blocking.length === 0) {
    return { eligible: true, reasonCodes: ["ELIGIBLE"] };
  }
  return { eligible: false, reasonCodes: blocking };
}

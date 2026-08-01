import type { CapabilityRow, ExperimentDefinition } from "./contracts";
import { selectVariant, trafficBucket } from "./assignment";
import { evaluateEligibility, type EligibilityContext } from "./eligibility";
import { hasConflict } from "./conflicts";
import { shouldLogExposure } from "./exposures";

export function buildCapabilityMatrix(): CapabilityRow[] {
  return [
    {
      analysis: "Session exposure unit (sessionStorage session_id)",
      status: "partial",
      blockingReason: "Tab-scoped; resets; no durable visitor ID",
      source: "lib/analytics/service.ts",
    },
    {
      analysis: "Anonymous visitor durable ID",
      status: "unavailable",
      blockingReason: "Not implemented — would require consent-aware cookie",
      source: "N/A",
    },
    {
      analysis: "Request / admin_test_identity units",
      status: "fully_supported",
      blockingReason: null,
      source: "lib/experimentation",
    },
    {
      analysis: "Deterministic assignment",
      status: "fully_supported",
      blockingReason: null,
      source: "lib/experimentation/assignment.ts",
    },
    {
      analysis: "CTA / Builder / search / redirect metrics",
      status: "partial",
      blockingReason: "Some denominators depend on page-view coverage",
      source: "lib/experimentation/metrics.ts",
    },
    {
      analysis: "FTD / revenue / deposit metrics",
      status: "unavailable",
      blockingReason: "No verified data source",
      source: "registry rejects",
    },
    {
      analysis: "Consent-gated assignment",
      status: "privacy_constraint",
      blockingReason: "Consent banner not mounted; CONSENT_REQUIRED when false",
      source: "eligibility",
    },
    {
      analysis: "Production activation",
      status: "unavailable",
      blockingReason: "Sprint 25 — no activation endpoint",
      source: "definitions.assertNoProductionActivation",
    },
    {
      analysis: "Real experiment traffic / uplift",
      status: "unavailable",
      blockingReason: "No real experiments running; templates are DRAFT",
      source: "catalog",
    },
  ];
}

export function diagnoseAssignment(
  definition: ExperimentDefinition,
  ctx: EligibilityContext,
  activeOthers: ExperimentDefinition[],
  opts?: { preview?: boolean },
): Record<string, unknown> {
  const eligibility = evaluateEligibility(definition, ctx, {
    allowPreviewDraft: Boolean(opts?.preview),
  });
  const conflict = hasConflict(definition, activeOthers);
  const variant =
    ctx.assignmentKey && eligibility.eligible
      ? selectVariant(definition, ctx.assignmentKey)
      : null;
  const traffic =
    ctx.assignmentKey != null
      ? trafficBucket(
          definition.id,
          definition.assignmentVersion,
          ctx.assignmentKey,
        )
      : null;
  const exposure = shouldLogExposure({
    eligible: eligibility.eligible && !conflict,
    meaningfulRender: true,
    preview: Boolean(opts?.preview),
    alreadySeenDedupeKey: false,
  });

  return {
    experimentId: definition.id,
    assignmentVersion: definition.assignmentVersion,
    eligibility,
    trafficBucket: traffic,
    assignedVariantId: variant?.id ?? null,
    conflictBlocked: conflict,
    wouldLogExposure: exposure.log,
    exposureReason: exposure.reason,
    preview: Boolean(opts?.preview),
    note: "Never displays another real visitor identifier",
  };
}

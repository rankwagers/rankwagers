/**
 * Minimal typed public experimentation boundary.
 * Disabled by default — always falls back to control without changing public UX.
 */

import { createHash } from "node:crypto";
import type { ExperimentDefinition, ExperimentVariant } from "./contracts";
import { selectVariant } from "./assignment";
import { evaluateEligibility, type EligibilityContext } from "./eligibility";
import { shouldLogExposure, buildDedupeKey } from "./exposures";
import { isExperimentationEnabled } from "./runtime-flags";

export type PublicAssignment = {
  experimentId: string;
  variantId: string;
  role: "CONTROL" | "TREATMENT";
  config: Record<string, string | number | boolean | null>;
  eligible: boolean;
  reasonCodes: string[];
  experimentationEnabled: boolean;
};

function controlFallback(def: ExperimentDefinition): PublicAssignment {
  const control =
    def.variants.find((v) => v.role === "CONTROL") ?? def.variants[0];
  return {
    experimentId: def.id,
    variantId: control?.id ?? "control",
    role: "CONTROL",
    config: control?.config ?? {},
    eligible: false,
    reasonCodes: ["EXPERIMENTATION_DISABLED"],
    experimentationEnabled: false,
  };
}

export function hashAssignmentKey(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex").slice(0, 32);
}

export function evaluateExperimentEligibility(
  definition: ExperimentDefinition,
  ctx: EligibilityContext,
) {
  return evaluateEligibility(definition, ctx);
}

export function getExperimentAssignment(
  definition: ExperimentDefinition,
  ctx: EligibilityContext,
): PublicAssignment {
  if (!isExperimentationEnabled()) {
    return controlFallback(definition);
  }
  const eligibility = evaluateEligibility(definition, ctx);
  if (!eligibility.eligible || !ctx.assignmentKey) {
    return {
      ...controlFallback(definition),
      reasonCodes: eligibility.reasonCodes,
      experimentationEnabled: true,
      eligible: false,
    };
  }
  const variant = selectVariant(definition, ctx.assignmentKey);
  if (!variant) {
    return {
      ...controlFallback(definition),
      reasonCodes: ["INVALID_ASSIGNMENT_KEY"],
      experimentationEnabled: true,
    };
  }
  return {
    experimentId: definition.id,
    variantId: variant.id,
    role: variant.role,
    config: variant.config,
    eligible: true,
    reasonCodes: ["ELIGIBLE"],
    experimentationEnabled: true,
  };
}

export function getVariantConfig(
  definition: ExperimentDefinition,
  variantId: string,
): ExperimentVariant["config"] | null {
  return definition.variants.find((v) => v.id === variantId)?.config ?? null;
}

/**
 * Exposure recording decision — caller persists if log=true.
 * Preview never records production exposure.
 */
export function recordExperimentExposure(input: {
  definition: ExperimentDefinition;
  assignment: PublicAssignment;
  meaningfulRender: boolean;
  preview: boolean;
  alreadySeen: boolean;
  requestId: string | null;
  pageType: string | null;
  locale: string | null;
}): { recorded: boolean; reason: string; dedupeKey: string | null } {
  const decision = shouldLogExposure({
    eligible: input.assignment.eligible,
    meaningfulRender: input.meaningfulRender,
    preview: input.preview,
    alreadySeenDedupeKey: input.alreadySeen,
  });
  if (!decision.log) {
    return { recorded: false, reason: decision.reason, dedupeKey: null };
  }
  const dedupeKey = buildDedupeKey({
    experimentId: input.definition.id,
    assignmentKeyHash: hashAssignmentKey(
      `${input.definition.id}:${input.assignment.variantId}`,
    ),
    variantId: input.assignment.variantId,
  });
  return { recorded: true, reason: decision.reason, dedupeKey };
}

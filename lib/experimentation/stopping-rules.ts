import type { SrmStatus, StoppingRecommendation } from "./contracts";
import type { SampleStatus } from "./sample-size";

export type StoppingInput = {
  runtimeDays: number;
  minRuntimeDays: number;
  maxRuntimeDays: number;
  sampleStatus: SampleStatus;
  srmStatus: SrmStatus;
  criticalGuardrailBreach: boolean;
  implementationDefect: boolean;
  dataQualityInvalid: boolean;
  operatorStop: boolean;
};

export function evaluateStoppingRules(
  input: StoppingInput,
): {
  recommendation: StoppingRecommendation;
  reasons: string[];
} {
  const reasons: string[] = [];
  if (input.operatorStop) {
    reasons.push("Operator stop requested");
    return { recommendation: "PAUSE_FOR_REVIEW", reasons };
  }
  if (input.criticalGuardrailBreach) {
    reasons.push("Critical guardrail breach");
    return { recommendation: "STOP_FOR_HARM", reasons };
  }
  if (input.srmStatus === "MATERIAL_SRM") {
    reasons.push("Material sample-ratio mismatch");
    return { recommendation: "INVALIDATE", reasons };
  }
  if (input.implementationDefect || input.dataQualityInvalid) {
    reasons.push(
      input.implementationDefect
        ? "Implementation defect"
        : "Data-quality invalidation",
    );
    return { recommendation: "INVALIDATE", reasons };
  }
  if (input.runtimeDays >= input.maxRuntimeDays) {
    reasons.push("Maximum runtime reached");
    return { recommendation: "READY_FOR_ANALYSIS", reasons };
  }
  if (
    input.runtimeDays >= input.minRuntimeDays &&
    (input.sampleStatus === "MET" || input.sampleStatus === "EXCEEDED")
  ) {
    reasons.push("Minimum runtime and sample met");
    return { recommendation: "READY_FOR_ANALYSIS", reasons };
  }
  reasons.push("Continue collecting exposures");
  return { recommendation: "CONTINUE", reasons };
}

/** Never auto-roll out winners. */
export function mayAutoRollout(): false {
  return false;
}

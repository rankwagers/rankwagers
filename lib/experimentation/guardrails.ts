import type { ExperimentDefinition } from "./contracts";
import { getMetric } from "./metrics";

export type GuardrailEvaluation = {
  metricId: string;
  status: "OK" | "BREACH" | "INSUFFICIENT_DATA" | "UNAVAILABLE";
  controlRate: number | null;
  treatmentRate: number | null;
  absoluteDelta: number | null;
  explanation: string;
};

/**
 * Guardrail breach: treatment worsens a decrease-direction metric by ≥ threshold,
 * or worsens an increase-direction engagement guardrail.
 */
export function evaluateGuardrail(input: {
  metricId: string;
  controlConversions: number;
  controlN: number;
  treatmentConversions: number;
  treatmentN: number;
  breachThreshold?: number;
}): GuardrailEvaluation {
  const metric = getMetric(input.metricId);
  if (!metric) {
    return {
      metricId: input.metricId,
      status: "UNAVAILABLE",
      controlRate: null,
      treatmentRate: null,
      absoluteDelta: null,
      explanation: "Metric not in registry",
    };
  }
  if (input.controlN < 30 || input.treatmentN < 30) {
    return {
      metricId: input.metricId,
      status: "INSUFFICIENT_DATA",
      controlRate: null,
      treatmentRate: null,
      absoluteDelta: null,
      explanation: "Insufficient sample for guardrail",
    };
  }
  const c = input.controlConversions / input.controlN;
  const t = input.treatmentConversions / input.treatmentN;
  const delta = t - c;
  const threshold = input.breachThreshold ?? 0.02;
  let breach = false;
  if (metric.direction === "decrease" && delta > threshold) breach = true;
  if (metric.direction === "increase" && delta < -threshold) breach = true;
  return {
    metricId: input.metricId,
    status: breach ? "BREACH" : "OK",
    controlRate: c,
    treatmentRate: t,
    absoluteDelta: delta,
    explanation: breach
      ? "Material guardrail deterioration"
      : "Within threshold",
  };
}

export function experimentHasCriticalGuardrailBreach(
  definition: ExperimentDefinition,
  evals: GuardrailEvaluation[],
): boolean {
  return definition.guardrailMetricIds.some((id) =>
    evals.some((e) => e.metricId === id && e.status === "BREACH"),
  );
}

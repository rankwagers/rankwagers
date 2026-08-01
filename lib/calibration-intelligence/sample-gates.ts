import type { SampleStatus } from "./contracts";

export type SampleGateConfig = {
  insufficientMax: number;
  earlySignalMax: number;
  reviewableMax: number;
};

/** Default gates for hit-rate style metrics. */
export const DEFAULT_HIT_RATE_GATES: SampleGateConfig = {
  insufficientMax: 19,
  earlySignalMax: 49,
  reviewableMax: 99,
};

/** Stricter gates for ECE / Brier style metrics. */
export const CALIBRATION_METRIC_GATES: SampleGateConfig = {
  insufficientMax: 49,
  earlySignalMax: 99,
  reviewableMax: 199,
};

/** Builder combination settlement — higher bar. */
export const COMBINATION_GATES: SampleGateConfig = {
  insufficientMax: 29,
  earlySignalMax: 74,
  reviewableMax: 149,
};

export function sampleStatus(
  settledCount: number,
  gates: SampleGateConfig = DEFAULT_HIT_RATE_GATES,
): SampleStatus {
  if (settledCount <= gates.insufficientMax) return "INSUFFICIENT";
  if (settledCount <= gates.earlySignalMax) return "EARLY_SIGNAL";
  if (settledCount <= gates.reviewableMax) return "REVIEWABLE";
  return "RELIABLE";
}

export function isReliableEnough(
  settledCount: number,
  gates: SampleGateConfig = DEFAULT_HIT_RATE_GATES,
): boolean {
  const s = sampleStatus(settledCount, gates);
  return s === "REVIEWABLE" || s === "RELIABLE";
}

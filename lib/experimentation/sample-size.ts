export type SamplePlanInput = {
  baselineRate: number | null;
  mde: number | null;
  alpha?: number;
  power?: number;
  /** Observed eligible exposures per day — null → runtime estimate Unavailable */
  eligiblePerDay: number | null;
};

export type SamplePlanResult = {
  requiredPerVariant: number | null;
  estimatedRuntimeDays: number | null;
  alpha: number;
  power: number;
  status: "PLANNED" | "UNAVAILABLE" | "OPERATOR_ASSUMPTION";
  notes: string[];
};

/**
 * Approximate two-sample proportion sample size (equal arms).
 * Uses normal approximation; labeled conservative planning aid only.
 */
export function planSampleSize(input: SamplePlanInput): SamplePlanResult {
  const alpha = input.alpha ?? 0.05;
  const power = input.power ?? 0.8;
  const notes: string[] = [
    "Planning aid only — not a guarantee of significance",
    "Do not fabricate traffic or completion dates",
  ];
  if (input.baselineRate == null || input.mde == null) {
    return {
      requiredPerVariant: null,
      estimatedRuntimeDays: null,
      alpha,
      power,
      status: "UNAVAILABLE",
      notes: [...notes, "Baseline rate or MDE unavailable — provide operator assumptions"],
    };
  }
  const p1 = Math.min(0.99, Math.max(0.01, input.baselineRate));
  const p2 = Math.min(0.99, Math.max(0.01, p1 + input.mde));
  // z approx for one-sided-ish planning: zα≈1.96, zβ≈0.84 for 80% power
  const za = 1.96;
  const zb = power >= 0.9 ? 1.28 : 0.84;
  const pbar = (p1 + p2) / 2;
  const num =
    2 * pbar * (1 - pbar) * (za + zb) ** 2;
  const den = (p2 - p1) ** 2;
  const n = den <= 0 ? null : Math.ceil(num / den);
  let estimatedRuntimeDays: number | null = null;
  let status: SamplePlanResult["status"] = "OPERATOR_ASSUMPTION";
  if (n != null && input.eligiblePerDay != null && input.eligiblePerDay > 0) {
    estimatedRuntimeDays = Math.ceil((n * 2) / input.eligiblePerDay);
    status = "PLANNED";
  } else if (n != null) {
    notes.push("Runtime Unavailable — eligible traffic per day unknown");
  }
  return {
    requiredPerVariant: n,
    estimatedRuntimeDays,
    alpha,
    power,
    status,
    notes,
  };
}

export type SampleStatus =
  | "INSUFFICIENT"
  | "APPROACHING"
  | "MET"
  | "EXCEEDED";

export function sampleStatus(
  observedPerVariant: number,
  requiredPerVariant: number,
): SampleStatus {
  if (observedPerVariant < requiredPerVariant * 0.5) return "INSUFFICIENT";
  if (observedPerVariant < requiredPerVariant) return "APPROACHING";
  if (observedPerVariant < requiredPerVariant * 1.25) return "MET";
  return "EXCEEDED";
}

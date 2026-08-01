/**
 * Conservative binary proportion helpers.
 * Do not treat p-values alone as proof of success.
 */

export type BinaryResult = {
  n: number;
  conversions: number;
  rate: number | null;
};

export type TwoProportionComparison = {
  control: BinaryResult;
  treatment: BinaryResult;
  absoluteDifference: number | null;
  relativeDifference: number | null;
  /** Wald 95% CI for absolute difference — exploratory, not sole decision basis */
  absoluteDiffCi95: { low: number; high: number } | null;
  effectDirection: "positive" | "negative" | "neutral" | "unknown";
  methodVersion: string;
  caveats: string[];
};

function rate(conversions: number, n: number): number | null {
  if (n <= 0) return null;
  return conversions / n;
}

export function binaryResult(conversions: number, n: number): BinaryResult {
  return { n, conversions, rate: rate(conversions, n) };
}

export function compareTwoProportions(
  controlConversions: number,
  controlN: number,
  treatmentConversions: number,
  treatmentN: number,
): TwoProportionComparison {
  const control = binaryResult(controlConversions, controlN);
  const treatment = binaryResult(treatmentConversions, treatmentN);
  const caveats = [
    "Do not declare winners from p-values alone",
    "Requires eligibility, assignment, and exposure integrity",
    "Repeated peeking inflates false-positive risk",
  ];
  if (control.rate == null || treatment.rate == null) {
    return {
      control,
      treatment,
      absoluteDifference: null,
      relativeDifference: null,
      absoluteDiffCi95: null,
      effectDirection: "unknown",
      methodVersion: "25.0.0-wald",
      caveats,
    };
  }
  const abs = treatment.rate - control.rate;
  const rel = control.rate === 0 ? null : abs / control.rate;
  const se = Math.sqrt(
    (control.rate * (1 - control.rate)) / controlN +
      (treatment.rate * (1 - treatment.rate)) / treatmentN,
  );
  const z = 1.96;
  const ci =
    Number.isFinite(se) && se > 0
      ? { low: abs - z * se, high: abs + z * se }
      : null;
  let effectDirection: TwoProportionComparison["effectDirection"] = "neutral";
  if (Math.abs(abs) < 1e-9) effectDirection = "neutral";
  else if (abs > 0) effectDirection = "positive";
  else effectDirection = "negative";

  return {
    control,
    treatment,
    absoluteDifference: abs,
    relativeDifference: rel,
    absoluteDiffCi95: ci,
    effectDirection,
    methodVersion: "25.0.0-wald",
    caveats,
  };
}

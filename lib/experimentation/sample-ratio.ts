import type { SrmStatus } from "./contracts";

export type AllocationExpectation = {
  variantId: string;
  expectedWeight: number;
  observedExposures: number;
};

/**
 * Chi-square goodness-of-fit style SRM check (simplified).
 * MATERIAL_SRM when p-like signal is strong and n is adequate.
 */
export function detectSrm(
  rows: AllocationExpectation[],
  minTotal = 100,
): {
  status: SrmStatus;
  total: number;
  chiSquare: number | null;
  possibleCauses: string[];
} {
  const total = rows.reduce((s, r) => s + r.observedExposures, 0);
  const weightSum = rows.reduce((s, r) => s + r.expectedWeight, 0);
  const causes = [
    "assignment instability",
    "exposure logging failure",
    "variant rendering failure",
    "eligibility mismatch",
    "bot/internal traffic",
    "caching inconsistency",
    "client/server disagreement",
  ];
  if (total < minTotal || weightSum <= 0) {
    return {
      status: "INSUFFICIENT_DATA",
      total,
      chiSquare: null,
      possibleCauses: causes,
    };
  }
  let chi = 0;
  for (const r of rows) {
    const expected = (r.expectedWeight / weightSum) * total;
    if (expected <= 0) continue;
    chi += (r.observedExposures - expected) ** 2 / expected;
  }
  // df≈variants-1; critical ~6.63 for df=1 at α=0.01; use scaled thresholds
  const df = Math.max(1, rows.length - 1);
  const material = 6.63 * df;
  const watch = 3.84 * df;
  let status: SrmStatus = "NO_ISSUE";
  if (chi >= material) status = "MATERIAL_SRM";
  else if (chi >= watch) status = "WATCH";
  return { status, total, chiSquare: chi, possibleCauses: causes };
}

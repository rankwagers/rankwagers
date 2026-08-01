import type { BandMetrics } from "./contracts";
import { sampleStatus } from "./sample-gates";
import { average, calibrationGap, observedSuccessRate } from "./metrics";

/** Default bands for 0–100 confidence scale. */
export const DEFAULT_BANDS: Array<{ label: string; min: number; max: number }> = [
  { label: "50–54", min: 50, max: 54.999 },
  { label: "55–59", min: 55, max: 59.999 },
  { label: "60–64", min: 60, max: 64.999 },
  { label: "65–69", min: 65, max: 69.999 },
  { label: "70–74", min: 70, max: 74.999 },
  { label: "75–79", min: 75, max: 79.999 },
  { label: "80–84", min: 80, max: 84.999 },
  { label: "85–89", min: 85, max: 89.999 },
  { label: "90+", min: 90, max: 100 },
  { label: "<50", min: 0, max: 49.999 },
];

export type BandInput = {
  confidence: number;
  status: "won" | "lost" | "void" | "pending";
};

export function bandForConfidence(
  confidence: number,
  bands = DEFAULT_BANDS,
): string {
  for (const b of bands) {
    if (confidence >= b.min && confidence <= b.max) return b.label;
  }
  return "out_of_range";
}

export function aggregateConfidenceBands(
  rows: BandInput[],
  bands = DEFAULT_BANDS,
): BandMetrics[] {
  return bands.map((band) => {
    const inBand = rows.filter(
      (r) => r.confidence >= band.min && r.confidence <= band.max,
    );
    const won = inBand.filter((r) => r.status === "won").length;
    const lost = inBand.filter((r) => r.status === "lost").length;
    const voided = inBand.filter((r) => r.status === "void").length;
    const settled = won + lost + voided;
    const confs = inBand.map((r) => r.confidence);
    const avgConf100 = average(confs);
    const obs = observedSuccessRate(won, lost);
    const gap =
      avgConf100 != null && obs != null
        ? calibrationGap(avgConf100 / 100, obs)
        : null;
    return {
      band: band.label,
      published: inBand.length,
      settled,
      won,
      lost,
      voided,
      observedRate: obs,
      averageConfidence: avgConf100,
      calibrationGap: gap,
      sampleStatus: sampleStatus(won + lost),
    };
  });
}

/** Detect inversions: higher band performs materially worse than lower (settled W+L only). */
export function detectCalibrationInversions(
  bands: BandMetrics[],
  minSettled = 20,
  materialGap = 0.08,
): Array<{ higher: string; lower: string; gap: number }> {
  const usable = bands.filter(
    (b) => b.observedRate != null && b.won + b.lost >= minSettled,
  );
  const out: Array<{ higher: string; lower: string; gap: number }> = [];
  for (let i = 0; i < usable.length; i++) {
    for (let j = i + 1; j < usable.length; j++) {
      const a = usable[i];
      const b = usable[j];
      // Compare by average confidence
      if (a.averageConfidence == null || b.averageConfidence == null) continue;
      const higher = a.averageConfidence >= b.averageConfidence ? a : b;
      const lower = higher === a ? b : a;
      if (
        higher.observedRate != null &&
        lower.observedRate != null &&
        lower.observedRate - higher.observedRate >= materialGap
      ) {
        out.push({
          higher: higher.band,
          lower: lower.band,
          gap: lower.observedRate - higher.observedRate,
        });
      }
    }
  }
  return out;
}

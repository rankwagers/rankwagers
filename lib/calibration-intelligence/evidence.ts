import type { ArchivePredictionRecord } from "@/lib/archive/types";
import { sampleStatus } from "./sample-gates";
import { average, calibrationGap, observedSuccessRate } from "./metrics";

export type EvidenceBandLabel =
  | "complete"
  | "near-complete"
  | "partial"
  | "insufficient"
  | "unknown";

/**
 * Archive records store evidenceSummary strings only — no numeric completeness.
 * Heuristic bands from summary richness; labeled as reconstructed ranking signal.
 */
export function evidenceBandForRecord(
  r: ArchivePredictionRecord,
): EvidenceBandLabel {
  const n = r.evidenceSummary?.filter(Boolean).length ?? 0;
  if (n === 0) return "unknown";
  if (n >= 3 && r.confidence != null) return "complete";
  if (n >= 2) return "near-complete";
  if (n === 1) return "partial";
  return "insufficient";
}

export type EvidenceBandMetrics = {
  band: EvidenceBandLabel;
  settled: number;
  won: number;
  lost: number;
  voided: number;
  hitRate: number | null;
  averageConfidence: number | null;
  calibrationGap: number | null;
  sampleStatus: ReturnType<typeof sampleStatus>;
};

export function aggregateEvidenceBands(
  records: ArchivePredictionRecord[],
): { bands: EvidenceBandMetrics[]; notes: string[] } {
  const labels: EvidenceBandLabel[] = [
    "complete",
    "near-complete",
    "partial",
    "insufficient",
    "unknown",
  ];
  const bands = labels.map((band) => {
    const inBand = records.filter((r) => evidenceBandForRecord(r) === band);
    const won = inBand.filter((r) => r.status === "won").length;
    const lost = inBand.filter((r) => r.status === "lost").length;
    const voided = inBand.filter((r) => r.status === "void").length;
    const confs = inBand
      .map((r) => r.confidence)
      .filter((n): n is number => n != null);
    const avgConf = average(confs);
    const obs = observedSuccessRate(won, lost);
    return {
      band,
      settled: won + lost + voided,
      won,
      lost,
      voided,
      hitRate: obs,
      averageConfidence: avgConf,
      calibrationGap:
        avgConf != null && obs != null ? calibrationGap(avgConf / 100, obs) : null,
      sampleStatus: sampleStatus(won + lost),
    };
  });

  return {
    bands,
    notes: [
      "Evidence bands are derived from archive evidenceSummary richness — not Builder evidenceCompleteness scores.",
      "Do not auto-modify eligibility rules from these bands.",
    ],
  };
}

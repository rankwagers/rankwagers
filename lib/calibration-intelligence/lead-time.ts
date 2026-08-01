import type { ArchivePredictionRecord } from "@/lib/archive/types";
import { sampleStatus } from "./sample-gates";
import { average, calibrationGap, observedSuccessRate } from "./metrics";

export type LeadTimeBand = {
  label: string;
  published: number;
  settled: number;
  won: number;
  lost: number;
  voided: number;
  hitRate: number | null;
  averageConfidence: number | null;
  calibrationGap: number | null;
  sampleStatus: ReturnType<typeof sampleStatus>;
  missingTimestamps: number;
};

const BANDS: Array<{ label: string; minH: number; maxH: number }> = [
  { label: "under 1 hour", minH: 0, maxH: 1 },
  { label: "1–3 hours", minH: 1, maxH: 3 },
  { label: "3–6 hours", minH: 3, maxH: 6 },
  { label: "6–12 hours", minH: 6, maxH: 12 },
  { label: "12–24 hours", minH: 12, maxH: 24 },
  { label: "over 24 hours", minH: 24, maxH: Infinity },
];

export function hoursBeforeKickoff(
  publishedAt: string | null,
  kickoffAt: string | null,
): number | null {
  if (!publishedAt || !kickoffAt) return null;
  const pub = Date.parse(publishedAt);
  const ko = Date.parse(kickoffAt);
  if (!Number.isFinite(pub) || !Number.isFinite(ko)) return null;
  return (ko - pub) / (1000 * 60 * 60);
}

export function aggregateLeadTime(
  records: ArchivePredictionRecord[],
): {
  bands: LeadTimeBand[];
  missingTimestamps: number;
  notes: string[];
} {
  let missing = 0;
  const withHours: Array<{
    hours: number;
    r: ArchivePredictionRecord;
  }> = [];
  for (const r of records) {
    const h = hoursBeforeKickoff(r.publishedAt, r.kickoffAt);
    if (h == null || h < 0) {
      missing += 1;
      continue;
    }
    withHours.push({ hours: h, r });
  }

  const bands = BANDS.map((b) => {
    const inBand = withHours.filter(
      (x) => x.hours >= b.minH && x.hours < b.maxH,
    );
    const won = inBand.filter((x) => x.r.status === "won").length;
    const lost = inBand.filter((x) => x.r.status === "lost").length;
    const voided = inBand.filter((x) => x.r.status === "void").length;
    const confs = inBand
      .map((x) => x.r.confidence)
      .filter((n): n is number => n != null);
    const avgConf = average(confs);
    const obs = observedSuccessRate(won, lost);
    return {
      label: b.label,
      published: inBand.length,
      settled: won + lost + voided,
      won,
      lost,
      voided,
      hitRate: obs,
      averageConfidence: avgConf,
      calibrationGap:
        avgConf != null && obs != null ? calibrationGap(avgConf / 100, obs) : null,
      sampleStatus: sampleStatus(won + lost),
      missingTimestamps: 0,
    };
  });

  return {
    bands,
    missingTimestamps: missing,
    notes: [
      "publishedAt is archive save time (publication proxy), not an immutable prediction freeze timestamp.",
      "Do not infer causation from lead-time correlation.",
      missing
        ? `${missing} records missing publishedAt and/or kickoffAt`
        : "All records had both timestamps in this window",
    ],
  };
}

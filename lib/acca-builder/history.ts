/**
 * Archive-backed historical aggregates for builder scoring.
 * Sprint 19.5: history attachment is skipped until sample gates are wired
 * into the generation snapshot (see provider matrix). Never invent ROI.
 */

export type HistoricalSample = {
  scope: string;
  won: number;
  lost: number;
  void: number;
  settledSampleSize: number;
  dateWindow: string;
  lastUpdated: string | null;
};

export function isDefensibleSample(sample: HistoricalSample, minSettled = 30): boolean {
  return sample.settledSampleSize >= minSettled;
}

export function formatHistoricalSample(sample: HistoricalSample): string {
  return `${sample.scope}: ${sample.won}W / ${sample.lost}L / ${sample.void}V · n=${sample.settledSampleSize} · ${sample.dateWindow}`;
}

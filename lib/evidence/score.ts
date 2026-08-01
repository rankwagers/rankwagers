/**
 * Evidence score normalization and banding.
 *
 * Pure and browser-safe — no Node imports. Future calibration work groups accuracy by
 * `evidenceScoreBand`, so the thresholds live in `constants.ts` and the banding is a
 * total function over the 0–100 range.
 */

import type { EvidenceScoreBand, EvidenceSignal } from "@/types/evidence";
import {
  EVIDENCE_SCORE_BAND_THRESHOLDS,
  EVIDENCE_SCORE_MAX,
  EVIDENCE_SCORE_MIN,
  EVIDENCE_SCORE_PRECISION,
} from "./constants";

/** Clamp into [0, 100] and round to the stored precision. Non-finite input → 0. */
export function normalizeEvidenceScore(raw: number): number {
  if (!Number.isFinite(raw)) return EVIDENCE_SCORE_MIN;
  const clamped = Math.min(
    EVIDENCE_SCORE_MAX,
    Math.max(EVIDENCE_SCORE_MIN, raw)
  );
  const factor = 10 ** EVIDENCE_SCORE_PRECISION;
  return Math.round(clamped * factor) / factor;
}

/**
 * Band a normalized score.
 *
 * `insufficient` is reserved for scores below the `low` threshold — it means "we do not
 * have enough to say", which is different from "we looked and it is weak".
 */
export function evidenceScoreBand(score: number): EvidenceScoreBand {
  const normalized = normalizeEvidenceScore(score);
  if (normalized >= EVIDENCE_SCORE_BAND_THRESHOLDS.high) return "high";
  if (normalized >= EVIDENCE_SCORE_BAND_THRESHOLDS.moderate) return "moderate";
  if (normalized >= EVIDENCE_SCORE_BAND_THRESHOLDS.low) return "low";
  return "insufficient";
}

export const EVIDENCE_SCORE_BAND_LABELS: Record<EvidenceScoreBand, string> = {
  high: "High evidence",
  moderate: "Moderate evidence",
  low: "Low evidence",
  insufficient: "Insufficient evidence",
};

export function evidenceScoreBandLabel(band: EvidenceScoreBand): string {
  return EVIDENCE_SCORE_BAND_LABELS[band];
}

/**
 * Sum of supporting weights minus opposing weights, normalized.
 *
 * Provided so callers that hold signals but no precomputed score can derive one
 * consistently. `neutral` signals contribute nothing by definition.
 */
export function scoreFromSignals(signals: EvidenceSignal[]): number {
  const total = signals.reduce((sum, signal) => {
    if (signal.direction === "supporting") return sum + signal.weight;
    if (signal.direction === "opposing") return sum - signal.weight;
    return sum;
  }, 0);
  return normalizeEvidenceScore(total);
}

/** Signed change between two snapshots' scores, rounded to stored precision. */
export function evidenceScoreDelta(current: number, previous: number): number {
  const factor = 10 ** EVIDENCE_SCORE_PRECISION;
  return (
    Math.round((normalizeEvidenceScore(current) - normalizeEvidenceScore(previous)) * factor) /
    factor
  );
}

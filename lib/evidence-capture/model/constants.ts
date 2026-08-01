/**
 * Evidence-model constants (Sprint 23B, M5 — Contract §4.4).
 *
 * §4.4 states these are "fixed at build time and immutable within a modelVersion;
 * changing any value requires a new modelVersion." They are gathered here as a single
 * documented source. The DERIVATION never reads `modelVersion` — these are plain
 * compile-time constants — so derivation stays a pure function of its inputs alone.
 *
 * NOTE: the numeric VALUES are the approved 2.6B design defaults, pending empirical
 * calibration; any change is a new modelVersion, never an in-place edit. The frozen
 * thresholds (`EVIDENCE_MIN_SAMPLE_SIZE`, qualification thresholds) are reused from the
 * Sprint 23 evidence domain, not redefined.
 */

import { EVIDENCE_MIN_SAMPLE_SIZE } from "@/lib/evidence/constants";

/** Percentage-point spread mapping a team-vs-baseline residual to ±1 (0–100 scale). */
export const BASELINE_SCALE = 15;
/** Max weight of a primary venue signal (bounded 0–100 per the EvidenceSignal contract). */
export const W_PRIMARY_MAX = 45;
/** Max weight of a counter (clean-sheet / failed-to-score) signal. */
export const W_COUNTER_MAX = 20;
/** Minimum sample for a signal to contribute (reused frozen constant). */
export const SAMPLE_MIN = EVIDENCE_MIN_SAMPLE_SIZE; // = 6
/** Sample at which confidence saturates to 1 (just below the very_strong ≥20 boundary). */
export const SAMPLE_TARGET = 19;
/** Neutral band (percentage points): |rate − baseline| below this contributes nothing. */
export const NEUTRAL_EPS_PP = 2;
/** Counter (CS/FTS) rate at or above this (%) becomes opposing evidence. */
export const COUNTER_MIN_PCT = 50;
/** League baseline needs at least this many completed matches to be usable. */
export const LEAGUE_MIN_SAMPLE = 20;

/** Clamp helper. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Round to 2 decimal places (signal weights / evidenceScore precision). */
export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Deterministic sample confidence in [0,1]: 0 below SAMPLE_MIN, linear to 1 at
 * SAMPLE_TARGET. Non-finite / sub-min samples contribute nothing.
 */
export function sampleConfidence(played: number): number {
  if (!Number.isFinite(played) || played < SAMPLE_MIN) return 0;
  return clamp((played - SAMPLE_MIN) / (SAMPLE_TARGET - SAMPLE_MIN), 0, 1);
}

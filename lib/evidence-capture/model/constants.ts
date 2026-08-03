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
/**
 * Absolute floor for the neutral band, in percentage points.
 *
 * Only binds where the sampling band collapses — a 100% rate has zero binomial variance, and
 * without a floor a 0.4pp gap on a perfect record would read as evidence.
 */
export const NEUTRAL_EPS_PP = 2;

/**
 * Neutral band for a venue rate, in percentage points.
 *
 * THE RULE. A difference from the league rate counts as evidence only when it exceeds one
 * standard error of a binomial proportion at that sample size:
 *
 *     band = max(NEUTRAL_EPS_PP, 100 × √(p(1−p) / n))     p = baseline/100, n = matches played
 *
 * WHY THIS AND NOT A FIXED PERCENTAGE. The previous rule was a flat 2pp for every signal, which
 * asked eight matches and thirty matches to clear the same bar. It cannot: with a league rate of
 * 90%, eight matches carry a standard error of 10.6pp, so 88% (7/8) differs from 90% by ONE MATCH
 * and by well under the noise in its own sample. Reporting that as "Opposes" is a claim the data
 * does not support. At thirty matches the same 90% baseline gives 5.5pp, so a real gap registers.
 *
 * WHY ONE STANDARD ERROR. It is the weakest defensible bar — below one SE a difference is
 * indistinguishable from sampling variation by any reading. A significance-style 1.96×SE would be
 * a stronger claim than "this points somewhere", which is all a direction asserts. The multiplier
 * is chosen from what the statistic means, not from how the board looks: on today's fixtures this
 * makes most signals neutral, and that is the correct reading rather than a reason to loosen it.
 *
 * The band widens as p approaches 50%, where a proportion is genuinely most variable, and narrows
 * toward the extremes — both are properties of the estimator, not adjustments.
 */
export function neutralBandPp(baselinePct: number, played: number): number {
  if (!Number.isFinite(baselinePct) || !Number.isFinite(played) || played <= 0) {
    return NEUTRAL_EPS_PP;
  }
  const p = clamp(baselinePct / 100, 0, 1);
  const standardErrorPp = Math.sqrt((p * (1 - p)) / played) * 100;
  return Math.max(NEUTRAL_EPS_PP, standardErrorPp);
}
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

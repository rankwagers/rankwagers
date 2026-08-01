/**
 * M10 Stage 1 — shared fail-safe batch-limit normalizer (spec §7.2 INV-C / §5).
 *
 * Binding behaviour: absolute max 150, initial default 100, valid range 1–150.
 * Missing / invalid / NaN / non-integer / zero / negative ⇒ fail safe to 100 (NEVER
 * unbounded). Values above 150 clamp to 150. Overflow is never silently discarded —
 * the caller defers it (counted), this function only decides the ceiling.
 */

export const CANDIDATE_LIMIT_MIN = 1;
export const CANDIDATE_LIMIT_MAX = 150;
export const CANDIDATE_LIMIT_DEFAULT = 100;

/** Normalize any configured ceiling into `[1, 150]`, failing safe to 100. */
export function normalizeBatchLimit(value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value <= 0
  ) {
    // Missing, NaN, non-integer, zero, or negative — never treat as unlimited.
    return CANDIDATE_LIMIT_DEFAULT;
  }
  if (value > CANDIDATE_LIMIT_MAX) return CANDIDATE_LIMIT_MAX;
  return value;
}

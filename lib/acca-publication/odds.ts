import { ACCA_LIMITS } from "./contracts";

/**
 * Strict combined-odds calculator (Sprint 20B-B, stage B1).
 *
 * WHY THIS EXISTS SEPARATELY FROM `lib/acca/odds.ts`
 * The existing `combinedDecimalOdds` helper is deliberately tolerant: it SKIPS legs whose
 * odds are missing or <= 1 and still returns a product, flagging `oddsComplete: false`. That
 * is right for the interactive Studio, where a user is mid-build. It is wrong for a published
 * Acca, where a silently skipped leg would mean the advertised combined odds do not
 * correspond to the selections shown. This calculator therefore never skips: any invalid leg
 * fails the whole calculation.
 *
 * DECIMAL SAFETY
 * Odds are scaled to exact integers and multiplied with BigInt, so no binary floating-point
 * drift can occur. `1.1 * 1.1 * 1.1` is 1.3310000000000004 in float arithmetic; here it is
 * exactly 1.331. Rounding to the canonical 4 decimal places is half-up, applied once at the
 * end rather than per step.
 *
 * REPRESENTATION
 * Only the `number` type is accepted. Numeric strings are rejected rather than coerced, so a
 * malformed value can never be silently parsed into a plausible price.
 */

/** Canonical precision for stored odds and the combined total. */
export const ODDS_DECIMAL_PLACES = 4;

/**
 * Decimal odds must be strictly greater than 1 — a price of 1.0 returns the stake and is not
 * a real market price. At the contract's 4-decimal precision the smallest legal value is
 * 1.0001, matching the repository's existing `odds > 1` convention.
 */
export const MIN_DECIMAL_ODDS = 1.0001;

/**
 * Explicit overflow ceiling. A combined price above this is treated as a data error rather
 * than stored, because it almost certainly means a corrupted leg price reached the domain.
 */
export const MAX_COMBINED_ODDS = 1_000_000;

const SCALE_FACTOR = 10n ** BigInt(ODDS_DECIMAL_PLACES);

export type OddsFailureCode =
  | "too_few_legs"
  | "too_many_legs"
  | "odds_missing"
  | "odds_not_a_number"
  | "odds_not_finite"
  | "odds_below_minimum"
  | "odds_precision_exceeded"
  | "combined_odds_overflow";

export type CombinedOddsResult =
  | { ok: true; combinedOdds: number }
  | { ok: false; code: OddsFailureCode; legIndex?: number };

/**
 * Exact integer representation of a decimal-odds value, or null when the value cannot be
 * represented at the contract's precision. Uses the fixed-point string rather than
 * `value * 10^4`, because the multiplication itself would introduce float error.
 */
function toScaled(value: number): bigint | null {
  const fixed = value.toFixed(ODDS_DECIMAL_PLACES);
  if (Number(fixed) !== value) return null; // more precision than the contract allows
  const [whole, fraction = ""] = fixed.split(".");
  return BigInt(whole + fraction.padEnd(ODDS_DECIMAL_PLACES, "0"));
}

/** Validate one leg price. Exported so callers can report the first bad leg precisely. */
export function validateLegOdds(
  value: unknown,
): { ok: true; scaled: bigint } | { ok: false; code: OddsFailureCode } {
  if (value === null || value === undefined) return { ok: false, code: "odds_missing" };
  // Strings, booleans and boxed numbers are rejected rather than coerced.
  if (typeof value !== "number") return { ok: false, code: "odds_not_a_number" };
  if (!Number.isFinite(value)) return { ok: false, code: "odds_not_finite" }; // NaN, ±Infinity
  if (value < MIN_DECIMAL_ODDS) return { ok: false, code: "odds_below_minimum" }; // 0, negatives, 1.0
  const scaled = toScaled(value);
  if (scaled === null) return { ok: false, code: "odds_precision_exceeded" };
  return { ok: true, scaled };
}

/**
 * Canonical combined odds from server-owned leg values.
 *
 * A submitted total is never trusted: callers pass legs, and this returns the only value the
 * system will store or display.
 */
export function calculateCombinedOdds(
  legs: ReadonlyArray<{ capturedOdds: unknown }>,
): CombinedOddsResult {
  if (legs.length < ACCA_LIMITS.minLegs) return { ok: false, code: "too_few_legs" };
  if (legs.length > ACCA_LIMITS.maxLegs) return { ok: false, code: "too_many_legs" };

  let product = 1n;
  for (let i = 0; i < legs.length; i++) {
    const check = validateLegOdds(legs[i]?.capturedOdds);
    if (!check.ok) return { ok: false, code: check.code, legIndex: i };
    product *= check.scaled;
  }

  // product currently carries SCALE_FACTOR^n. Reduce to one scale factor, rounding half-up
  // exactly once at the canonical precision.
  const divisor = SCALE_FACTOR ** BigInt(legs.length - 1);
  const quotient = product / divisor;
  const remainder = product % divisor;
  const roundedScaled = remainder * 2n >= divisor ? quotient + 1n : quotient;

  const combinedOdds = Number(roundedScaled) / Number(SCALE_FACTOR);
  if (!Number.isFinite(combinedOdds)) return { ok: false, code: "combined_odds_overflow" };
  if (combinedOdds > MAX_COMBINED_ODDS) return { ok: false, code: "combined_odds_overflow" };

  return { ok: true, combinedOdds };
}

/**
 * Display formatting, kept separate from the canonical stored value.
 * Two decimals is the conventional presentation for decimal odds; the stored value keeps
 * four so the total is never re-derived from a rounded display string.
 */
export function formatDecimalOdds(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return "—";
  return value.toFixed(digits);
}

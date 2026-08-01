/**
 * Validation state machine (Sprint 23).
 *
 * Pure and browser-safe.
 *
 * The seven states are deliberately NOT a win/loss binary. Four of them — `void`,
 * `cancelled`, `postponed`, `abandoned` — are settled without a score. Counting them
 * as losses would inflate an apparent miss rate; counting them as wins would inflate
 * accuracy. `isScoredValidationState` is the predicate future Accuracy, Calibration
 * and Trust Score work must gate on.
 */

import type { ValidationReasonCode, ValidationState } from "@/types/evidence";

export const VALIDATION_STATES: readonly ValidationState[] = [
  "pending",
  "won",
  "lost",
  "void",
  "cancelled",
  "postponed",
  "abandoned",
] as const;

export const VALIDATION_STATE_LABELS: Record<ValidationState, string> = {
  pending: "Pending",
  won: "Won",
  lost: "Lost",
  void: "Void",
  cancelled: "Cancelled",
  postponed: "Postponed",
  abandoned: "Abandoned",
};

export const VALIDATION_STATE_DESCRIPTIONS: Record<ValidationState, string> = {
  pending: "Outcome not yet known.",
  won: "Selection settled in favour of the published evidence.",
  lost: "Selection settled against the published evidence.",
  void: "Market voided — excluded from accuracy maths.",
  cancelled: "Fixture cancelled — excluded from accuracy maths.",
  postponed: "Fixture postponed — excluded from accuracy maths.",
  abandoned: "Fixture abandoned — excluded from accuracy maths.",
};

export const VALIDATION_REASON_CODES: readonly ValidationReasonCode[] = [
  "awaiting_result",
  "settled_result",
  "market_void",
  "fixture_cancelled",
  "fixture_postponed",
  "fixture_abandoned",
  "data_correction",
  "settlement_correction",
] as const;

export function isValidationState(value: unknown): value is ValidationState {
  return (
    typeof value === "string" &&
    (VALIDATION_STATES as readonly string[]).includes(value)
  );
}

export function isValidationReasonCode(
  value: unknown
): value is ValidationReasonCode {
  return (
    typeof value === "string" &&
    (VALIDATION_REASON_CODES as readonly string[]).includes(value)
  );
}

export function validationStateLabel(state: ValidationState): string {
  return VALIDATION_STATE_LABELS[state];
}

export function validationStateDescription(state: ValidationState): string {
  return VALIDATION_STATE_DESCRIPTIONS[state];
}

/** Everything except `pending` is terminal: the outcome is known and will not change. */
export function isTerminalValidationState(state: ValidationState): boolean {
  return state !== "pending";
}

/** Only `won` and `lost` contribute to hit rate, calibration and trust scoring. */
export function isScoredValidationState(state: ValidationState): boolean {
  return state === "won" || state === "lost";
}

/** Settled but excluded from scoring — the four non-result terminal states. */
export function isUnscoredTerminalState(state: ValidationState): boolean {
  return isTerminalValidationState(state) && !isScoredValidationState(state);
}

/**
 * Whether a revision may move from `from` to `to`.
 *
 * `pending` may become anything. A terminal state may only change via a correction,
 * and a correction to the same state is a no-op that must not be appended. This is a
 * rule about what a NEW revision may assert — it never licenses editing an old row.
 */
export function canTransition(
  from: ValidationState,
  to: ValidationState
): boolean {
  if (from === to) return false;
  if (from === "pending") return true;
  // Terminal → terminal is allowed only as an explicit correction, and never back to
  // pending: an outcome that was once known does not become unknown.
  return to !== "pending";
}

/**
 * Reason codes that are legitimate for a correction (revision > 1).
 * Revision 1 must state why the outcome is what it is, not that it changed.
 */
export function isCorrectionReasonCode(code: ValidationReasonCode): boolean {
  return code === "data_correction" || code === "settlement_correction";
}

/** The reason code that naturally accompanies a state on first assertion. */
export function defaultReasonCodeFor(
  state: ValidationState
): ValidationReasonCode {
  switch (state) {
    case "pending":
      return "awaiting_result";
    case "won":
    case "lost":
      return "settled_result";
    case "void":
      return "market_void";
    case "cancelled":
      return "fixture_cancelled";
    case "postponed":
      return "fixture_postponed";
    case "abandoned":
      return "fixture_abandoned";
  }
}

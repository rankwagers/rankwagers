/**
 * Last-known serving state for today's daily lists (incident 2026-08-01).
 *
 * Readiness has to answer a question it could not previously ask: *is the product still useful?*
 * Before the same-day fallback existed, "provider unavailable" and "product blank" were the same
 * condition, so reporting a hard failure was accurate. With a valid archive standing in, they are
 * different conditions and must be reported differently — a page serving 132 fixtures from the last
 * good capture is degraded, not down.
 *
 * Deliberately a single in-process value: no store, no schema, no API, no persistence. It is a
 * status observation, not a record, and it is rebuilt within one request of a restart. Nothing here
 * is a secret, a payload, or an unbounded label.
 */

import type { DailyListsSource } from "./types";

export type DailyListsServingState =
  | "serving_fresh"
  | "serving_stale"
  | "unavailable"
  | "unknown";

let servingState: DailyListsServingState = "unknown";

const SOURCE_TO_STATE: Record<DailyListsSource, DailyListsServingState> = {
  fresh_provider: "serving_fresh",
  stale_daily_archive: "serving_stale",
  unavailable: "unavailable",
};

/** Record what the last resolved today-request actually served. */
export function noteDailyListsServing(source: DailyListsSource): void {
  servingState = SOURCE_TO_STATE[source] ?? "unknown";
}

/** `unknown` until the first today-request resolves — never assume health we have not observed. */
export function getDailyListsServingState(): DailyListsServingState {
  return servingState;
}

/** Test helper. Production never calls this. */
export function resetDailyListsServingState(): void {
  servingState = "unknown";
}

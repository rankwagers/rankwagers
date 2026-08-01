import {
  ODDS_CURRENT_MS,
  ODDS_RECENT_MS,
  ODDS_STALE_MS,
} from "./config";

/** Operator price freshness — independent of fixture freshness. */
export type OperatorPriceFreshness =
  | "current"
  | "recently_updated"
  | "stale"
  | "unavailable";

export const OPERATOR_FRESHNESS_THRESHOLDS = {
  currentMs: ODDS_CURRENT_MS,
  recentlyUpdatedMs: ODDS_RECENT_MS,
  staleMs: ODDS_STALE_MS,
} as const;

export function classifyOperatorPriceFreshness(
  observedAt: string | undefined,
  now = Date.now()
): OperatorPriceFreshness {
  if (!observedAt) return "unavailable";
  const ts = Date.parse(observedAt);
  if (!Number.isFinite(ts)) return "unavailable";
  const age = now - ts;
  if (age < 0) return "current";
  if (age <= OPERATOR_FRESHNESS_THRESHOLDS.currentMs) return "current";
  if (age <= OPERATOR_FRESHNESS_THRESHOLDS.recentlyUpdatedMs) {
    return "recently_updated";
  }
  if (age <= OPERATOR_FRESHNESS_THRESHOLDS.staleMs) return "stale";
  return "unavailable";
}

export function priceFreshnessAllowsPricing(
  freshness: OperatorPriceFreshness
): boolean {
  return freshness === "current" || freshness === "recently_updated";
}

export function priceFreshnessAllowsHighestOddsBadge(
  freshness: OperatorPriceFreshness
): boolean {
  return freshness === "current" || freshness === "recently_updated";
}

export function priceFreshnessAllowsBetslip(
  freshness: OperatorPriceFreshness
): boolean {
  return freshness === "current";
}

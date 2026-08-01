/**
 * Sprint 22 — live endpoint paths.
 *
 * Kept in a browser-safe module so the client island and the route handler cannot drift.
 */

export const LIVE_MATCH_API_PATH = "/api/live-match";

/** Default poll cadence. Matches the 60s provider cache — polling faster only burns budget. */
export const LIVE_POLL_INTERVAL_MS = 20_000;
/** Backoff ceiling after consecutive failures. */
export const LIVE_POLL_MAX_INTERVAL_MS = 120_000;
/** Consecutive failures after which the client stops polling and shows a retry affordance. */
export const LIVE_POLL_MAX_FAILURES = 5;

export function liveMatchApiPath(matchId: number, options: { revision?: number } = {}): string {
  const params = new URLSearchParams({ matchId: String(matchId) });
  if (options.revision != null) params.set("since", String(options.revision));
  return `${LIVE_MATCH_API_PATH}?${params.toString()}`;
}

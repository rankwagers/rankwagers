import { rateLimit, type RateLimitResult } from "@/lib/security/rateLimit";

/**
 * Sprint 22 — live update rate limiting.
 *
 * Lives outside `app/api/live-match/route.ts` deliberately. Next's App Router validates the
 * generated route type against a closed set of allowed exports, so a route module that also
 * exports constants fails the build with "not assignable to type 'never'". Following the
 * existing `lib/combo/rateLimit.ts` / `lib/acca-builder/rateLimit.ts` convention keeps the
 * limits importable and testable while the route module exports only handlers and supported
 * route configuration.
 */

/**
 * Comfortably above the 20s client cadence (`LIVE_POLL_INTERVAL_MS`), low enough to bound
 * abuse from a single address. A tab that polls normally uses three of these per minute.
 */
export const LIVE_MATCH_RATE_LIMIT = 30;
export const LIVE_MATCH_RATE_WINDOW_MS = 60_000;

/** Reusable live-match rate-limit interface over the shared in-memory limiter. */
export function rateLimitLiveMatch(input: {
  clientKey: string;
  now?: number;
}): RateLimitResult {
  return rateLimit({
    key: `live-match:${input.clientKey}`,
    limit: LIVE_MATCH_RATE_LIMIT,
    windowMs: LIVE_MATCH_RATE_WINDOW_MS,
    now: input.now,
  });
}

import "server-only";

/**
 * Sprint 22 — server entry point for the live layer.
 *
 * The only module in `lib/live/` that touches a provider. Everything else is pure, which is
 * what allows the domain to be unit tested without network access or mocks.
 *
 * `getMatchLiveContext` is already `unstable_cache`-backed with a 60s revalidate, so calling
 * this from both the page render and the polling route does not multiply upstream requests.
 */

import { getMatchLiveContext } from "@/lib/footystats/matchDetail";
import type { LiveMatchSnapshot } from "@/types/live";
import { liveSourceFromMatchContext } from "./adapter";
import { buildLiveMatchSnapshot } from "./snapshot";

export async function loadLiveMatchSnapshot(
  matchId: number,
  options: { nowSec?: number } = {}
): Promise<LiveMatchSnapshot | null> {
  if (!Number.isSafeInteger(matchId) || matchId <= 0) return null;
  try {
    const context = await getMatchLiveContext(matchId);
    if (!context || !context.homeTeam || !context.awayTeam) return null;
    return buildLiveMatchSnapshot(liveSourceFromMatchContext(context, options));
  } catch {
    // A live section is an enhancement — a provider failure must never fail the match page.
    return null;
  }
}

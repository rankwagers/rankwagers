/**
 * Sprint 22 — provider adapter.
 *
 * Maps the existing `MatchLiveContext` (FootyStats-shaped, already fetched and cached by
 * `lib/footystats/matchDetail.ts`) onto the provider-neutral `LiveMatchSource`. Isolating the
 * mapping here means the live domain never imports a provider module, and a second feed can
 * be added later by writing another adapter rather than by editing the domain.
 *
 * Pure module — it takes an already-fetched context, it does not fetch.
 */

import type { MatchLiveContext } from "@/lib/footystats/matchDetail";
import type { LiveEventInput, LiveMatchSource, LiveStatisticKey } from "@/types/live";

/**
 * The current feed reports only goals and red cards as discrete events, and reports cards as
 * cumulative counts. Yellow cards, substitutions, VAR, penalties and corners therefore arrive
 * as statistics or not at all — the live domain represents that absence explicitly rather
 * than synthesising events, and `docs/live-match-architecture.md` records the gap.
 */
function mapEvents(context: MatchLiveContext): LiveEventInput[] {
  return context.events.map((event, index) => ({
    id: `provider-${event.id || index}`,
    type: event.type,
    minute: event.minute,
    side: event.team,
    label: event.label,
    origin: "provider" as const,
  }));
}

function pair(home: number | null, away: number | null) {
  if (home == null && away == null) return undefined;
  return { home, away };
}

function mapStatistics(
  context: MatchLiveContext
): Partial<Record<LiveStatisticKey, { home: number | null; away: number | null }>> {
  const out: Partial<Record<LiveStatisticKey, { home: number | null; away: number | null }>> =
    {};
  const assign = (key: LiveStatisticKey, home: number | null, away: number | null) => {
    const value = pair(home, away);
    if (value) out[key] = value;
  };

  assign("possession", context.possessionHome, context.possessionAway);
  assign("shots", context.shotsHome, context.shotsAway);
  assign("shots_on_target", context.shotsOnTargetHome, context.shotsOnTargetAway);
  assign("expected_goals", context.xgHome, context.xgAway);
  assign("corners", context.cornersHome, context.cornersAway);
  assign("dangerous_attacks", context.dangerousAttacksHome, context.dangerousAttacksAway);
  // `cardsHome/Away` is a combined card count; mapping it to `yellow_cards` would overstate
  // bookings whenever a red card is in the total, so it is deliberately not mapped.
  return out;
}

export function liveSourceFromMatchContext(
  context: MatchLiveContext,
  options: { nowSec?: number } = {}
): LiveMatchSource {
  return {
    matchId: context.matchId,
    homeTeam: context.homeTeam,
    awayTeam: context.awayTeam,
    homeLogo: context.homeImage ?? null,
    awayLogo: context.awayImage ?? null,
    competition: context.competition || null,
    country: context.country || null,
    status: context.status,
    kickoffUnix: context.kickoffUnix || null,
    minute: context.minute || null,
    addedTime: null,
    homeScore: context.homeScore,
    awayScore: context.awayScore,
    htHome: context.htHome,
    htAway: context.htAway,
    events: mapEvents(context),
    statistics: mapStatistics(context),
    fetchedAt: context.fetchedAt,
    nowSec: options.nowSec,
  };
}

/**
 * Sprint 22 — snapshot composition.
 *
 * `buildLiveMatchSnapshot` is the single entry point for turning a provider-neutral
 * `LiveMatchSource` into the object the server renders and the client diffs. It is pure and
 * deterministic given `nowSec`, which is what makes the hydration tests meaningful: the same
 * source must produce byte-identical markup on the server and on the client.
 *
 * Key ordering in the returned object is fixed, because `lib/live/diff.ts` compares slices by
 * `JSON.stringify` and key order would otherwise create phantom changes.
 */

import type { LiveMatchSnapshot, LiveMatchSource } from "@/types/live";
import { buildLiveEvents } from "./events";
import { buildLiveMomentum } from "./momentum";
import { buildLiveMatchStatus } from "./status";
import { buildLiveStatistics } from "./statistics";
import { buildLiveTimeline } from "./timeline";

function text(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function buildLiveMatchSnapshot(source: LiveMatchSource): LiveMatchSnapshot {
  const status = buildLiveMatchStatus(source);
  const events = buildLiveEvents(source.events, { status });
  const timeline = buildLiveTimeline(events, status);
  const statistics = buildLiveStatistics(source);
  const momentum = buildLiveMomentum({ events: events.items, statistics, status });

  return {
    matchId: source.matchId,
    homeTeam: source.homeTeam,
    awayTeam: source.awayTeam,
    homeLogo: text(source.homeLogo),
    awayLogo: text(source.awayLogo),
    competition: text(source.competition),
    country: text(source.country),
    status,
    events,
    timeline,
    momentum,
    statistics,
    revision: 0,
    generatedAt:
      text(source.fetchedAt) ??
      new Date((source.nowSec ?? Math.floor(Date.now() / 1000)) * 1000).toISOString(),
  };
}

/**
 * Whether a snapshot is worth rendering at all. A snapshot for a fixture that is not in play
 * is valid data — the Live Match section simply stays hidden, per the sprint contract.
 */
export function isRenderableLiveSnapshot(
  snapshot: LiveMatchSnapshot | null | undefined
): snapshot is LiveMatchSnapshot {
  return Boolean(snapshot && snapshot.status.isLive);
}

/**
 * Sprint 22 — incremental update diffing.
 *
 * The performance contract for this sprint is "updates should be incremental; avoid
 * rerendering the entire page". That contract is enforced here, not in the components:
 * `applyLiveUpdate` returns a snapshot in which every slice that did not change keeps its
 * **previous object identity**. Components subscribe per slice via `useSyncExternalStore`,
 * so React bails out of re-rendering any subtree whose slice reference is unchanged.
 *
 * One deliberate subtlety: `status.updatedAt` is excluded from the change comparison. It moves
 * on every poll, and including it would mark the status slice dirty every single tick, which
 * would defeat the whole mechanism. The field therefore reads as "when the data last actually
 * changed" — which is also the more honest label — while the polling client tracks its own
 * "last checked" timestamp separately.
 *
 * Pure module.
 */

import type {
  LiveMatchSnapshot,
  LiveSliceKey,
  LiveUpdateResult,
} from "@/types/live";
import { buildLiveAnnouncements } from "./announce";

export const LIVE_SLICE_KEYS: readonly LiveSliceKey[] = [
  "status",
  "events",
  "timeline",
  "momentum",
  "statistics",
] as const;

/** Fields inside a slice that must not, on their own, mark the slice as changed. */
const VOLATILE_FIELDS: Partial<Record<LiveSliceKey, readonly string[]>> = {
  status: ["updatedAt"],
};

/**
 * Order-insensitive structural stringify. Snapshots built by `buildLiveMatchSnapshot` already
 * have a fixed key order, but snapshots that have made a round trip through JSON, a cache, or
 * a future adapter may not — sorting keys removes that whole class of phantom diff.
 */
export function stableStringify(value: unknown, omitKeys: readonly string[] = []): string {
  const seen = new WeakSet<object>();
  const walk = (input: unknown): unknown => {
    if (input === null || typeof input !== "object") return input;
    if (seen.has(input as object)) return "[circular]";
    seen.add(input as object);
    if (Array.isArray(input)) return input.map(walk);
    const source = input as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      if (omitKeys.includes(key)) continue;
      out[key] = walk(source[key]);
    }
    return out;
  };
  return JSON.stringify(walk(value));
}

export function sliceChanged(
  key: LiveSliceKey,
  previous: LiveMatchSnapshot,
  next: LiveMatchSnapshot
): boolean {
  const omit = VOLATILE_FIELDS[key] ?? [];
  return stableStringify(previous[key], omit) !== stableStringify(next[key], omit);
}

/**
 * Merge `next` onto `previous`, preserving identity for unchanged slices.
 *
 * When nothing changed at all the *previous snapshot object itself* is returned, so even a
 * consumer subscribed to the whole snapshot performs no work.
 */
export function applyLiveUpdate(
  previous: LiveMatchSnapshot | null,
  next: LiveMatchSnapshot
): LiveUpdateResult {
  if (!previous) {
    return {
      snapshot: { ...next, revision: next.revision || 1 },
      changed: [...LIVE_SLICE_KEYS],
      announcements: [],
    };
  }

  if (previous.matchId !== next.matchId) {
    // A different fixture is not an update; adopt it wholesale and announce nothing.
    return {
      snapshot: { ...next, revision: 1 },
      changed: [...LIVE_SLICE_KEYS],
      announcements: [],
    };
  }

  const changed = LIVE_SLICE_KEYS.filter((key) => sliceChanged(key, previous, next));

  if (!changed.length) {
    return { snapshot: previous, changed: [], announcements: [] };
  }

  const revision = previous.revision + 1;
  const snapshot: LiveMatchSnapshot = {
    ...previous,
    homeLogo: next.homeLogo,
    awayLogo: next.awayLogo,
    competition: next.competition,
    country: next.country,
    status: changed.includes("status") ? next.status : previous.status,
    events: changed.includes("events") ? next.events : previous.events,
    timeline: changed.includes("timeline") ? next.timeline : previous.timeline,
    momentum: changed.includes("momentum") ? next.momentum : previous.momentum,
    statistics: changed.includes("statistics") ? next.statistics : previous.statistics,
    revision,
    generatedAt: next.generatedAt,
  };

  return {
    snapshot,
    changed,
    announcements: buildLiveAnnouncements(previous, snapshot),
  };
}

import type { FreshnessState } from "./types";

/** Thresholds in seconds (configurable via env). */
export function freshnessThresholds() {
  return {
    currentSec: Number(process.env.SNAPSHOT_FRESH_CURRENT_SEC ?? 15 * 60),
    recentlySec: Number(process.env.SNAPSHOT_FRESH_RECENT_SEC ?? 60 * 60),
    staleUsableSec: Number(process.env.SNAPSHOT_FRESH_STALE_SEC ?? 6 * 60 * 60),
    expiredSec: Number(process.env.SNAPSHOT_FRESH_EXPIRED_SEC ?? 24 * 60 * 60),
  };
}

export function classifySnapshotAge(
  createdAtIso: string,
  now = Date.now()
): FreshnessState {
  const created = Date.parse(createdAtIso);
  if (!Number.isFinite(created)) return "unknown";
  const ageSec = Math.max(0, (now - created) / 1000);
  const t = freshnessThresholds();
  if (ageSec <= t.currentSec) return "current";
  if (ageSec <= t.recentlySec) return "recently_updated";
  if (ageSec <= t.staleUsableSec) return "stale_but_usable";
  if (ageSec <= t.expiredSec) return "expired";
  return "expired";
}

export function snapshotAgeSeconds(createdAtIso: string, now = Date.now()): number {
  const created = Date.parse(createdAtIso);
  if (!Number.isFinite(created)) return -1;
  return Math.max(0, Math.floor((now - created) / 1000));
}

export function isSnapshotUsable(state: FreshnessState): boolean {
  return (
    state === "current" ||
    state === "recently_updated" ||
    state === "stale_but_usable"
  );
}

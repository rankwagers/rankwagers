"use client";

/**
 * Sprint 22 — React bindings for the live store.
 *
 * `useLiveSlice` returns the current object for one slice and re-renders **only** when that
 * slice's identity changes. Because `applyLiveUpdate` preserves identity for unchanged
 * slices, a poll that only moves the clock does not re-render the statistics table, the
 * timeline or the momentum graph.
 *
 * Two separate contexts, and the split matters: `LiveStoreContext` carries a value that is
 * created once and never replaced, so a context change can never itself invalidate every
 * consumer. Poll state (which does change on every tick) lives in `LiveConnectionContext`,
 * consumed only by the one component that displays it.
 *
 * Every hook takes a `fallback`, which is the server-rendered value. That serves two
 * purposes: the components remain usable standalone with no provider mounted (which is what
 * makes them reusable outside the fixture page), and the first client render is guaranteed to
 * match the server markup so hydration is stable.
 */

import { createContext, useContext, useSyncExternalStore } from "react";
import type {
  LiveAnnouncement,
  LiveMatchSnapshot,
  LiveSliceKey,
  LiveStore,
} from "@/types/live";

export type LiveStoreContextValue = {
  store: LiveStore;
  /** Present so analytics can read the fixture id without threading props everywhere. */
  matchId: number;
  locale: string;
};

export const LiveStoreContext = createContext<LiveStoreContextValue | null>(null);

export type LiveConnectionState = "idle" | "polling" | "error" | "stopped";

export type LiveConnectionContextValue = {
  connection: LiveConnectionState;
  /** Wall-clock ISO of the last successful poll, whether or not anything changed. */
  lastCheckedAt: string | null;
  consecutiveFailures: number;
  retry: () => void;
};

export const LiveConnectionContext = createContext<LiveConnectionContextValue | null>(null);

export function useLiveStoreContext(): LiveStoreContextValue | null {
  return useContext(LiveStoreContext);
}

export function useLiveConnection(): LiveConnectionContextValue | null {
  return useContext(LiveConnectionContext);
}

const noopSubscribe = () => () => {};

/**
 * Subscribe to a single slice. `fallback` is used when no provider is mounted (standalone
 * usage) and as the server snapshot during hydration.
 */
export function useLiveSlice<K extends LiveSliceKey>(
  key: K,
  fallback: LiveMatchSnapshot[K]
): LiveMatchSnapshot[K] {
  const store = useContext(LiveStoreContext)?.store ?? null;

  return useSyncExternalStore(
    store ? store.subscribe : noopSubscribe,
    () => (store ? store.getSlice(key) : fallback),
    () => fallback
  );
}

export function useLiveSnapshot(fallback: LiveMatchSnapshot): LiveMatchSnapshot {
  const store = useContext(LiveStoreContext)?.store ?? null;

  return useSyncExternalStore(
    store ? store.subscribe : noopSubscribe,
    () => (store ? store.getSnapshot() : fallback),
    () => fallback
  );
}

const NO_ANNOUNCEMENTS: LiveAnnouncement[] = [];

export function useLiveAnnouncements(): LiveAnnouncement[] {
  const store = useContext(LiveStoreContext)?.store ?? null;

  return useSyncExternalStore(
    store ? store.subscribe : noopSubscribe,
    () => (store ? store.getAnnouncements() : NO_ANNOUNCEMENTS),
    () => NO_ANNOUNCEMENTS
  );
}

/**
 * Read the current phase without subscribing — for analytics payloads at interaction time,
 * where re-rendering on every phase change would be pointless work.
 */
export function readLivePhase(
  context: LiveStoreContextValue | null,
  fallback: LiveMatchSnapshot["status"]["phase"]
): LiveMatchSnapshot["status"]["phase"] {
  return context?.store.getSnapshot().status.phase ?? fallback;
}

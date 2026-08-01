/**
 * Sprint 22 — live snapshot store.
 *
 * Deliberately framework-agnostic (no React import) so the update semantics can be unit
 * tested without a renderer, and so a future non-React surface can reuse it. The React
 * binding lives in `lib/live/context.ts`.
 */

import type {
  LiveAnnouncement,
  LiveMatchSnapshot,
  LiveSliceKey,
  LiveStore,
  LiveStoreListener,
  LiveUpdateResult,
} from "@/types/live";
import { applyLiveUpdate } from "./diff";

/** Announcement history kept for the live region; older entries are dropped. */
export const LIVE_ANNOUNCEMENT_BUFFER = 6;

export function createLiveStore(initial: LiveMatchSnapshot): LiveStore {
  let snapshot: LiveMatchSnapshot = initial;
  let announcements: LiveAnnouncement[] = [];
  const listeners = new Set<LiveStoreListener>();

  const store: LiveStore = {
    getSnapshot: () => snapshot,
    getSlice: <K extends LiveSliceKey>(key: K) => snapshot[key],
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getAnnouncements: () => announcements,
    apply(next) {
      const result: LiveUpdateResult = applyLiveUpdate(snapshot, next);
      if (!result.changed.length) return result;
      snapshot = result.snapshot;
      if (result.announcements.length) {
        announcements = [...announcements, ...result.announcements].slice(
          -LIVE_ANNOUNCEMENT_BUFFER
        );
      }
      // A listener that throws must not stop the others from being notified.
      for (const listener of Array.from(listeners)) {
        try {
          listener(result);
        } catch {
          /* subscriber errors are isolated */
        }
      }
      return result;
    },
  };

  return store;
}

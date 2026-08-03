import { useSyncExternalStore } from "react";

/* ============================================================================
   FOLLOWING
   ----------------------------------------------------------------------------
   The one thing on this page the reader owns. No account, no dialog, no
   confirmation — a mark you place on a match, kept between visits, counted in
   the header. It exists so that arriving at RankWagers is not only reading:
   it is assembling your own matchday.
   ========================================================================== */

const KEY = "rw.following";

let following: string[] = read();
const listeners = new Set<() => void>();

function read(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function commit(next: string[]) {
  following = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* private mode — the mark still holds for this visit */
  }
  listeners.forEach((l) => l());
}

export function toggleFollow(id: string) {
  commit(following.includes(id) ? following.filter((f) => f !== id) : [...following, id]);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useFollowing() {
  return useSyncExternalStore(
    subscribe,
    () => following,
    () => following,
  );
}

export function useIsFollowing(id: string) {
  return useFollowing().includes(id);
}

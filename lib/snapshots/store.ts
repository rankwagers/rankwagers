import { createMemorySnapshotStore } from "./memory";
import { createPostgresSnapshotStore } from "./postgres";
import type { SnapshotStore } from "./types";

let store: SnapshotStore | null = null;
let pinned = false;

function createDefault(): SnapshotStore {
  if (process.env.SNAPSHOT_ADAPTER?.trim().toLowerCase() === "memory") {
    return createMemorySnapshotStore();
  }
  const url =
    process.env.SNAPSHOT_DATABASE_URL?.trim() ||
    process.env.ATTRIBUTION_DATABASE_URL?.trim() ||
    process.env.ODDS_HISTORY_DATABASE_URL?.trim() ||
    "";
  if (!url) return createMemorySnapshotStore();
  return createPostgresSnapshotStore(url);
}

export function getSnapshotStore(): SnapshotStore {
  if (!store) store = createDefault();
  return store;
}

export function setSnapshotStore(next: SnapshotStore): void {
  store = next;
  pinned = true;
}

export function resetSnapshotStore(): void {
  store = createMemorySnapshotStore();
  pinned = true;
}

export function clearSnapshotStorePin(): void {
  store = null;
  pinned = false;
  void pinned;
}

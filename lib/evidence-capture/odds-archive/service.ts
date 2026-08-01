/**
 * Odds archive store resolver (Sprint 23B, M9 wiring).
 *
 * Single process-wide choke-point for the odds archive, mirroring
 * `lib/archive/evidence/service.ts`. The adapter is selected the same way the evidence
 * archive selects its own — `EVIDENCE_ARCHIVE_ADAPTER=memory` opts into volatile
 * storage; anything else gets the durable NDJSON log under the shared archive dir. This
 * keeps the mandatory `evidence_capture` odds record (§4.7 / DoD 5) writing through one
 * resolved store instead of each caller re-creating an adapter.
 *
 * Server-only: the file adapter pulls in `fs`.
 */

import "server-only";
import { createFileOddsArchive } from "./file";
import { createMemoryOddsArchive } from "./memory";
import type { OddsArchiveStore } from "./store";

let store: OddsArchiveStore | null = null;

function createDefaultStore(): OddsArchiveStore {
  if (process.env.EVIDENCE_ARCHIVE_ADAPTER?.trim().toLowerCase() === "memory") {
    return createMemoryOddsArchive();
  }
  return createFileOddsArchive();
}

export function getOddsArchiveStore(): OddsArchiveStore {
  if (!store) store = createDefaultStore();
  return store;
}

/** Test/bootstrap hook — pins a store for the process. */
export function setOddsArchiveStore(next: OddsArchiveStore): void {
  store = next;
}

/** Drops the pin so the next read re-resolves from the environment. */
export function resetOddsArchiveStore(): void {
  store = null;
}

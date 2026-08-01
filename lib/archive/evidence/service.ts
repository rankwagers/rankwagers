/**
 * Evidence archive service — the single entry point for reading and writing history.
 *
 * Pages, API routes and capture jobs use this; nothing outside `lib/archive/evidence/`
 * should talk to a store adapter directly.
 *
 * FAIL-SOFT READS: every read returns a well-formed view. If the archive is
 * unreachable the caller gets an `archive_unavailable` empty view, never an exception
 * and never a half-rendered page. Writes are the opposite — they return their failure
 * so a capture job can retry or alert rather than silently drop evidence.
 *
 * Server-only.
 */

import "server-only";
import type {
  EvidenceHistory,
  EvidenceHistoryView,
  EvidenceSnapshot,
  ValidationRecord,
} from "@/types/evidence";
import { EVIDENCE_HISTORY_DEFAULT_LIMIT } from "@/lib/evidence/constants";
import { createFileEvidenceArchive } from "./file";
import { createMemoryEvidenceArchive } from "./memory";
import {
  emptyEvidenceHistoryView,
  projectEvidenceHistory,
} from "./project";
import type { EvidenceAppendResult, EvidenceArchiveStore } from "./store";

let store: EvidenceArchiveStore | null = null;

function createDefaultStore(): EvidenceArchiveStore {
  // Explicit opt-in to volatile storage; anything else gets the durable NDJSON log.
  if (process.env.EVIDENCE_ARCHIVE_ADAPTER?.trim().toLowerCase() === "memory") {
    return createMemoryEvidenceArchive();
  }
  return createFileEvidenceArchive();
}

export function getEvidenceArchiveStore(): EvidenceArchiveStore {
  if (!store) store = createDefaultStore();
  return store;
}

/** Test/bootstrap hook — pins a store for the process. */
export function setEvidenceArchiveStore(next: EvidenceArchiveStore): void {
  store = next;
}

/** Drops the pin so the next read re-resolves from the environment. */
export function resetEvidenceArchiveStore(): void {
  store = null;
}

export type LoadEvidenceHistoryOptions = {
  locale?: string;
  limit?: number;
};

/** Raw history for a fixture. Throws only if the store throws — callers wrap it. */
export async function loadEvidenceHistory(
  fixtureId: number,
  options: LoadEvidenceHistoryOptions = {}
): Promise<EvidenceHistory> {
  const archive = getEvidenceArchiveStore();
  const limit = options.limit ?? EVIDENCE_HISTORY_DEFAULT_LIMIT;
  const [snapshots, validations] = await Promise.all([
    archive.listSnapshots(fixtureId, { limit }),
    archive.listValidations(fixtureId, { limit }),
  ]);
  return { fixtureId, snapshots, validations };
}

/**
 * Presentation-ready history. Never throws.
 *
 * An unreachable archive is reported as `archive_unavailable` rather than swallowed as
 * "no history" — the two mean different things to a reader deciding whether to trust
 * the absence of evidence.
 */
export async function getEvidenceHistoryView(
  fixtureId: number,
  options: LoadEvidenceHistoryOptions = {}
): Promise<EvidenceHistoryView> {
  if (!Number.isInteger(fixtureId) || fixtureId <= 0) {
    return emptyEvidenceHistoryView(fixtureId, "fixture_not_tracked");
  }
  try {
    const history = await loadEvidenceHistory(fixtureId, options);
    return projectEvidenceHistory(history, { locale: options.locale });
  } catch {
    return emptyEvidenceHistoryView(fixtureId, "archive_unavailable");
  }
}

/** Latest snapshot for a fixture, or `null`. Never throws. */
export async function getLatestEvidenceSnapshot(
  fixtureId: number
): Promise<EvidenceSnapshot | null> {
  if (!Number.isInteger(fixtureId) || fixtureId <= 0) return null;
  try {
    return await getEvidenceArchiveStore().latestSnapshot(fixtureId);
  } catch {
    return null;
  }
}

/** All validation revisions for a fixture, ascending. Never throws. */
export async function getValidationRevisions(
  fixtureId: number,
  options: LoadEvidenceHistoryOptions = {}
): Promise<ValidationRecord[]> {
  if (!Number.isInteger(fixtureId) || fixtureId <= 0) return [];
  try {
    return await getEvidenceArchiveStore().listValidations(fixtureId, {
      limit: options.limit ?? EVIDENCE_HISTORY_DEFAULT_LIMIT,
    });
  } catch {
    return [];
  }
}

/** Append a snapshot. Failures are returned, not thrown. */
export async function appendEvidenceSnapshot(
  snapshot: EvidenceSnapshot
): Promise<EvidenceAppendResult<EvidenceSnapshot>> {
  try {
    return await getEvidenceArchiveStore().appendSnapshot(snapshot);
  } catch (error) {
    return {
      ok: false,
      code: "write_failed",
      message: error instanceof Error ? error.message : "append failed",
    };
  }
}

/** Append a validation revision. Failures are returned, not thrown. */
export async function appendValidationRecord(
  record: ValidationRecord
): Promise<EvidenceAppendResult<ValidationRecord>> {
  try {
    return await getEvidenceArchiveStore().appendValidation(record);
  } catch (error) {
    return {
      ok: false,
      code: "write_failed",
      message: error instanceof Error ? error.message : "append failed",
    };
  }
}

/** Next sequence number to mint for a fixture. Returns 1 when history is unreadable. */
export async function nextEvidenceSequence(fixtureId: number): Promise<number> {
  try {
    return await getEvidenceArchiveStore().nextSequence(fixtureId);
  } catch {
    return 1;
  }
}

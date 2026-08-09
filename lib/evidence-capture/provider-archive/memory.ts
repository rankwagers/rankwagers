/**
 * In-memory provider archive (Sprint 23B, Milestone M2).
 *
 * Reference adapter for deterministic tests. Isolated per instance (no global
 * mutable state), immutable on write, defensive-copy on read, deterministic list
 * order, and fail-closed on identity/hash conflict. No I/O.
 */

import {
  cloneProviderRecord,
  compareProviderRecords,
  verifyProviderArchiveRecord,
  type ProviderArchiveRecord,
} from "./record";
import {
  decideProviderAppend,
  type ProviderArchiveAppendResult,
  type ProviderArchiveStore,
} from "./store";

export type MemoryProviderArchive = ProviderArchiveStore & {
  /** Test affordance — drops every record. Not part of the store contract. */
  reset(): void;
};

export function createMemoryProviderArchive(): MemoryProviderArchive {
  const byId = new Map<string, ProviderArchiveRecord>();

  async function append(
    record: ProviderArchiveRecord
  ): Promise<ProviderArchiveAppendResult> {
    if (!verifyProviderArchiveRecord(record)) {
      return {
        ok: false,
        code: "invalid_record",
        message: "record failed identity/content-hash integrity check",
      };
    }
    const existing = byId.get(record.id) ?? null;
    const decision = decideProviderAppend(existing, record);
    if (decision.kind === "reject") {
      return { ok: false, code: decision.code, message: decision.message };
    }
    if (decision.kind === "duplicate") {
      return {
        ok: true,
        appended: false,
        duplicate: true,
        record: cloneProviderRecord(decision.record),
      };
    }
    // Store an independent frozen copy so later caller mutations cannot reach it.
    byId.set(record.id, cloneProviderRecord(record));
    return {
      ok: true,
      appended: true,
      duplicate: false,
      record: cloneProviderRecord(record),
    };
  }

  async function get(id: string): Promise<ProviderArchiveRecord | null> {
    const record = byId.get(id);
    return record ? cloneProviderRecord(record) : null;
  }

  async function listByFixture(
    fixtureId: number
  ): Promise<ProviderArchiveRecord[]> {
    return [...byId.values()]
      .filter((r) => r.fixtureId === fixtureId)
      .sort(compareProviderRecords)
      .map(cloneProviderRecord);
  }

  return {
    append,
    get,
    listByFixture,
    reset() {
      byId.clear();
    },
  };
}

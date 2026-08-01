/**
 * Raw Provider Archive — in-memory adapter (Sprint 23B).
 *
 * Client-safe (no `server-only`, no fs). Used by tests and as a non-durable fallback. Enforces the
 * same append-only admission rule as the file adapter via `decideRawProviderAppend`.
 */

import {
  cloneRawProviderRecord,
  compareRawProviderRecords,
  verifyRawProviderRecord,
  type RawProviderRecord,
} from "./record";
import {
  decideRawProviderAppend,
  type RawProviderAppendResult,
  type RawProviderArchiveStore,
} from "./store";

export type MemoryRawProviderArchive = RawProviderArchiveStore & {
  /** Test helper: number of retained records. */
  size(): number;
  /** Test helper: clear all records. */
  reset(): void;
};

export function createMemoryRawProviderArchive(): MemoryRawProviderArchive {
  const byId = new Map<string, RawProviderRecord>();
  const order: string[] = [];

  async function append(
    record: RawProviderRecord
  ): Promise<RawProviderAppendResult> {
    if (!verifyRawProviderRecord(record)) {
      return {
        ok: false,
        code: "invalid_record",
        message: "record failed identity/content-hash integrity check",
      };
    }
    const existing = byId.get(record.id) ?? null;
    const decision = decideRawProviderAppend(existing, record);
    if (decision.kind === "reject") {
      return { ok: false, code: decision.code, message: decision.message };
    }
    if (decision.kind === "duplicate") {
      return {
        ok: true,
        appended: false,
        duplicate: true,
        record: cloneRawProviderRecord(decision.record),
      };
    }
    byId.set(record.id, record);
    order.push(record.id);
    return {
      ok: true,
      appended: true,
      duplicate: false,
      record: cloneRawProviderRecord(record),
    };
  }

  async function get(id: string): Promise<RawProviderRecord | null> {
    const found = byId.get(id);
    return found ? cloneRawProviderRecord(found) : null;
  }

  async function list(): Promise<RawProviderRecord[]> {
    return order
      .map((id) => byId.get(id) as RawProviderRecord)
      .sort(compareRawProviderRecords)
      .map(cloneRawProviderRecord);
  }

  async function listByProvider(provider: string): Promise<RawProviderRecord[]> {
    return (await list()).filter((r) => r.provider === provider);
  }

  return {
    append,
    get,
    list,
    listByProvider,
    size: () => byId.size,
    reset: () => {
      byId.clear();
      order.length = 0;
    },
  };
}

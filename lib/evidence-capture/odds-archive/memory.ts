/**
 * In-memory odds archive (Sprint 23B, M3).
 *
 * Isolated per instance (no module-global record state), immutable on write,
 * defensive-copy on read, deterministic order, fail-closed on identity/hash conflict.
 * No I/O.
 */

import {
  cloneOddsRecord,
  compareOddsRecords,
  verifyOddsRecord,
  type OddsArchiveRecord,
} from "./record";
import {
  decideOddsAppend,
  type OddsArchiveAppendResult,
  type OddsArchiveStore,
} from "./store";

export type MemoryOddsArchive = OddsArchiveStore & {
  /** Test affordance — drops every record. Not part of the store contract. */
  reset(): void;
};

export function createMemoryOddsArchive(): MemoryOddsArchive {
  const byId = new Map<string, OddsArchiveRecord>();

  async function append(
    record: OddsArchiveRecord
  ): Promise<OddsArchiveAppendResult> {
    if (!verifyOddsRecord(record)) {
      return {
        ok: false,
        code: "invalid_record",
        message: "record failed identity/content-hash integrity check",
      };
    }
    const existing = byId.get(record.id) ?? null;
    const decision = decideOddsAppend(existing, record);
    if (decision.kind === "reject") {
      return { ok: false, code: decision.code, message: decision.message };
    }
    if (decision.kind === "duplicate") {
      return {
        ok: true,
        appended: false,
        duplicate: true,
        record: cloneOddsRecord(decision.record),
      };
    }
    byId.set(record.id, cloneOddsRecord(record));
    return {
      ok: true,
      appended: true,
      duplicate: false,
      record: cloneOddsRecord(record),
    };
  }

  async function get(id: string): Promise<OddsArchiveRecord | null> {
    const record = byId.get(id);
    return record ? cloneOddsRecord(record) : null;
  }

  async function listByCapture(
    captureId: string
  ): Promise<OddsArchiveRecord[]> {
    return [...byId.values()]
      .filter((r) => r.captureId === captureId)
      .sort(compareOddsRecords)
      .map(cloneOddsRecord);
  }

  async function listByFixture(
    fixtureId: number
  ): Promise<OddsArchiveRecord[]> {
    return [...byId.values()]
      .filter((r) => r.fixtureId === fixtureId)
      .sort(compareOddsRecords)
      .map(cloneOddsRecord);
  }

  return {
    append,
    get,
    listByCapture,
    listByFixture,
    reset() {
      byId.clear();
    },
  };
}

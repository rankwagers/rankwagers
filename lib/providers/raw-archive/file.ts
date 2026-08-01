/**
 * Raw Provider Archive — durable NDJSON adapter (Sprint 23B). Server-only.
 *
 * Append-only on disk: every write is a single `appendFile` of one line — O(1) per append, NEVER a
 * whole-file rewrite. Physically separate from the evidence and M2 provider archives: a distinct
 * `provider-archive-raw/records.ndjson` under the resolved evidence archive directory.
 *
 * FAIL-CLOSED READS: a missing file is an empty archive; every other read failure (EACCES/EIO/…) is
 * surfaced, never masked. Malformed lines and integrity failures are hard errors. Physically
 * duplicated lines reconcile on read (same id + same contentHash → collapse; same id + different
 * contentHash → fail-closed immutable_violation-on-disk).
 *
 * CONCURRENCY: appends to the SAME file path are serialized by an in-process per-path mutex (single
 * process only). Multi-process/host safety requires external single-writer locking at activation —
 * NOT provided here (the archive ships dormant).
 *
 * NDJSON is an INITIAL adapter only (no PostgreSQL work this sprint).
 */

import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { resolveEvidenceArchiveDir } from "@/lib/archive/evidence/file";
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

const appendChains = new Map<string, Promise<void>>();

function serializeAppend<T>(filePath: string, task: () => Promise<T>): Promise<T> {
  const prior = appendChains.get(filePath) ?? Promise.resolve();
  const run = prior.then(task, task);
  const chained = run.then(
    () => undefined,
    () => undefined
  );
  appendChains.set(filePath, chained);
  void chained.finally(() => {
    if (appendChains.get(filePath) === chained) appendChains.delete(filePath);
  });
  return run;
}

/** Resolve the raw-archive paths. Separate physical store under the evidence dir. */
export function rawProviderArchivePaths(baseDir?: string) {
  const dir =
    baseDir ?? path.join(resolveEvidenceArchiveDir(), "provider-archive-raw");
  return { dir, records: path.join(dir, "records.ndjson") };
}

export function createFileRawProviderArchive(
  baseDir?: string
): RawProviderArchiveStore {
  const { dir: ARCHIVE_DIR, records: RECORDS_FILE } =
    rawProviderArchivePaths(baseDir);

  async function readAll(): Promise<RawProviderRecord[]> {
    let raw: string;
    try {
      raw = await fs.readFile(RECORDS_FILE, "utf8");
    } catch (error) {
      const code = (error as NodeJS.ErrnoException | null)?.code;
      if (code === "ENOENT") return [];
      throw new Error(
        `raw provider archive: read failed (${code ?? "unknown"}) for ${RECORDS_FILE}`,
        { cause: error }
      );
    }
    const byId = new Map<string, RawProviderRecord>();
    const orderIds: string[] = [];
    const lines = raw.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        throw new Error(
          `raw provider archive: malformed NDJSON at line ${i + 1} in ${RECORDS_FILE}`
        );
      }
      if (!verifyRawProviderRecord(parsed)) {
        throw new Error(
          `raw provider archive: corrupted record at line ${i + 1} in ${RECORDS_FILE}`
        );
      }
      const existing = byId.get(parsed.id);
      if (existing) {
        if (existing.contentHash !== parsed.contentHash) {
          throw new Error(
            `raw provider archive: conflicting duplicate id ${parsed.id} at line ${
              i + 1
            } (immutable_violation on disk) in ${RECORDS_FILE}`
          );
        }
        continue;
      }
      byId.set(parsed.id, parsed);
      orderIds.push(parsed.id);
    }
    return orderIds.map((id) => byId.get(id) as RawProviderRecord);
  }

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
    return serializeAppend(RECORDS_FILE, async () => {
      let existing: RawProviderRecord | null;
      try {
        const all = await readAll();
        existing = all.find((r) => r.id === record.id) ?? null;
      } catch (error) {
        return {
          ok: false,
          code: "write_failed",
          message: error instanceof Error ? error.message : "archive read failed",
        };
      }
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
      try {
        await fs.mkdir(ARCHIVE_DIR, { recursive: true });
        await fs.appendFile(RECORDS_FILE, `${JSON.stringify(record)}\n`, "utf8");
      } catch (error) {
        return {
          ok: false,
          code: "write_failed",
          message: error instanceof Error ? error.message : "append failed",
        };
      }
      return {
        ok: true,
        appended: true,
        duplicate: false,
        record: cloneRawProviderRecord(record),
      };
    });
  }

  async function get(id: string): Promise<RawProviderRecord | null> {
    const all = await readAll();
    const found = all.find((r) => r.id === id);
    return found ? cloneRawProviderRecord(found) : null;
  }

  async function list(): Promise<RawProviderRecord[]> {
    return (await readAll()).sort(compareRawProviderRecords).map(cloneRawProviderRecord);
  }

  async function listByProvider(provider: string): Promise<RawProviderRecord[]> {
    return (await list()).filter((r) => r.provider === provider);
  }

  return { append, get, list, listByProvider };
}

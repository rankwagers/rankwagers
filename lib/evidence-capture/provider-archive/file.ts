/**
 * Durable NDJSON provider archive (Sprint 23B, Milestone M2).
 *
 * Append-only on disk: every write is a single `appendFile` of one line — O(1) per
 * append, NEVER a whole-file rewrite (migration risk register R1). Physically
 * separate from the evidence archive: a distinct `provider-archive/records.ndjson`
 * under the resolved archive directory.
 *
 * FAIL-CLOSED READS: unlike the evidence NDJSON adapter, this store does NOT skip
 * malformed lines. A parse failure or a record that fails integrity is a clear error;
 * there is no silent corruption recovery (M2 §6/§7). Physically duplicated lines are
 * reconciled on read: same id + same contentHash collapses to one record; same id +
 * DIFFERENT contentHash is a fail-closed `immutable_violation`-on-disk error — a
 * conflicting line is never silently shadowed by the first match.
 *
 * CONCURRENCY GUARANTEE (scope-limited, by design):
 *   - Appends to the SAME file path are serialized by an IN-PROCESS per-path mutex,
 *     so two concurrent writers in ONE Node process cannot both observe "absent" and
 *     both append. The read→decide→write cycle runs while holding the lock. Different
 *     file paths do not block each other. The lock registry holds promises only — it
 *     is NOT a record store and caches no archive data.
 *   - This protects concurrent writers within a SINGLE process only. It does NOT
 *     provide multi-process or multi-host safety. Sustained production activation
 *     REQUIRES external single-writer / advisory locking (Phase 3 orchestration lock
 *     + the Postgres cutover gate in risk register R1); the read-side conflict
 *     detection above is the fail-closed backstop, not a substitute.
 *
 * NDJSON is an INITIAL adapter only. Server-only.
 */

import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { resolveEvidenceArchiveDir } from "@/lib/archive/evidence/file";
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

/**
 * In-process append serialization, keyed by absolute records-file path. Holds a
 * settling promise chain per path — a lock, never archive data. Entries self-prune
 * when their chain goes idle.
 */
const appendChains = new Map<string, Promise<void>>();

function serializeAppend<T>(
  filePath: string,
  task: () => Promise<T>
): Promise<T> {
  const prior = appendChains.get(filePath) ?? Promise.resolve();
  const run = prior.then(task, task);
  const chained = run.then(
    () => undefined,
    () => undefined
  );
  appendChains.set(filePath, chained);
  void chained.finally(() => {
    if (appendChains.get(filePath) === chained) {
      appendChains.delete(filePath);
    }
  });
  return run;
}

/**
 * Resolve the provider-archive paths. Defaults to a `provider-archive` subdirectory
 * of the durable evidence archive dir (`resolveEvidenceArchiveDir`), keeping it a
 * separate physical store. An explicit `baseDir` override makes the adapter testable.
 */
export function providerArchivePaths(baseDir?: string) {
  const dir = baseDir ?? path.join(resolveEvidenceArchiveDir(), "provider-archive");
  return { dir, records: path.join(dir, "records.ndjson") };
}

export function createFileProviderArchive(baseDir?: string): ProviderArchiveStore {
  const { dir: ARCHIVE_DIR, records: RECORDS_FILE } = providerArchivePaths(baseDir);

  async function readAll(): Promise<ProviderArchiveRecord[]> {
    let raw: string;
    try {
      raw = await fs.readFile(RECORDS_FILE, "utf8");
    } catch (error) {
      // ONLY a missing file is an empty archive. Every other read failure
      // (EACCES/EIO/EISDIR/EMFILE/ENFILE/…) is surfaced fail-closed — never masked
      // as an empty archive — preserving the original cause and errno code.
      const code = (error as NodeJS.ErrnoException | null)?.code;
      if (code === "ENOENT") return [];
      throw new Error(
        `provider archive: read failed (${code ?? "unknown"}) for ${RECORDS_FILE}`,
        { cause: error }
      );
    }
    const byId = new Map<string, ProviderArchiveRecord>();
    const order: string[] = [];
    const lines = raw.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue; // tolerate blank separators only
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        throw new Error(
          `provider archive: malformed NDJSON at line ${i + 1} in ${RECORDS_FILE}`
        );
      }
      if (!verifyProviderArchiveRecord(parsed)) {
        throw new Error(
          `provider archive: corrupted record at line ${i + 1} in ${RECORDS_FILE}`
        );
      }
      const existing = byId.get(parsed.id);
      if (existing) {
        if (existing.contentHash !== parsed.contentHash) {
          throw new Error(
            `provider archive: conflicting duplicate id ${parsed.id} at line ${
              i + 1
            } (immutable_violation on disk) in ${RECORDS_FILE}`
          );
        }
        // Same id + same contentHash — a benign physical duplicate line; collapse it.
        continue;
      }
      byId.set(parsed.id, parsed);
      order.push(parsed.id);
    }
    return order.map((id) => byId.get(id) as ProviderArchiveRecord);
  }

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
    return serializeAppend(RECORDS_FILE, async () => {
      let existing: ProviderArchiveRecord | null;
      try {
        const all = await readAll();
        existing = all.find((r) => r.id === record.id) ?? null;
      } catch (error) {
        // Corruption/read failure is surfaced, never masked as a successful append.
        return {
          ok: false,
          code: "write_failed",
          message: error instanceof Error ? error.message : "archive read failed",
        };
      }
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
        record: cloneProviderRecord(record),
      };
    });
  }

  async function get(id: string): Promise<ProviderArchiveRecord | null> {
    const all = await readAll();
    const found = all.find((r) => r.id === id);
    return found ? cloneProviderRecord(found) : null;
  }

  async function listByFixture(
    fixtureId: number
  ): Promise<ProviderArchiveRecord[]> {
    const all = await readAll();
    return all
      .filter((r) => r.fixtureId === fixtureId)
      .sort(compareProviderRecords)
      .map(cloneProviderRecord);
  }

  return { append, get, listByFixture };
}

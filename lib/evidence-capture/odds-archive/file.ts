/**
 * Durable NDJSON odds archive (Sprint 23B, M3).
 *
 * Append-only on disk: every write is a single `appendFile` of one line — O(1) per
 * append, NEVER a whole-file rewrite. Physically separate from the evidence and
 * provider archives: a distinct `odds-archive/records.ndjson` under the resolved
 * archive directory.
 *
 * FAIL-CLOSED READS (mirrors the corrected M2 adapter):
 *   - ONLY `ENOENT` is an empty archive; every other read errno surfaces.
 *   - ONE torn line (§3.11 interrupted append) is skipped and reported; a SECOND unparseable
 *     line, and any integrity-failed record, still throws (no silent recovery).
 *   - same id + same contentHash duplicate lines collapse; same id + different
 *     contentHash lines fail closed as `immutable_violation`-on-disk — never silently
 *     shadowed by the first match.
 *
 * CONCURRENCY: appends to the SAME path are serialized by an IN-PROCESS per-path
 * mutex (holds promises only — not a record store). This protects concurrent writers
 * within ONE Node process; it does NOT provide multi-process/host safety. Sustained
 * production activation REQUIRES external single-writer / advisory locking + the
 * Postgres cutover gate (risk register R1). NDJSON is an INITIAL adapter only.
 *
 * Server-only.
 */

import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { resolveEvidenceArchiveDir } from "@/lib/archive/evidence/file";
import { logWarn } from "@/lib/monitoring/logger";
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

export function oddsArchivePaths(baseDir?: string) {
  const dir = baseDir ?? path.join(resolveEvidenceArchiveDir(), "odds-archive");
  return { dir, records: path.join(dir, "records.ndjson") };
}

/**
 * Strict whole-archive read of ALL odds records from one NDJSON file (Sprint 23B, M10
 * Stage 2B — extracted from the store closure so archive-state discovery can perform a
 * SINGLE bounded read, PB-1). Fail-closed: ENOENT ⇒ empty; a second malformed
 * line, an integrity-failed record, or a same-id/different-hash conflict THROWS; byte-identical
 * duplicates collapse. Never masked as empty. A single torn line is skipped and reported so one
 * interrupted append cannot brick the archive.
 */
export async function readAllOddsRecordsStrict(
  recordsFile: string
): Promise<OddsArchiveRecord[]> {
  let raw: string;
  try {
    raw = await fs.readFile(recordsFile, "utf8");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException | null)?.code;
    if (code === "ENOENT") return [];
    throw new Error(
      `odds archive: read failed (${code ?? "unknown"}) for ${recordsFile}`,
      { cause: error }
    );
  }
  const byId = new Map<string, OddsArchiveRecord>();
  const order: string[] = [];
  const lines = raw.split("\n");
  /*
   * Exactly ONE unparseable line is tolerated (§3.11 torn-append), mirroring the evidence
   * reader. A SIGKILL mid-`appendFile` can leave one partial line in this permanent append-only
   * file; throwing on it made a single interrupted write brick the archive for every later run.
   * Two or more is corruption of a different kind and still fails closed. An INTEGRITY failure
   * (`verifyOddsRecord`) is never tolerated — a line that parses but does not verify is a
   * tampered or mis-hashed record, not a truncated one.
   */
  let tornLine: number | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      if (tornLine === null) {
        tornLine = i + 1;
        continue;
      }
      throw new Error(
        `odds archive: malformed NDJSON at lines ${tornLine} and ${i + 1} in ${recordsFile} — ` +
          `more than one unparseable line is corruption, not a torn append`
      );
    }
    if (!verifyOddsRecord(parsed)) {
      throw new Error(
        `odds archive: corrupted record at line ${i + 1} in ${recordsFile}`
      );
    }
    const existing = byId.get(parsed.id);
    if (existing) {
      if (existing.contentHash !== parsed.contentHash) {
        throw new Error(
          `odds archive: conflicting duplicate id ${parsed.id} at line ${
            i + 1
          } (immutable_violation on disk) in ${recordsFile}`
        );
      }
      continue;
    }
    byId.set(parsed.id, parsed);
    order.push(parsed.id);
  }
  if (tornLine !== null) {
    logWarn(
      "odds_archive_torn_line",
      { file: recordsFile, line: tornLine, recovered: order.length },
      "archive"
    );
  }
  return order.map((id) => byId.get(id) as OddsArchiveRecord);
}

export function createFileOddsArchive(baseDir?: string): OddsArchiveStore {
  const { dir: ARCHIVE_DIR, records: RECORDS_FILE } = oddsArchivePaths(baseDir);

  async function readAll(): Promise<OddsArchiveRecord[]> {
    return readAllOddsRecordsStrict(RECORDS_FILE);
  }

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
    return serializeAppend(RECORDS_FILE, async () => {
      let existing: OddsArchiveRecord | null;
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
        record: cloneOddsRecord(record),
      };
    });
  }

  async function get(id: string): Promise<OddsArchiveRecord | null> {
    const all = await readAll();
    const found = all.find((r) => r.id === id);
    return found ? cloneOddsRecord(found) : null;
  }

  async function listByCapture(
    captureId: string
  ): Promise<OddsArchiveRecord[]> {
    const all = await readAll();
    return all
      .filter((r) => r.captureId === captureId)
      .sort(compareOddsRecords)
      .map(cloneOddsRecord);
  }

  async function listByFixture(
    fixtureId: number
  ): Promise<OddsArchiveRecord[]> {
    const all = await readAll();
    return all
      .filter((r) => r.fixtureId === fixtureId)
      .sort(compareOddsRecords)
      .map(cloneOddsRecord);
  }

  return { append, get, listByCapture, listByFixture };
}

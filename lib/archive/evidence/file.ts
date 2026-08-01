/**
 * Durable NDJSON evidence archive (Sprint 23).
 *
 * Append-only on disk: every write is an `appendFile` of one line. Nothing in this
 * module opens a file for truncation or rewrite, which is what makes the immutability
 * guarantee structural rather than merely conventional.
 *
 * KNOWN LIMITS (documented, not hidden):
 *   - `appendFile` is not multi-writer transactional. Concurrent appenders can
 *     interleave admission checks and both write. The reader-side integrity check
 *     (`verifyEvidenceChain`) surfaces the resulting sequence conflict rather than
 *     silently trusting it. A single-writer job or a Postgres-backed store is the
 *     eventual fix; this adapter is correct for the current single-writer capture path.
 *   - Reads scan the whole file. Bounded by `EVIDENCE_HISTORY_MAX_LIMIT` on output, not
 *     on input, so this is a linear scan per query and wants an index at scale.
 *   - A read failure is surfaced, never masked as an empty archive. ONLY a missing
 *     file (ENOENT) reads as empty. Every other failure is differentiated and thrown:
 *     malformed content (corruption to investigate, never repaired or guessed at),
 *     permission denied (EACCES/EPERM), I/O failure (EIO/EBUSY/…), or any other error.
 *     The file is never rewritten.
 *
 * Server-only.
 */

import "server-only";
import { promises as fs } from "fs";
import path from "path";
import type { EvidenceSnapshot, ValidationRecord } from "@/types/evidence";
import { clampHistoryLimit } from "./memory";
import { decideSnapshotAppend, decideValidationAppend } from "./rules";
import type {
  EvidenceAppendResult,
  EvidenceArchiveStore,
  EvidenceQueryOptions,
} from "./store";

/**
 * Persistent shared default for deployed environments (Sprint 23B, Phase 1).
 * Matches the existing `/opt/rankwagers/shared` convention (e.g. shared `.env`),
 * so the NDJSON log survives a release swap rather than being orphaned inside a
 * per-release working directory.
 */
const SHARED_DEFAULT_DIR = "/opt/rankwagers/shared/evidence-archive";

/**
 * Resolve the archive base directory. Deterministic; reads env only.
 *
 *   1. `EVIDENCE_ARCHIVE_DIR` (trimmed, non-empty) is authoritative when set.
 *      A whitespace-only value is treated as unset — never an empty path.
 *   2. In production, fall back to the shared default — NEVER release-local.
 *   3. Otherwise (development/test) fall back to the historical
 *      `process.cwd()/data/evidence-archive` so local workflows are unchanged.
 */
export function resolveEvidenceArchiveDir(
  env: NodeJS.ProcessEnv = process.env
): string {
  const configured = env.EVIDENCE_ARCHIVE_DIR?.trim();
  if (configured) return configured;
  if (env.NODE_ENV === "production") return SHARED_DEFAULT_DIR;
  return path.join(process.cwd(), "data", "evidence-archive");
}

export function evidenceArchivePaths(env: NodeJS.ProcessEnv = process.env) {
  const dir = resolveEvidenceArchiveDir(env);
  return {
    dir,
    snapshots: path.join(dir, "snapshots.ndjson"),
    validations: path.join(dir, "validations.ndjson"),
  };
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function readNdjson<T>(file: string): Promise<T[]> {
  let raw: string;
  try {
    raw = await fs.readFile(file, "utf8");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException | null)?.code;
    // ONLY a missing file is an empty archive. Every other read failure is surfaced
    // with an explicit, differentiated cause — never silently treated as "no history"
    // (which would mask real data behind an empty read).
    if (code === "ENOENT") return [];
    if (code === "EACCES" || code === "EPERM") {
      // Permission failure: the archive exists but is unreadable. Do NOT read as empty.
      throw new Error(
        `evidence archive: permission denied (${code}) reading ${file}`,
        { cause: error }
      );
    }
    if (
      code === "EIO" ||
      code === "EBUSY" ||
      code === "ENXIO" ||
      code === "ENODEV"
    ) {
      // I/O failure: the underlying device/handle failed mid-read. Do NOT read as empty.
      throw new Error(`evidence archive: I/O failure (${code}) reading ${file}`, {
        cause: error,
      });
    }
    // Any other failure (e.g. EISDIR, ELOOP, ENAMETOOLONG, unknown): still surfaced,
    // never empty.
    throw new Error(
      `evidence archive: read failed (${code ?? "unknown"}) for ${file}`,
      { cause: error }
    );
  }
  const lines = raw.split("\n");
  const out: T[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    try {
      out.push(JSON.parse(line) as T);
    } catch {
      // A malformed line is corruption to investigate, not something to skip — the
      // file is never rewritten to "fix" it, but the read fails loudly.
      throw new Error(
        `evidence archive: malformed NDJSON at line ${i + 1} in ${file}`
      );
    }
  }
  return out;
}

async function appendLine(
  dir: string,
  file: string,
  value: unknown
): Promise<void> {
  await ensureDir(dir);
  await fs.appendFile(file, `${JSON.stringify(value)}\n`, "utf8");
}

/**
 * Strict whole-archive read of ALL snapshots (Sprint 23B, M10 Stage 2B).
 *
 * A SINGLE bounded read for archive-state discovery (PB-1) — the caller reduces the
 * result in memory rather than looping the per-fixture `listSnapshots` (which would be
 * O(F²)). Reuses the same fail-closed `readNdjson` the store uses: a missing file (ENOENT)
 * reads as empty; a malformed line, permission error, I/O error, or any other errno THROWS
 * and is NEVER masked as an empty archive. Unfiltered/unsorted by design.
 */
export async function readAllSnapshotsStrict(
  env: NodeJS.ProcessEnv = process.env
): Promise<EvidenceSnapshot[]> {
  return readNdjson<EvidenceSnapshot>(evidenceArchivePaths(env).snapshots);
}

/**
 * Strict whole-archive read of ALL validation revisions (Sprint 23B, M10 Stage 2C).
 *
 * The settlement-axis mirror of `readAllSnapshotsStrict`: a SINGLE bounded read for
 * settlement archive-state discovery (PB-1), reducing in memory rather than looping the
 * per-fixture `listValidations` (which would be O(F²)). Reuses the same fail-closed
 * `readNdjson` the store uses — ENOENT reads as empty; malformed line / permission / I/O /
 * any other errno THROWS, never masked as an empty archive. Like the store's own read it
 * does NOT re-verify each record's content hash; same-id/different-hash and ambiguous-
 * revision conflicts are surfaced one layer up by the Stage-2A normalizer's fail-closed
 * `ArchiveStateConflictError`. Unfiltered/unsorted by design.
 */
export async function readAllValidationsStrict(
  env: NodeJS.ProcessEnv = process.env
): Promise<ValidationRecord[]> {
  return readNdjson<ValidationRecord>(evidenceArchivePaths(env).validations);
}

/**
 * Build a durable NDJSON archive store. Paths are resolved once, at creation,
 * from `EVIDENCE_ARCHIVE_DIR` (see `resolveEvidenceArchiveDir`) and captured in
 * this closure — the whole store instance is pinned to one directory.
 */
export function createFileEvidenceArchive(
  env: NodeJS.ProcessEnv = process.env
): EvidenceArchiveStore {
  const {
    dir: ARCHIVE_DIR,
    snapshots: SNAPSHOTS_FILE,
    validations: VALIDATIONS_FILE,
  } = evidenceArchivePaths(env);

  async function snapshotsFor(fixtureId: number): Promise<EvidenceSnapshot[]> {
    const rows = await readNdjson<EvidenceSnapshot>(SNAPSHOTS_FILE);
    return rows
      .filter((row) => row.fixtureId === fixtureId)
      .sort((a, b) => a.sequence - b.sequence);
  }

  async function validationsFor(
    fixtureId: number
  ): Promise<ValidationRecord[]> {
    const rows = await readNdjson<ValidationRecord>(VALIDATIONS_FILE);
    return rows
      .filter((row) => row.fixtureId === fixtureId)
      .sort((a, b) =>
        a.id === b.id ? a.revision - b.revision : a.id.localeCompare(b.id)
      );
  }

  async function appendSnapshot(
    snapshot: EvidenceSnapshot
  ): Promise<EvidenceAppendResult<EvidenceSnapshot>> {
    const existing = await snapshotsFor(snapshot.fixtureId);
    const decision = decideSnapshotAppend(existing, snapshot);
    if (decision.kind === "reject") {
      return { ok: false, code: decision.code, message: decision.message };
    }
    if (decision.kind === "duplicate") {
      return {
        ok: true,
        appended: false,
        duplicate: true,
        record: decision.record,
      };
    }
    try {
      await appendLine(ARCHIVE_DIR, SNAPSHOTS_FILE, snapshot);
    } catch (error) {
      return {
        ok: false,
        code: "write_failed",
        message: error instanceof Error ? error.message : "append failed",
      };
    }
    return { ok: true, appended: true, duplicate: false, record: snapshot };
  }

  async function appendValidation(
    record: ValidationRecord
  ): Promise<EvidenceAppendResult<ValidationRecord>> {
    const [existingValidations, existingSnapshots] = await Promise.all([
      validationsFor(record.fixtureId),
      snapshotsFor(record.fixtureId),
    ]);
    const decision = decideValidationAppend({
      existingValidations,
      existingSnapshots,
      candidate: record,
    });
    if (decision.kind === "reject") {
      return { ok: false, code: decision.code, message: decision.message };
    }
    if (decision.kind === "duplicate") {
      return {
        ok: true,
        appended: false,
        duplicate: true,
        record: decision.record,
      };
    }
    try {
      await appendLine(ARCHIVE_DIR, VALIDATIONS_FILE, record);
    } catch (error) {
      return {
        ok: false,
        code: "write_failed",
        message: error instanceof Error ? error.message : "append failed",
      };
    }
    return { ok: true, appended: true, duplicate: false, record };
  }

  async function listSnapshots(
    fixtureId: number,
    options?: EvidenceQueryOptions
  ): Promise<EvidenceSnapshot[]> {
    const rows = await snapshotsFor(fixtureId);
    return rows.slice(-clampHistoryLimit(options?.limit));
  }

  async function listValidations(
    fixtureId: number,
    options?: EvidenceQueryOptions
  ): Promise<ValidationRecord[]> {
    const rows = await validationsFor(fixtureId);
    return rows.slice(0, clampHistoryLimit(options?.limit));
  }

  async function latestSnapshot(
    fixtureId: number
  ): Promise<EvidenceSnapshot | null> {
    const rows = await snapshotsFor(fixtureId);
    return rows[rows.length - 1] ?? null;
  }

  async function nextSequence(fixtureId: number): Promise<number> {
    const head = await latestSnapshot(fixtureId);
    return (head?.sequence ?? 0) + 1;
  }

  return {
    appendSnapshot,
    appendValidation,
    listSnapshots,
    listValidations,
    latestSnapshot,
    nextSequence,
  };
}

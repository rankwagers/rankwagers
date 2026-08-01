/**
 * M10 Stage 2A — strict archive-state discovery ports + fail-closed error type.
 *
 * These types define the *injected* boundary between the durable NDJSON/Postgres archive
 * and the pure archive-state normalizers (`./normalize`). Stage 2A implements the pure
 * builders (`./builders`) and normalizers only — it does NOT wire a concrete port to the
 * file store, acquire a lock, or invoke anything. The orchestration stage (later) supplies a
 * concrete strict reader backed by the frozen `EvidenceArchiveStore` / `OddsArchiveStore`
 * adapters, inside the durable job lock (spec §7.1 INV-L).
 *
 * STRICT-READ CONTRACT (binding — SC-1 / AR-0, spec §8):
 *   Every `readAll*` method MUST be a strict, fail-closed whole-archive read:
 *     - a missing file (ENOENT) reads as an empty array;
 *     - a malformed line, an integrity/hash conflict, a permission error (EACCES/EPERM),
 *       an I/O error (EIO/EBUSY/…), or any other errno MUST throw — NEVER be masked as an
 *       empty read.
 *   The builders never catch these throws (§builders), so a corrupt/unreadable archive can
 *   never be misreported as "no history / zero candidates" (DR-6). Concrete implementations
 *   reuse the already-strict adapter reads (`lib/archive/evidence/file.ts`,
 *   `lib/evidence-capture/odds-archive/file.ts`), which already behave exactly this way.
 *
 * SINGLE BOUNDED READ (binding — PB-1, spec §7.2):
 *   Each method returns the WHOLE store in one read so the builder classifies in memory,
 *   collapsing the per-fixture O(D·A) ≈ O(F²) NDJSON amplification to O(A). A builder reads
 *   each store it needs at most once per run.
 */

import type { EvidenceSnapshot, ValidationRecord } from "@/types/evidence";
import type { OddsArchiveRecord } from "@/lib/evidence-capture/odds-archive/record";

/** Strict whole-archive read of all evidence snapshots (one bounded read per run). */
export type SnapshotReader = {
  readAllSnapshots(): Promise<readonly EvidenceSnapshot[]>;
};

/** Strict whole-archive read of all odds records (one bounded read per run). */
export type OddsReader = {
  readAllOddsRecords(): Promise<readonly OddsArchiveRecord[]>;
};

/** Strict whole-archive read of all validation revisions (one bounded read per run). */
export type ValidationReader = {
  readAllValidations(): Promise<readonly ValidationRecord[]>;
};

/** Port for capture progress: snapshots + odds. */
export type CaptureArchiveReadPort = SnapshotReader & OddsReader;

/** Port for settlement progress: snapshots + validations. */
export type SettlementArchiveReadPort = SnapshotReader & ValidationReader;

/** Combined port a concrete orchestration reader may implement for both paths. */
export type EvidenceArchiveReadPort = SnapshotReader &
  OddsReader &
  ValidationReader;

/**
 * Thrown by the normalizers when the strictly-read records are internally conflicting —
 * e.g. the same immutable id observed with two different content hashes (an
 * `immutable_violation` already committed to disk), or two revisionIds claiming the same
 * `(validationId, revision)`. This is corruption to surface, NEVER to resolve silently:
 * the normalizer fails closed rather than returning an ambiguous/partial state. The
 * evidence snapshot whole-file read does not itself dedup/verify, so this guard is the
 * fail-closed backstop for that store (the odds adapter already throws on-disk conflicts).
 */
export class ArchiveStateConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArchiveStateConflictError";
  }
}

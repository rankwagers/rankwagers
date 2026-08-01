/**
 * Evidence archive store contract (Sprint 23).
 *
 * Pure types — no I/O, safe to import anywhere.
 *
 * APPEND-ONLY CONTRACT
 * --------------------
 * Implementations MUST honour three rules:
 *   1. An append with an id that already exists AND an identical `contentHash` is a
 *      no-op that reports `duplicate: true`. Retries and replays are therefore safe.
 *   2. An append with an id that already exists but a DIFFERENT `contentHash` is
 *      rejected with `immutable_violation`. This is the rule that makes history
 *      permanent — there is no code path that overwrites a written row.
 *   3. There is no update and no delete. The interface omits them on purpose.
 *
 * This module lives under `lib/archive/evidence/` rather than replacing the existing
 * `lib/archive/*` daily-results archive, which is a different, unrelated dataset.
 */

import type { EvidenceSnapshot, ValidationRecord } from "@/types/evidence";

export type EvidenceAppendErrorCode =
  | "immutable_violation"
  | "sequence_conflict"
  | "revision_conflict"
  | "invalid_record"
  | "write_failed";

export type EvidenceAppendResult<T> =
  | { ok: true; appended: boolean; duplicate: boolean; record: T }
  | { ok: false; code: EvidenceAppendErrorCode; message: string };

export type EvidenceQueryOptions = {
  /** Max rows returned, newest-sequence-last. Implementations clamp to the read cap. */
  limit?: number;
};

export type EvidenceArchiveStore = {
  /** Append a snapshot. Idempotent on (id, contentHash). Never overwrites. */
  appendSnapshot(
    snapshot: EvidenceSnapshot
  ): Promise<EvidenceAppendResult<EvidenceSnapshot>>;

  /** Append a validation revision. Idempotent on (revisionId, contentHash). */
  appendValidation(
    record: ValidationRecord
  ): Promise<EvidenceAppendResult<ValidationRecord>>;

  /** Ascending by `sequence`. Empty array when the fixture has no history. */
  listSnapshots(
    fixtureId: number,
    options?: EvidenceQueryOptions
  ): Promise<EvidenceSnapshot[]>;

  /** Ascending by (`id`, `revision`). Includes superseded revisions. */
  listValidations(
    fixtureId: number,
    options?: EvidenceQueryOptions
  ): Promise<ValidationRecord[]>;

  /** Highest-sequence snapshot for the fixture, or `null`. */
  latestSnapshot(fixtureId: number): Promise<EvidenceSnapshot | null>;

  /** Next sequence to use for the fixture — 1 when there is no history. */
  nextSequence(fixtureId: number): Promise<number>;
};

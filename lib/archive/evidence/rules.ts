/**
 * Append-admission rules for the evidence archive (Sprint 23).
 *
 * Pure decision functions shared by every store implementation. Keeping them here
 * rather than inline in each adapter is what guarantees the in-memory store and the
 * durable store cannot drift on the one thing that matters most: what is allowed to be
 * written, and what must be refused.
 *
 * No I/O, no Node imports.
 */

import type { EvidenceSnapshot, ValidationRecord } from "@/types/evidence";
import type { EvidenceAppendErrorCode } from "./store";

export type AppendDecision<T> =
  | { kind: "append" }
  | { kind: "duplicate"; record: T }
  | { kind: "reject"; code: EvidenceAppendErrorCode; message: string };

/**
 * Decide whether a snapshot may join an existing fixture stream.
 *
 * `existing` must be the full stream for the fixture, ascending by `sequence`.
 */
export function decideSnapshotAppend(
  existing: EvidenceSnapshot[],
  candidate: EvidenceSnapshot
): AppendDecision<EvidenceSnapshot> {
  const byId = existing.find((row) => row.id === candidate.id);
  if (byId) {
    // Idempotent replay: identical bytes are a no-op, not an error.
    if (byId.contentHash === candidate.contentHash) {
      return { kind: "duplicate", record: byId };
    }
    return {
      kind: "reject",
      code: "immutable_violation",
      message: `snapshot ${candidate.id} already exists with a different contentHash`,
    };
  }

  if (existing.some((row) => row.sequence === candidate.sequence)) {
    return {
      kind: "reject",
      code: "sequence_conflict",
      message: `sequence ${candidate.sequence} already used for fixture ${candidate.fixtureId}`,
    };
  }

  const head = existing[existing.length - 1] ?? null;
  const expectedSequence = (head?.sequence ?? 0) + 1;
  if (candidate.sequence !== expectedSequence) {
    return {
      kind: "reject",
      code: "sequence_conflict",
      message: `expected sequence ${expectedSequence}, got ${candidate.sequence}`,
    };
  }
  if (candidate.previousSnapshotId !== (head?.id ?? null)) {
    return {
      kind: "reject",
      code: "sequence_conflict",
      message: `previousSnapshotId must reference ${String(head?.id ?? null)}`,
    };
  }

  return { kind: "append" };
}

/**
 * Decide whether a validation revision may join an existing fixture stream.
 *
 * A validation must reference a snapshot that is already archived — otherwise history
 * would contain a settlement for evidence that was never recorded.
 */
export function decideValidationAppend(input: {
  existingValidations: ValidationRecord[];
  existingSnapshots: EvidenceSnapshot[];
  candidate: ValidationRecord;
}): AppendDecision<ValidationRecord> {
  const { existingValidations, existingSnapshots, candidate } = input;

  const byRevisionId = existingValidations.find(
    (row) => row.revisionId === candidate.revisionId
  );
  if (byRevisionId) {
    if (byRevisionId.contentHash === candidate.contentHash) {
      return { kind: "duplicate", record: byRevisionId };
    }
    return {
      kind: "reject",
      code: "immutable_violation",
      message: `validation revision ${candidate.revisionId} already exists with a different contentHash`,
    };
  }

  if (!existingSnapshots.some((row) => row.id === candidate.snapshotId)) {
    return {
      kind: "reject",
      code: "invalid_record",
      message: `validation references unknown snapshot ${candidate.snapshotId}`,
    };
  }

  const head = existingValidations
    .filter((row) => row.id === candidate.id)
    .reduce<ValidationRecord | null>(
      (max, row) => (!max || row.revision > max.revision ? row : max),
      null
    );

  const expectedRevision = (head?.revision ?? 0) + 1;
  if (candidate.revision !== expectedRevision) {
    return {
      kind: "reject",
      code: "revision_conflict",
      message: `expected revision ${expectedRevision}, got ${candidate.revision}`,
    };
  }
  if (candidate.supersedesRevisionId !== (head?.revisionId ?? null)) {
    return {
      kind: "reject",
      code: "revision_conflict",
      message: `supersedesRevisionId must reference ${String(
        head?.revisionId ?? null
      )}`,
    };
  }

  return { kind: "append" };
}

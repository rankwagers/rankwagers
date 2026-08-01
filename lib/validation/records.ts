/**
 * Immutable validation record construction (Sprint 23).
 *
 * There is no `updateValidationRecord`, by design. A record is written once. When the
 * truth changes — a late settlement correction, a provider fixing a scoreline — you
 * call `reviseValidationRecord`, which mints a NEW row carrying the same logical `id`,
 * an incremented `revision`, and a back-pointer to the row it supersedes. The old row
 * stays on disk exactly as written.
 *
 * Node-only: hashing pulls in `node:crypto`.
 */

import type {
  ValidationReasonCode,
  ValidationRecord,
  ValidationState,
} from "@/types/evidence";
import { VALIDATION_SCHEMA_VERSION } from "@/lib/evidence/constants";
import { evidenceContentHash } from "@/lib/evidence/hash";
import { validationId, validationRevisionId } from "@/lib/evidence/identifiers";
import { isIsoInstant } from "@/lib/evidence/snapshot";
import {
  canTransition,
  defaultReasonCodeFor,
  isCorrectionReasonCode,
  isTerminalValidationState,
  isValidationReasonCode,
  isValidationState,
} from "./states";

export type CreateValidationInput = {
  snapshotId: string;
  fixtureId: number;
  marketKey: string;
  selectionKey: string;
  state: ValidationState;
  reasonCode?: ValidationReasonCode;
  note?: string | null;
  recordedAt: string;
  /** Required for terminal states, must be null for `pending`. */
  settledAt?: string | null;
  recordedBy: string;
};

export type ReviseValidationInput = {
  state: ValidationState;
  /** Must be a correction code — `data_correction` or `settlement_correction`. */
  reasonCode: ValidationReasonCode;
  /** Required: a correction without a stated rationale is not auditable. */
  note: string;
  recordedAt: string;
  settledAt?: string | null;
  recordedBy: string;
};

export type ValidationRecordResult =
  | { ok: true; record: ValidationRecord }
  | { ok: false; errors: string[] };

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  for (const entry of Object.values(value as Record<string, unknown>)) {
    deepFreeze(entry);
  }
  return Object.freeze(value);
}

/** The hashed body — everything except the hash itself. */
export function validationRecordBody(
  record: ValidationRecord
): Record<string, unknown> {
  const { contentHash: _contentHash, ...body } = record;
  return body;
}

function validateSettlementTiming(
  state: ValidationState,
  settledAt: string | null,
  errors: string[]
): void {
  if (isTerminalValidationState(state)) {
    if (settledAt === null) {
      errors.push(`settledAt is required for terminal state "${state}"`);
    } else if (!isIsoInstant(settledAt)) {
      errors.push("settledAt must be an ISO-8601 instant");
    }
    return;
  }
  if (settledAt !== null) {
    errors.push('settledAt must be null while state is "pending"');
  }
}

function assemble(input: {
  id: string;
  revision: number;
  supersedesRevisionId: string | null;
  snapshotId: string;
  fixtureId: number;
  marketKey: string;
  selectionKey: string;
  state: ValidationState;
  reasonCode: ValidationReasonCode;
  note: string | null;
  recordedAt: string;
  settledAt: string | null;
  recordedBy: string;
}): ValidationRecord {
  const body = {
    id: input.id,
    revisionId: validationRevisionId({
      validationId: input.id,
      revision: input.revision,
    }),
    revision: input.revision,
    supersedesRevisionId: input.supersedesRevisionId,
    snapshotId: input.snapshotId,
    fixtureId: input.fixtureId,
    marketKey: input.marketKey,
    selectionKey: input.selectionKey,
    state: input.state,
    reasonCode: input.reasonCode,
    note: input.note,
    recordedAt: new Date(Date.parse(input.recordedAt)).toISOString(),
    settledAt: input.settledAt
      ? new Date(Date.parse(input.settledAt)).toISOString()
      : null,
    recordedBy: input.recordedBy,
    schemaVersion: VALIDATION_SCHEMA_VERSION,
  };
  return deepFreeze({ ...body, contentHash: evidenceContentHash(body) });
}

/** Mint revision 1 of a validation. */
export function createValidationRecord(
  input: CreateValidationInput
): ValidationRecordResult {
  const errors: string[] = [];

  if (!input.snapshotId) errors.push("snapshotId is required");
  if (!Number.isInteger(input.fixtureId) || input.fixtureId <= 0) {
    errors.push("fixtureId must be a positive integer");
  }
  if (!input.marketKey) errors.push("marketKey is required");
  if (!input.selectionKey) errors.push("selectionKey is required");
  if (!input.recordedBy) errors.push("recordedBy is required");
  if (!isValidationState(input.state)) {
    errors.push(`invalid validation state: ${String(input.state)}`);
  }
  if (!isIsoInstant(input.recordedAt)) {
    errors.push("recordedAt must be an ISO-8601 instant");
  }

  const reasonCode = input.reasonCode ?? defaultReasonCodeFor(input.state);
  if (!isValidationReasonCode(reasonCode)) {
    errors.push(`invalid reason code: ${String(reasonCode)}`);
  } else if (isCorrectionReasonCode(reasonCode)) {
    errors.push("revision 1 must not use a correction reason code");
  }

  const settledAt = input.settledAt ?? null;
  if (isValidationState(input.state)) {
    validateSettlementTiming(input.state, settledAt, errors);
  }

  if (errors.length) return { ok: false, errors };

  const id = validationId({
    snapshotId: input.snapshotId,
    marketKey: input.marketKey,
    selectionKey: input.selectionKey,
  });

  return {
    ok: true,
    record: assemble({
      id,
      revision: 1,
      supersedesRevisionId: null,
      snapshotId: input.snapshotId,
      fixtureId: input.fixtureId,
      marketKey: input.marketKey,
      selectionKey: input.selectionKey,
      state: input.state,
      reasonCode,
      note: input.note ?? null,
      recordedAt: input.recordedAt,
      settledAt,
      recordedBy: input.recordedBy,
    }),
  };
}

/**
 * Append a correction.
 *
 * `previous` must be the CURRENT (highest) revision — revising an already-superseded
 * row would fork the chain. The caller gets that row from
 * `currentValidationRevisions` or the archive service.
 */
export function reviseValidationRecord(
  previous: ValidationRecord,
  input: ReviseValidationInput
): ValidationRecordResult {
  const errors: string[] = [];

  if (!isValidationState(input.state)) {
    errors.push(`invalid validation state: ${String(input.state)}`);
  } else if (!canTransition(previous.state, input.state)) {
    errors.push(
      `illegal transition ${previous.state} → ${input.state}`
    );
  }
  if (!isValidationReasonCode(input.reasonCode)) {
    errors.push(`invalid reason code: ${String(input.reasonCode)}`);
  } else if (!isCorrectionReasonCode(input.reasonCode)) {
    errors.push(
      "corrections require reasonCode data_correction or settlement_correction"
    );
  }
  if (!input.note || !input.note.trim()) {
    errors.push("corrections require a non-empty note");
  }
  if (!input.recordedBy) errors.push("recordedBy is required");
  if (!isIsoInstant(input.recordedAt)) {
    errors.push("recordedAt must be an ISO-8601 instant");
  } else if (Date.parse(input.recordedAt) < Date.parse(previous.recordedAt)) {
    errors.push("correction recordedAt precedes the revision it supersedes");
  }

  const settledAt = input.settledAt ?? null;
  if (isValidationState(input.state)) {
    validateSettlementTiming(input.state, settledAt, errors);
  }

  if (errors.length) return { ok: false, errors };

  return {
    ok: true,
    record: assemble({
      id: previous.id,
      revision: previous.revision + 1,
      supersedesRevisionId: previous.revisionId,
      snapshotId: previous.snapshotId,
      fixtureId: previous.fixtureId,
      marketKey: previous.marketKey,
      selectionKey: previous.selectionKey,
      state: input.state,
      reasonCode: input.reasonCode,
      note: input.note,
      recordedAt: input.recordedAt,
      settledAt,
      recordedBy: input.recordedBy,
    }),
  };
}

/**
 * Group revisions by logical validation and pick the highest revision of each.
 *
 * "Current" is derived here rather than stored, which is what lets every written row
 * stay byte-identical forever.
 */
export function currentValidationRevisions(
  records: ValidationRecord[]
): Map<string, ValidationRecord> {
  const current = new Map<string, ValidationRecord>();
  for (const record of records) {
    const existing = current.get(record.id);
    if (!existing || record.revision > existing.revision) {
      current.set(record.id, record);
    }
  }
  return current;
}

/** All revisions of one logical validation, ascending. */
export function revisionsOf(
  records: ValidationRecord[],
  id: string
): ValidationRecord[] {
  return records
    .filter((record) => record.id === id)
    .sort((a, b) => a.revision - b.revision);
}

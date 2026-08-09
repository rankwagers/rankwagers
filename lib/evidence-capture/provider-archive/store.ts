/**
 * Provider archive store contract + admission rule (Sprint 23B, Milestone M2).
 *
 * Append-only, mirroring the frozen evidence store contract:
 *   1. append with an existing id + identical contentHash → duplicate no-op.
 *   2. append with an existing id + different contentHash → immutable_violation.
 *   3. no update, no delete, no overwrite.
 *
 * Pure types + a pure decision function. No I/O.
 */

import type { ProviderArchiveRecord } from "./record";

export type ProviderArchiveAppendErrorCode =
  | "immutable_violation"
  | "invalid_record"
  | "write_failed";

export type ProviderArchiveAppendResult =
  | {
      ok: true;
      appended: boolean;
      duplicate: boolean;
      record: ProviderArchiveRecord;
    }
  | { ok: false; code: ProviderArchiveAppendErrorCode; message: string };

export type ProviderArchiveStore = {
  /** Append a record. Idempotent on (id, contentHash); never overwrites. */
  append(record: ProviderArchiveRecord): Promise<ProviderArchiveAppendResult>;
  /** Fetch by id, or null. Returns a defensive copy. */
  get(id: string): Promise<ProviderArchiveRecord | null>;
  /** All records for a fixture, in deterministic order. Defensive copies. */
  listByFixture(fixtureId: number): Promise<ProviderArchiveRecord[]>;
};

export type ProviderAppendDecision =
  | { kind: "append" }
  | { kind: "duplicate"; record: ProviderArchiveRecord }
  | {
      kind: "reject";
      code: ProviderArchiveAppendErrorCode;
      message: string;
    };

/**
 * Decide whether a candidate may be appended given the existing record (if any) at
 * the same id. Shared by every adapter so memory and file cannot drift.
 */
export function decideProviderAppend(
  existing: ProviderArchiveRecord | null,
  candidate: ProviderArchiveRecord
): ProviderAppendDecision {
  if (!existing) return { kind: "append" };
  if (existing.contentHash === candidate.contentHash) {
    return { kind: "duplicate", record: existing };
  }
  return {
    kind: "reject",
    code: "immutable_violation",
    message: `provider record ${candidate.id} already exists with a different contentHash`,
  };
}

/**
 * Odds archive store contract + admission rule (Sprint 23B, M3).
 *
 * Append-only, identical immutable outcomes to the provider archive (Contract §4.1):
 *   1. new id + valid record → appended.
 *   2. same id + same contentHash → duplicate no-op (original provenance kept).
 *   3. same id + different contentHash → immutable_violation.
 *   4. no update, no delete, no overwrite.
 *
 * Pure types + a pure decision function. No I/O.
 */

import type { OddsArchiveRecord } from "./record";

export type OddsArchiveAppendErrorCode =
  | "immutable_violation"
  | "invalid_record"
  | "write_failed";

export type OddsArchiveAppendResult =
  | { ok: true; appended: boolean; duplicate: boolean; record: OddsArchiveRecord }
  | { ok: false; code: OddsArchiveAppendErrorCode; message: string };

export type OddsArchiveStore = {
  /** Append a record. Idempotent on (id, contentHash); never overwrites. */
  append(record: OddsArchiveRecord): Promise<OddsArchiveAppendResult>;
  /** Fetch by id, or null. Returns a defensive copy. */
  get(id: string): Promise<OddsArchiveRecord | null>;
  /** All records for a capture event, deterministic order. Defensive copies. */
  listByCapture(captureId: string): Promise<OddsArchiveRecord[]>;
  /** All records for a fixture, deterministic order. Defensive copies. */
  listByFixture(fixtureId: number): Promise<OddsArchiveRecord[]>;
};

export type OddsAppendDecision =
  | { kind: "append" }
  | { kind: "duplicate"; record: OddsArchiveRecord }
  | { kind: "reject"; code: OddsArchiveAppendErrorCode; message: string };

export function decideOddsAppend(
  existing: OddsArchiveRecord | null,
  candidate: OddsArchiveRecord
): OddsAppendDecision {
  if (!existing) return { kind: "append" };
  if (existing.contentHash === candidate.contentHash) {
    return { kind: "duplicate", record: existing };
  }
  return {
    kind: "reject",
    code: "immutable_violation",
    message: `odds record ${candidate.id} already exists with a different contentHash`,
  };
}

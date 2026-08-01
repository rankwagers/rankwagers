/**
 * Raw Provider Archive — append-only store contract + admission rule (Sprint 23B).
 *
 * Append-only, immutable, mirroring the frozen evidence/provider store contract:
 *   1. append with an existing id + identical contentHash → duplicate no-op.
 *   2. append with an existing id + different contentHash → immutable_violation.
 *   3. no update, no delete, no overwrite.
 *
 * Because `id` folds in a per-event nonce, distinct capture events (even of byte-identical
 * responses) get distinct ids and are ALL retained — the mission is "capture every response
 * forever." A same-id collision therefore only arises from a replayed/duplicated line, where the
 * duplicate/immutable rule is the fail-closed tamper backstop.
 *
 * Pure types + a pure decision function. No I/O.
 */

import type { RawProviderRecord } from "./record";

export type RawProviderAppendErrorCode =
  | "immutable_violation"
  | "invalid_record"
  | "write_failed";

export type RawProviderAppendResult =
  | { ok: true; appended: boolean; duplicate: boolean; record: RawProviderRecord }
  | { ok: false; code: RawProviderAppendErrorCode; message: string };

export type RawProviderArchiveStore = {
  /** Append a record. Idempotent on (id, contentHash); never overwrites. */
  append(record: RawProviderRecord): Promise<RawProviderAppendResult>;
  /** Fetch by id, or null. Returns a defensive copy. */
  get(id: string): Promise<RawProviderRecord | null>;
  /** All records, deterministic order. Defensive copies. */
  list(): Promise<RawProviderRecord[]>;
  /** All records for a provider, deterministic order. Defensive copies. */
  listByProvider(provider: string): Promise<RawProviderRecord[]>;
};

export type RawProviderAppendDecision =
  | { kind: "append" }
  | { kind: "duplicate"; record: RawProviderRecord }
  | { kind: "reject"; code: RawProviderAppendErrorCode; message: string };

/** Shared admission decision so every adapter behaves identically. */
export function decideRawProviderAppend(
  existing: RawProviderRecord | null,
  candidate: RawProviderRecord
): RawProviderAppendDecision {
  if (!existing) return { kind: "append" };
  if (existing.contentHash === candidate.contentHash) {
    return { kind: "duplicate", record: existing };
  }
  return {
    kind: "reject",
    code: "immutable_violation",
    message: `raw provider record ${candidate.id} already exists with a different contentHash`,
  };
}

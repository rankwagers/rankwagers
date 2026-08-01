/**
 * Deterministic identifiers for evidence and validation rows.
 *
 * All ids are derived from their content coordinates rather than random — the same
 * capture attempted twice mints the same id, which is what makes appends idempotent
 * and replays (Time Machine) reproducible.
 *
 * Node-only: imports `node:crypto` via `hash.ts`.
 */

import { evidenceContentHash } from "./hash";

function digest(parts: Array<string | number>, prefix: string): string {
  const seed = parts.map((part) => String(part)).join("|");
  return `${prefix}_${evidenceContentHash({ seed }).slice(0, 24)}`;
}

/** Grouping key for one fixture's evidence stream. */
export function evidenceAggregateId(fixtureId: number): string {
  return `evidence:fixture:${fixtureId}`;
}

/**
 * Snapshot id. Keyed on fixture + capture instant + sequence so two captures in the
 * same millisecond at different sequences remain distinct.
 */
export function evidenceSnapshotId(input: {
  fixtureId: number;
  capturedAt: string;
  sequence: number;
}): string {
  return digest(
    [input.fixtureId, input.capturedAt, input.sequence],
    "evs"
  );
}

/**
 * Logical validation id — stable across every revision, because it is keyed only on
 * the subject (which snapshot, which market, which selection).
 */
export function validationId(input: {
  snapshotId: string;
  marketKey: string;
  selectionKey: string;
}): string {
  return digest(
    [input.snapshotId, input.marketKey, input.selectionKey],
    "val"
  );
}

/** Revision id — unique per appended row. */
export function validationRevisionId(input: {
  validationId: string;
  revision: number;
}): string {
  return digest([input.validationId, input.revision], "vrev");
}

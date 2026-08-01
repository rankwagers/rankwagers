/**
 * M10 Stage 2A — pure archive-state normalizers.
 *
 * Deterministic reducers that turn strictly-read whole-archive record arrays into the
 * normalized progress state the Stage-1 candidate provider consumes. NO I/O, NO clock
 * (`Date.now`/`Math.random` absent — nothing time-dependent), NO env, NO hidden state,
 * NO identity minting. Pure functions of their record inputs, so output is independent of
 * record/array order (they reduce into Sets/Maps) and byte-stable across re-runs (A2/A4,
 * MC-3).
 *
 * Fail-closed: an internally-conflicting record set (same immutable id, two content
 * hashes; two revisionIds at one `(validationId, revision)`) throws
 * `ArchiveStateConflictError` rather than returning an ambiguous/partial state — the
 * normalizer never "recovers" corruption into empty/guessed progress (SC-4, DR-6).
 *
 * The frozen window-key shape `"<fixtureId>|<capturedAt>"` is used verbatim (identical to
 * `captureWindowKey().key` and `OddsArchiveRecord.captureWindowKey`), so no identity is
 * recomputed here — snapshots and odds are joined on fields they already carry, keeping
 * this module free of the hashing/crypto path.
 */

import type { EvidenceSnapshot, ValidationRecord } from "@/types/evidence";
import type { OddsArchiveRecord } from "@/lib/evidence-capture/odds-archive/record";
import { EVIDENCE_CAPTURE_SOURCE } from "@/lib/evidence-capture/odds-archive";
import type {
  CaptureArchiveState,
  SettlementArchiveState,
  ValidationHead,
} from "../types";
import { ArchiveStateConflictError } from "./types";

/** The frozen capture-window key for a snapshot: `"<fixtureId>|<capturedAt>"`. */
function snapshotWindowKey(snapshot: EvidenceSnapshot): string {
  return `${snapshot.fixtureId}|${snapshot.capturedAt}`;
}

/**
 * Assert that an immutable id is never observed with two different content hashes. A
 * conflict is an on-disk `immutable_violation` — surfaced, never collapsed.
 */
function assertNoHashConflict(
  seen: Map<string, string>,
  id: string,
  contentHash: string,
  label: string
): void {
  const prior = seen.get(id);
  if (prior !== undefined && prior !== contentHash) {
    throw new ArchiveStateConflictError(
      `${label} ${id} appears with conflicting contentHash (immutable_violation on disk)`
    );
  }
  seen.set(id, contentHash);
}

/**
 * Normalize capture progress from all snapshots + all odds records.
 *
 * Window classification (spec §5, migration review §4/§11):
 *   - COMPLETE pair  → snapshot exists AND a mandatory `evidence_capture` odds row exists
 *                      for its window → `capturedWindowKeys` (skip on re-discovery).
 *   - SNAPSHOT-only  → snapshot exists, no mandatory odds row → `partialWindowKeys`
 *                      (re-emit for M6/C5 odds healing — AR-partial, never skip).
 *   - ODDS-only      → mandatory odds row exists with no snapshot → `orphanOddsWindowKeys`
 *                      (descriptive; cannot arise from the frozen path; missing snapshot is
 *                      re-captured idempotently).
 *   - DUPLICATE pair → identical id+hash collapses in the Sets → idempotent no-op.
 *   - CONFLICTING    → same snapshot/odds id, different hash → throws (fail-closed).
 *
 * Pair completeness keys on `source === EVIDENCE_CAPTURE_SOURCE` (the reserved mandatory
 * fallback observation, DoD-5) — a real operator quote alone does not make a window
 * "captured".
 */
export function normalizeCaptureArchiveState(
  snapshots: readonly EvidenceSnapshot[],
  oddsRecords: readonly OddsArchiveRecord[]
): CaptureArchiveState {
  // 1. Windows that have at least one snapshot (fail-closed on conflicting snapshot ids).
  const snapshotHashById = new Map<string, string>();
  const snapshotWindowKeys = new Set<string>();
  for (const snapshot of snapshots) {
    assertNoHashConflict(
      snapshotHashById,
      snapshot.id,
      snapshot.contentHash,
      "snapshot"
    );
    snapshotWindowKeys.add(snapshotWindowKey(snapshot));
  }

  // 2. Windows that have a mandatory odds record (fail-closed on conflicting odds ids).
  const oddsHashById = new Map<string, string>();
  const mandatoryWindowKeys = new Set<string>();
  for (const record of oddsRecords) {
    assertNoHashConflict(oddsHashById, record.id, record.contentHash, "odds record");
    if (record.source === EVIDENCE_CAPTURE_SOURCE) {
      mandatoryWindowKeys.add(record.captureWindowKey);
    }
  }

  // 3. Classify each snapshot window as complete (has mandatory odds) or partial.
  const capturedWindowKeys = new Set<string>();
  const partialWindowKeys = new Set<string>();
  for (const windowKey of snapshotWindowKeys) {
    if (mandatoryWindowKeys.has(windowKey)) capturedWindowKeys.add(windowKey);
    else partialWindowKeys.add(windowKey);
  }

  // 4. Orphan odds: a mandatory-odds window with no snapshot (corruption/partial import).
  const orphanOddsWindowKeys = new Set<string>();
  for (const windowKey of mandatoryWindowKeys) {
    if (!snapshotWindowKeys.has(windowKey)) orphanOddsWindowKeys.add(windowKey);
  }

  return { capturedWindowKeys, partialWindowKeys, orphanOddsWindowKeys };
}

/**
 * Normalize settlement progress from all snapshots + all validation revisions.
 *
 * Distinctions (spec §5.2, migration review §4/§10, MC-1):
 *   - PENDING prediction    → snapshot exists (`capturedFixtureIds`) with no terminal head.
 *   - SETTLED prediction    → the current head is terminal (`state !== "pending"`) →
 *                             `settledFixtureIds`.
 *   - VALIDATION IDENTITY   → each `ValidationHead` exposes `validationId`/`revisionId`.
 *   - DUPLICATE validation  → identical `revisionId`+hash collapses; `MAX(revision)` wins.
 *   - CORRECTION-capable    → `currentValidationHeads` carries the current outcome per
 *                             `(fixture, market)` so a genuine change is detectable.
 *   - CONFLICTING           → same `revisionId` with a different hash, or two revisionIds
 *                             at one `(validationId, revision)` → throws (fail-closed).
 *
 * "Current" = highest `revision` per `validationId` (`ValidationRecord.id`) — there is no
 * stored `isCurrent`/`supersededBy` flag (`types/evidence/validation.ts`); it is derived at
 * read time, exactly as the frozen adapters and integrity checks do.
 */
export function normalizeSettlementArchiveState(
  snapshots: readonly EvidenceSnapshot[],
  validations: readonly ValidationRecord[]
): SettlementArchiveState {
  // 1. Fixtures with at least one captured snapshot (fail-closed on conflicting ids).
  const snapshotHashById = new Map<string, string>();
  const capturedFixtureIds = new Set<number>();
  for (const snapshot of snapshots) {
    assertNoHashConflict(
      snapshotHashById,
      snapshot.id,
      snapshot.contentHash,
      "snapshot"
    );
    capturedFixtureIds.add(snapshot.fixtureId);
  }

  // 2. Resolve the current (MAX-revision) head per validationId, fail-closed on conflicts.
  const revisionHashById = new Map<string, string>(); // revisionId → contentHash
  const revisionIdAt = new Map<string, string>(); // `${id}#${revision}` → revisionId
  const headByValidationId = new Map<string, ValidationRecord>();
  for (const record of validations) {
    // Same revisionId observed with a different hash → on-disk immutable_violation.
    assertNoHashConflict(
      revisionHashById,
      record.revisionId,
      record.contentHash,
      "validation revision"
    );
    // Two distinct revisionIds claiming the same (validationId, revision) → ambiguous head.
    const revisionKey = `${record.id}#${record.revision}`;
    const priorRevisionId = revisionIdAt.get(revisionKey);
    if (priorRevisionId !== undefined && priorRevisionId !== record.revisionId) {
      throw new ArchiveStateConflictError(
        `validation ${record.id} has two revisionIds at revision ${record.revision} (${priorRevisionId} vs ${record.revisionId})`
      );
    }
    revisionIdAt.set(revisionKey, record.revisionId);

    const current = headByValidationId.get(record.id);
    if (current === undefined || record.revision > current.revision) {
      headByValidationId.set(record.id, record);
    }
  }

  // 3. Project current heads → settled fixtures + per-fixture head lists.
  const settledFixtureIds = new Set<number>();
  const headsByFixture = new Map<number, ValidationHead[]>();
  for (const head of headByValidationId.values()) {
    if (head.state !== "pending") settledFixtureIds.add(head.fixtureId);
    const list = headsByFixture.get(head.fixtureId);
    const projected: ValidationHead = {
      validationId: head.id,
      revisionId: head.revisionId,
      revision: head.revision,
      snapshotId: head.snapshotId,
      marketKey: head.marketKey,
      selectionKey: head.selectionKey,
      state: head.state,
    };
    if (list === undefined) headsByFixture.set(head.fixtureId, [projected]);
    else list.push(projected);
  }

  // Deterministic order within a fixture (by validationId) → order-independent output.
  for (const list of headsByFixture.values()) {
    list.sort((a, b) =>
      a.validationId < b.validationId ? -1 : a.validationId > b.validationId ? 1 : 0
    );
  }

  return {
    capturedFixtureIds,
    settledFixtureIds,
    currentValidationHeads: headsByFixture,
  };
}

/**
 * In-memory append-only evidence archive (Sprint 23).
 *
 * The reference implementation of the store contract. Used by tests and as the
 * fallback when no durable archive is configured, so a fixture page never crashes for
 * want of storage — it renders the empty state instead.
 *
 * Admission rules live in `rules.ts` and are shared with the durable adapter.
 * Pure JS structures, no I/O.
 */

import type { EvidenceSnapshot, ValidationRecord } from "@/types/evidence";
import { EVIDENCE_HISTORY_MAX_LIMIT } from "@/lib/evidence/constants";
import { decideSnapshotAppend, decideValidationAppend } from "./rules";
import type {
  EvidenceAppendResult,
  EvidenceArchiveStore,
  EvidenceQueryOptions,
} from "./store";

type FixtureStream = {
  snapshots: EvidenceSnapshot[];
  validations: ValidationRecord[];
};

export function clampHistoryLimit(limit: number | undefined): number {
  if (limit === undefined) return EVIDENCE_HISTORY_MAX_LIMIT;
  if (!Number.isFinite(limit) || limit <= 0) return EVIDENCE_HISTORY_MAX_LIMIT;
  return Math.min(Math.floor(limit), EVIDENCE_HISTORY_MAX_LIMIT);
}

export type MemoryEvidenceArchive = EvidenceArchiveStore & {
  /** Test affordance — drops every stream. Not part of the store contract. */
  reset(): void;
};

export function createMemoryEvidenceArchive(): MemoryEvidenceArchive {
  const streams = new Map<number, FixtureStream>();

  function streamFor(fixtureId: number): FixtureStream {
    let stream = streams.get(fixtureId);
    if (!stream) {
      stream = { snapshots: [], validations: [] };
      streams.set(fixtureId, stream);
    }
    return stream;
  }

  function orderedSnapshots(stream: FixtureStream): EvidenceSnapshot[] {
    return [...stream.snapshots].sort((a, b) => a.sequence - b.sequence);
  }

  async function appendSnapshot(
    snapshot: EvidenceSnapshot
  ): Promise<EvidenceAppendResult<EvidenceSnapshot>> {
    const stream = streamFor(snapshot.fixtureId);
    const decision = decideSnapshotAppend(orderedSnapshots(stream), snapshot);
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
    stream.snapshots.push(snapshot);
    return { ok: true, appended: true, duplicate: false, record: snapshot };
  }

  async function appendValidation(
    record: ValidationRecord
  ): Promise<EvidenceAppendResult<ValidationRecord>> {
    const stream = streamFor(record.fixtureId);
    const decision = decideValidationAppend({
      existingValidations: stream.validations,
      existingSnapshots: stream.snapshots,
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
    stream.validations.push(record);
    return { ok: true, appended: true, duplicate: false, record };
  }

  async function listSnapshots(
    fixtureId: number,
    options?: EvidenceQueryOptions
  ): Promise<EvidenceSnapshot[]> {
    const stream = streams.get(fixtureId);
    if (!stream) return [];
    // Newest kept when truncating — history is read most-recent-first.
    return orderedSnapshots(stream).slice(-clampHistoryLimit(options?.limit));
  }

  async function listValidations(
    fixtureId: number,
    options?: EvidenceQueryOptions
  ): Promise<ValidationRecord[]> {
    const stream = streams.get(fixtureId);
    if (!stream) return [];
    const ordered = [...stream.validations].sort((a, b) =>
      a.id === b.id ? a.revision - b.revision : a.id.localeCompare(b.id)
    );
    return ordered.slice(0, clampHistoryLimit(options?.limit));
  }

  async function latestSnapshot(
    fixtureId: number
  ): Promise<EvidenceSnapshot | null> {
    const stream = streams.get(fixtureId);
    if (!stream || !stream.snapshots.length) return null;
    const ordered = orderedSnapshots(stream);
    return ordered[ordered.length - 1] ?? null;
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
    reset() {
      streams.clear();
    },
  };
}

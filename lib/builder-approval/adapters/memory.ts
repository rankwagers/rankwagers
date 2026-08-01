import type {
  BuilderPublicationCandidate,
  CandidateCreateOutcome,
  CandidateTransitionInput,
  CandidateTransitionOutcome,
} from "../contracts";
import { assertCandidateTransition, transitionMetadataRules } from "../lifecycle";
import { deepFreeze } from "../validation";
import type { CandidateInsert, CandidateListPage, CandidateStore } from "../store";
import type { CandidateListFilters } from "../filters";

/**
 * In-memory candidate store (Sprint 20B-A).
 *
 * Purpose: tests, localhost, and adapter parity so PostgreSQL is never required to run the
 * suite or develop locally.
 *
 * HONEST LIMITATION: this is NOT restart-durable. Every candidate is lost when the process
 * exits, and it is process-local, so it is also wrong under multiple instances. It must
 * always be reported as `durable: false` and surfaced as degraded in deployed
 * environments. Never describe memory-backed candidates as durable.
 *
 * State lives in closure scope, not module scope, so each call to
 * `createMemoryCandidateStore` yields a fully independent store that can be injected.
 */
export function createMemoryCandidateStore(): CandidateStore & {
  __resetForTests(): void;
} {
  const byId = new Map<string, BuilderPublicationCandidate>();
  /** idempotencyKey -> { candidateId, requestFingerprint } */
  const byIdempotencyKey = new Map<
    string,
    { candidateId: string; requestFingerprint: string }
  >();
  /** Insertion order, used only as a stable secondary sort for equal timestamps. */
  const insertionOrder = new Map<string, number>();
  let sequence = 0;

  function snapshotOf(candidate: BuilderPublicationCandidate): BuilderPublicationCandidate {
    // A frozen deep clone: callers cannot mutate the returned value, and even if they
    // could, they would be mutating a copy rather than stored state.
    return deepFreeze(structuredClone(candidate));
  }

  return {
    storageMode: "memory",
    durable: false,

    async createCandidate(insert: CandidateInsert): Promise<CandidateCreateOutcome> {
      const existingKey = byIdempotencyKey.get(insert.idempotencyKey);
      if (existingKey) {
        if (existingKey.requestFingerprint !== insert.requestFingerprint) {
          return {
            ok: false,
            code: "idempotency_conflict",
            existingCandidateId: existingKey.candidateId,
          };
        }
        const existing = byId.get(existingKey.candidateId);
        if (existing) {
          return { ok: true, candidate: snapshotOf(existing), deduplicated: true };
        }
        // Index/record divergence should be impossible; fail loudly rather than silently
        // creating a second candidate under a key that already reported success.
        return {
          ok: false,
          code: "storage_failed",
          message: "idempotency index references a missing candidate",
        };
      }

      const stored: BuilderPublicationCandidate = deepFreeze(
        structuredClone({
          schemaVersion: insert.schemaVersion,
          candidateId: insert.candidateId,
          status: insert.status,
          actor: insert.actor,
          createdAt: insert.createdAt,
          sourceRequestId: insert.sourceRequestId,
          sourceSnapshotId: insert.sourceSnapshotId,
          sourceDate: insert.sourceDate,
          sourceBuilderConfig: insert.sourceBuilderConfig,
          payload: insert.payload,
          payloadChecksum: insert.payloadChecksum,
          checksumVersion: insert.checksumVersion,
          storageMode: "memory" as const,
          // Lifecycle block. Version starts at 1; audit fields stay null until the first
          // transition, so nothing fabricates a historical actor or timestamp.
          version: 1,
          statusChangedAt: null,
          statusActor: null,
          rejectionReason: null,
          convertedAccaId: null,
        }),
      );

      byId.set(stored.candidateId, stored);
      byIdempotencyKey.set(insert.idempotencyKey, {
        candidateId: stored.candidateId,
        requestFingerprint: insert.requestFingerprint,
      });
      insertionOrder.set(stored.candidateId, ++sequence);

      return { ok: true, candidate: snapshotOf(stored), deduplicated: false };
    },

    async getCandidate(candidateId: string): Promise<BuilderPublicationCandidate | null> {
      const found = byId.get(candidateId);
      return found ? snapshotOf(found) : null;
    },

    async listCandidates(filters: CandidateListFilters): Promise<CandidateListPage> {
      const matched = [...byId.values()].filter((c) => {
        if (filters.candidateId && c.candidateId !== filters.candidateId) return false;
        if (filters.sourceRequestId && c.sourceRequestId !== filters.sourceRequestId) return false;
        if (filters.sourceSnapshotId && c.sourceSnapshotId !== filters.sourceSnapshotId) return false;
        if (filters.sourceDate && c.sourceDate !== filters.sourceDate) return false;
        if (filters.status && c.status !== filters.status) return false;
        return true;
      });

      // Newest-first, with a stable secondary key so ordering is fully deterministic even
      // when several candidates share a createdAt millisecond.
      matched.sort((a, b) => {
        if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
        const seqA = insertionOrder.get(a.candidateId) ?? 0;
        const seqB = insertionOrder.get(b.candidateId) ?? 0;
        if (seqA !== seqB) return seqB - seqA;
        return a.candidateId < b.candidateId ? 1 : -1;
      });

      const page = matched.slice(filters.offset, filters.offset + filters.limit);
      return {
        rows: page.map(snapshotOf),
        total: matched.length,
        limit: filters.limit,
        offset: filters.offset,
      };
    },

    /**
     * Guarded lifecycle transition (the ONLY mutation).
     *
     * Atomicity note: from the `byId.get` precondition check through the `byId.set` there is
     * NO `await`. JavaScript's single-threaded execution therefore makes this check-and-set
     * indivisible with respect to other concurrent callers, which is why exactly one caller
     * holding a given version can win. This is a different mechanism from PostgreSQL's
     * conditional UPDATE and proves nothing about it.
     */
    async transitionCandidateStatus(
      input: CandidateTransitionInput,
    ): Promise<CandidateTransitionOutcome> {
      const current = byId.get(input.candidateId);
      if (!current) return { ok: false, code: "candidate_not_found" };

      if (current.status !== input.expectedStatus) {
        return {
          ok: false,
          code: "status_conflict",
          currentStatus: current.status,
          currentVersion: current.version,
        };
      }
      if (current.version !== input.expectedVersion) {
        return {
          ok: false,
          code: "version_conflict",
          currentStatus: current.status,
          currentVersion: current.version,
        };
      }

      const legality = assertCandidateTransition(current.status, input.nextStatus);
      if (!legality.ok) {
        return legality.code === "unknown_status"
          ? { ok: false, code: "unknown_status" }
          : {
              ok: false,
              code: "invalid_transition",
              from: legality.from,
              to: legality.to,
            };
      }

      const rules = transitionMetadataRules(input.nextStatus);
      const reason = rules.acceptsReason ? (input.reason ?? null) : null;
      const convertedAccaId = rules.acceptsConvertedAccaId
        ? (input.convertedAccaId ?? null)
        : null;

      // Every business field is carried across unchanged; only the lifecycle block moves.
      const next: BuilderPublicationCandidate = deepFreeze(
        structuredClone({
          ...current,
          status: input.nextStatus,
          version: current.version + 1,
          statusChangedAt: input.transitionedAt,
          statusActor: input.actor,
          rejectionReason: reason,
          convertedAccaId,
        }),
      );

      byId.set(next.candidateId, next);
      return { ok: true, candidate: snapshotOf(next) };
    },

    __resetForTests(): void {
      byId.clear();
      byIdempotencyKey.clear();
      insertionOrder.clear();
      sequence = 0;
    },
  };
}

import type { CandidateStore } from "@/lib/builder-approval/store";
import { deepFreeze } from "@/lib/builder-approval/validation";
import type { AccaRecord } from "../contracts";
import type { AccaListFilters } from "../filters";
import { assertAccaTransition } from "../lifecycle";
import type {
  AccaCreateOutcome,
  AccaDraftInsert,
  AccaListPage,
  AccaStore,
  AccaTransitionInput,
  AccaTransitionOutcome,
  CandidateConversionPrecondition,
} from "../store";

/**
 * In-memory Acca store (Sprint 20B-B, stage B2).
 *
 * Purpose: tests, localhost and adapter parity, so PostgreSQL is never required to run the
 * suite.
 *
 * HONEST LIMITATION: NOT restart-durable and process-local. Always reported as
 * `durable: false`. Nothing here proves anything about PostgreSQL.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ATOMICITY MECHANISM (memory only) — read this before changing the create path
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The create path spans an `await` (the candidate conversion), so single-threaded execution
 * is NOT sufficient on its own and is not claimed. Four mechanisms combine instead:
 *
 *  1. PER-KEY CRITICAL SECTION. Every mutation runs inside `runExclusive(key, ...)`, an async
 *     mutex keyed by `candidate:<id>` for creation and `acca:<id>` for lifecycle transitions.
 *     Two creations for the same candidate are therefore strictly serialized, even though each
 *     suspends internally. Unrelated keys still run concurrently.
 *
 *  2. INVISIBLE STAGING. The draft is built and its slug reserved, but it is NOT placed in any
 *     lookup map until the transaction commits. No reader can observe an Acca whose candidate
 *     is still APPROVED, because the record simply is not reachable yet.
 *
 *  3. THE CANDIDATE CONVERSION IS THE COMMIT POINT. It is the last fallible step. Publishing
 *     the staged record afterwards is a sequence of `Map.set` calls with no `await` and no
 *     failure mode. Anything that goes wrong does so BEFORE the commit point, where rollback
 *     is just "discard the staged record and release the slug reservation" — the candidate has
 *     not been touched at all, so its status, version, statusChangedAt, statusActor,
 *     rejectionReason, convertedAccaId and business payload are unchanged by construction
 *     rather than by a compensating write that could itself be buggy.
 *
 *  4. FORWARD RECOVERY ON AN AMBIGUOUS CONVERSION. If the conversion call *throws*, the store
 *     cannot know whether the write landed. It re-reads the candidate: if the candidate is
 *     CONVERTED and points at this exact Acca id, the commit did happen and the store
 *     completes forward by publishing. Otherwise nothing was committed and the staged record
 *     is discarded. This is why "candidate CONVERTED with no Acca" is unreachable without
 *     needing a backward write that the guarded, forward-only candidate lifecycle would not
 *     permit anyway.
 *
 * The one place a partial state could be *observed* is between the commit point and the
 * publish. In the unmodified path those two statements are adjacent with no suspension point.
 * A test may inject `faults.afterCandidateConversion` to force a suspension there; the store
 * treats a fault raised at that boundary as POST-COMMIT — it cannot un-commit a committed
 * transaction, so it completes the publication and reports success rather than reporting a
 * failure over consistent, committed state.
 */

/**
 * Async mutex keyed by an arbitrary string.
 *
 * Callers queue behind the previous holder of the same key and are released in arrival order.
 * A key's chain is dropped once nobody is waiting on it, so a long-lived store does not
 * accumulate one entry per candidate ever seen.
 */
function createKeyedMutex(): <T>(key: string, fn: () => Promise<T>) => Promise<T> {
  const tails = new Map<string, Promise<void>>();

  return function runExclusive<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const previous = tails.get(key) ?? Promise.resolve();
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const chained = previous.then(() => held);
    tails.set(key, chained);

    return previous.then(fn).finally(() => {
      release();
      if (tails.get(key) === chained) tails.delete(key);
    });
  };
}

/**
 * Fault injection points, in execution order.
 *
 * TEST-ONLY and dependency-injected at construction. They are never exposed as methods on the
 * returned store, so no production caller can reach them, and when `faults` is omitted the
 * create path contains no hook call at all.
 */
export type MemoryAccaFaultHooks = {
  /** [1] Before anything is staged. */
  beforeAccaInsertion?: () => void | Promise<void>;
  /** [2] After the draft is staged and its slug reserved, still invisible. */
  afterTentativeAccaInsertion?: () => void | Promise<void>;
  /** [3] Immediately before the commit point. Same boundary as "before final commit". */
  beforeCandidateConversion?: () => void | Promise<void>;
  /** [4] After the commit point, before publication. Post-commit: cannot un-commit. */
  afterCandidateConversion?: () => void | Promise<void>;
  /** [5] After publication. Post-commit. */
  afterTransactionCommit?: () => void | Promise<void>;
};

export type MemoryAccaStoreDeps = {
  candidateStore: CandidateStore;
  faults?: MemoryAccaFaultHooks;
};

export type MemoryAccaStore = AccaStore & { __resetForTests(): void };

export function createMemoryAccaStore(deps: MemoryAccaStoreDeps): MemoryAccaStore {
  const byId = new Map<string, AccaRecord>();
  const bySlug = new Map<string, string>(); // slug -> accaId
  const byCandidate = new Map<string, string>(); // candidateId -> accaId
  /** Slugs claimed by an in-flight transaction that has not committed or aborted yet. */
  const reservedSlugs = new Set<string>();

  const runExclusive = createKeyedMutex();
  const faults = deps.faults ?? {};

  const snapshotOf = (acca: AccaRecord): AccaRecord => deepFreeze(structuredClone(acca));

  /** Commit a staged record into the visible maps. Synchronous and infallible. */
  function publish(record: AccaRecord): void {
    byId.set(record.accaId, record);
    bySlug.set(record.slug, record.accaId);
    byCandidate.set(record.sourceCandidateId, record.accaId);
  }

  return {
    storageMode: "memory",
    durable: false,

    async createDraftFromCandidate(
      insert: AccaDraftInsert,
      candidate: CandidateConversionPrecondition,
    ): Promise<AccaCreateOutcome> {
      // Mechanism 1. Everything below is serialized per candidate.
      return runExclusive(`candidate:${candidate.candidateId}`, async () => {
        if (faults.beforeAccaInsertion) await faults.beforeAccaInsertion();

        // One candidate, at most one Acca. Inside this candidate's critical section no
        // competing creation for the same candidate can be between its check and its commit.
        const existingForCandidate = byCandidate.get(candidate.candidateId);
        if (existingForCandidate) {
          return {
            ok: false as const,
            code: "acca_already_exists_for_candidate" as const,
            existingAccaId: existingForCandidate,
          };
        }

        // One slug, globally. Different candidates run under different keys and are therefore
        // genuinely concurrent, so this check-and-reserve pair must be — and is — a single
        // synchronous step with no `await` between the read and the write.
        if (bySlug.has(insert.slug) || reservedSlugs.has(insert.slug)) {
          return { ok: false as const, code: "slug_conflict" as const, slug: insert.slug };
        }
        reservedSlugs.add(insert.slug);

        try {
          // Mechanism 2. Staged, frozen, and unreachable from every lookup map.
          const staged: AccaRecord = deepFreeze(
            structuredClone({
              schemaVersion: insert.schemaVersion,
              accaId: insert.accaId,
              sourceCandidateId: insert.sourceCandidateId,
              status: insert.status,
              title: insert.title,
              summary: insert.summary,
              locale: insert.locale,
              legs: insert.legs,
              combinedOdds: insert.combinedOdds,
              evidenceSnapshot: insert.evidenceSnapshot,
              qualificationSnapshot: insert.qualificationSnapshot,
              sourceReferences: insert.sourceReferences,
              slug: insert.slug,
              version: insert.version,
              createdAt: insert.createdAt,
              updatedAt: insert.updatedAt,
              publishedAt: null,
              archivedAt: null,
              createdBy: insert.createdBy,
              publishedBy: null,
              archivedBy: null,
            }),
          );

          if (faults.afterTentativeAccaInsertion) await faults.afterTentativeAccaInsertion();
          if (faults.beforeCandidateConversion) await faults.beforeCandidateConversion();

          /* ---------------- COMMIT POINT (mechanism 3) ---------------- */
          let conversion: Awaited<
            ReturnType<CandidateStore["transitionCandidateStatus"]>
          >;
          try {
            conversion = await deps.candidateStore.transitionCandidateStatus({
              candidateId: candidate.candidateId,
              expectedStatus: candidate.expectedStatus,
              expectedVersion: candidate.expectedVersion,
              nextStatus: "CONVERTED",
              actor: candidate.actor,
              convertedAccaId: insert.accaId,
              transitionedAt: candidate.transitionedAt,
            });
          } catch {
            // Mechanism 4. The write may or may not have landed; ask the candidate store.
            const after = await deps.candidateStore.getCandidate(candidate.candidateId);
            if (
              after &&
              after.status === "CONVERTED" &&
              after.convertedAccaId === insert.accaId
            ) {
              publish(staged);
              return { ok: true as const, acca: snapshotOf(staged) };
            }
            return {
              ok: false as const,
              code: "storage_failed" as const,
              message: "candidate_conversion_failed",
            };
          }

          if (!conversion.ok) return translateConversionFailure(conversion);

          // Post-commit from here on. A fault raised at this boundary cannot un-commit the
          // candidate conversion, so it must not prevent publication and must not be turned
          // into a reported failure over state that is in fact consistent and committed.
          if (faults.afterCandidateConversion) {
            try {
              await faults.afterCandidateConversion();
            } catch {
              /* post-commit fault: recorded by the injector, never fatal here */
            }
          }

          publish(staged);

          if (faults.afterTransactionCommit) {
            try {
              await faults.afterTransactionCommit();
            } catch {
              /* post-commit fault */
            }
          }

          return { ok: true as const, acca: snapshotOf(staged) };
        } finally {
          // Committed slugs live in `bySlug`; the reservation is only ever a transaction lock.
          reservedSlugs.delete(insert.slug);
        }
      });
    },

    async getAccaById(accaId) {
      const found = byId.get(accaId);
      return found ? snapshotOf(found) : null;
    },

    async getAccaBySlug(slug) {
      const id = bySlug.get(slug);
      if (!id) return null;
      const found = byId.get(id);
      return found ? snapshotOf(found) : null;
    },

    async listAccas(filters: AccaListFilters): Promise<AccaListPage> {
      const matched = [...byId.values()].filter((a) => {
        if (filters.status && a.status !== filters.status) return false;
        if (filters.locale && a.locale !== filters.locale) return false;
        if (filters.sourceCandidateId && a.sourceCandidateId !== filters.sourceCandidateId) {
          return false;
        }
        if (filters.createdAfter && a.createdAt < filters.createdAfter) return false;
        if (filters.createdBefore && a.createdAt > filters.createdBefore) return false;
        if (filters.publishedAfter && (!a.publishedAt || a.publishedAt < filters.publishedAfter)) {
          return false;
        }
        if (
          filters.publishedBefore &&
          (!a.publishedAt || a.publishedAt > filters.publishedBefore)
        ) {
          return false;
        }
        return true;
      });

      // createdAt DESC, acca_id DESC — byte-for-byte the same ordering the PostgreSQL adapter
      // hard-codes, so paging is deterministic and identical across both adapters even when
      // several Accas share a creation timestamp.
      matched.sort((a, b) => {
        if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
        return a.accaId < b.accaId ? 1 : -1;
      });

      const page = matched.slice(filters.offset, filters.offset + filters.limit);
      return {
        rows: page.map(snapshotOf),
        total: matched.length,
        limit: filters.limit,
        offset: filters.offset,
      };
    },

    async transitionAccaStatus(input: AccaTransitionInput): Promise<AccaTransitionOutcome> {
      return runExclusive(`acca:${input.accaId}`, async () => {
        const current = byId.get(input.accaId);
        if (!current) return { ok: false as const, code: "acca_not_found" as const };
        if (current.status !== input.expectedStatus) {
          return {
            ok: false as const,
            code: "status_conflict" as const,
            currentStatus: current.status,
            currentVersion: current.version,
          };
        }
        if (current.version !== input.expectedVersion) {
          return {
            ok: false as const,
            code: "version_conflict" as const,
            currentStatus: current.status,
            currentVersion: current.version,
          };
        }

        const legality = assertAccaTransition(current.status, input.nextStatus);
        if (!legality.ok) {
          return legality.code === "unknown_status"
            ? { ok: false as const, code: "unknown_status" as const }
            : {
                ok: false as const,
                code: "invalid_transition" as const,
                from: legality.from,
                to: legality.to,
              };
        }

        // Only the lifecycle block moves. Every immutable snapshot field is carried across
        // untouched, and previously recorded publication metadata survives archiving.
        const next: AccaRecord = deepFreeze(
          structuredClone({
            ...current,
            status: input.nextStatus,
            version: current.version + 1,
            updatedAt: input.transitionedAt,
            publishedAt:
              input.nextStatus === "PUBLISHED" ? input.transitionedAt : current.publishedAt,
            archivedAt:
              input.nextStatus === "ARCHIVED" ? input.transitionedAt : current.archivedAt,
            publishedBy: input.nextStatus === "PUBLISHED" ? input.actor : current.publishedBy,
            archivedBy: input.nextStatus === "ARCHIVED" ? input.actor : current.archivedBy,
          }),
        );

        byId.set(next.accaId, next);
        return { ok: true as const, acca: snapshotOf(next) };
      });
    },

    __resetForTests(): void {
      byId.clear();
      bySlug.clear();
      byCandidate.clear();
      reservedSlugs.clear();
    },
  };
}

/**
 * Translate a candidate lifecycle failure into an Acca-create failure.
 *
 * A candidate that is already CONVERTED is reported as such rather than as a bare status
 * conflict: it is a materially different operational situation — someone already published
 * from this candidate — and an operator needs to be told which.
 */
function translateConversionFailure(
  result: Extract<
    Awaited<ReturnType<CandidateStore["transitionCandidateStatus"]>>,
    { ok: false }
  >,
): AccaCreateOutcome {
  switch (result.code) {
    case "candidate_not_found":
      return { ok: false, code: "candidate_not_found" };
    case "status_conflict":
      return result.currentStatus === "CONVERTED"
        ? { ok: false, code: "candidate_already_converted", existingAccaId: null }
        : {
            ok: false,
            code: "candidate_status_conflict",
            currentStatus: result.currentStatus,
            currentVersion: result.currentVersion,
          };
    case "version_conflict":
      return {
        ok: false,
        code: "candidate_version_conflict",
        currentStatus: result.currentStatus,
        currentVersion: result.currentVersion,
      };
    case "storage_failed":
      return { ok: false, code: "storage_failed", message: result.message };
    default:
      // invalid_transition, unknown_status, invalid_metadata. None are reachable with a
      // well-formed precondition, so they are reported as a storage failure carrying the
      // originating code rather than being silently swallowed.
      return { ok: false, code: "storage_failed", message: result.code };
  }
}

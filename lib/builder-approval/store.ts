import type {
  BuilderCandidateActor,
  BuilderCandidateStatus,
  BuilderPublicationCandidate,
  CandidateCreateOutcome,
  CandidateStorageMode,
  CandidateTransitionInput,
  CandidateTransitionOutcome,
  JsonObject,
} from "./contracts";
import type { CandidateListFilters } from "./filters";
import { resolveCandidateAdapter, resolveCandidateConnectionString } from "./environment";
import { createMemoryCandidateStore } from "./adapters/memory";
import { createPostgresCandidateStore } from "./adapters/postgres";

/**
 * Narrow store contract.
 *
 * INVARIANT (revised deliberately in Sprint 20B-B, replacing the Sprint 20B-A
 * "no state transition" wording):
 *
 *     No arbitrary update or delete operation exists.
 *     The only candidate mutation is a guarded lifecycle transition.
 *     Candidate business payload remains immutable.
 *
 * There is still no `updateCandidate`, `patchCandidate`, `setCandidate`, `saveCandidate` or
 * `deleteCandidate`. The single mutation, `transitionCandidateStatus`, may touch only the
 * lifecycle block (status, version, status timestamps/actor, rejection reason, converted
 * Acca id) and is guarded by an expected-status AND expected-version precondition.
 */

export type CandidateInsert = {
  schemaVersion: string;
  candidateId: string;
  status: BuilderCandidateStatus;
  actor: BuilderCandidateActor;
  createdAt: string;
  sourceRequestId: string | null;
  sourceSnapshotId: string | null;
  sourceDate: string | null;
  sourceBuilderConfig: JsonObject;
  payload: JsonObject;
  payloadChecksum: string;
  checksumVersion: string;
  idempotencyKey: string;
  requestFingerprint: string;
};

export type CandidateListPage = {
  rows: BuilderPublicationCandidate[];
  total: number;
  limit: number;
  offset: number;
};

export type CandidateStore = {
  readonly storageMode: CandidateStorageMode;
  /** False for memory. Never report memory as durable. */
  readonly durable: boolean;
  createCandidate(insert: CandidateInsert): Promise<CandidateCreateOutcome>;
  getCandidate(candidateId: string): Promise<BuilderPublicationCandidate | null>;
  listCandidates(filters: CandidateListFilters): Promise<CandidateListPage>;
  /**
   * The ONLY mutation. Guarded by candidateId + expectedStatus + expectedVersion, so under
   * concurrency at most one caller holding a given version can win. Adapters must apply the
   * precondition atomically; they must never read-then-write across an await boundary.
   */
  transitionCandidateStatus(
    input: CandidateTransitionInput,
  ): Promise<CandidateTransitionOutcome>;
};

/**
 * Process-local singleton. A singleton is the established repository convention
 * (`lib/snapshots/store.ts`), so it is kept here for parity, but it is isolated to this
 * file and every consumer accepts an injected store, so nothing is forced to use it.
 * Its limitation is explicit: in memory mode the singleton IS the entire database.
 */
let store: CandidateStore | null = null;

function createDefaultStore(): CandidateStore {
  const resolution = resolveCandidateAdapter();
  if (resolution.mode === "postgres") {
    const url = resolveCandidateConnectionString();
    if (url) return createPostgresCandidateStore(url);
  }
  return createMemoryCandidateStore();
}

export function getCandidateStore(): CandidateStore {
  if (!store) store = createDefaultStore();
  return store;
}

/** Dependency injection for tests and for callers that supply their own adapter. */
export function setCandidateStore(next: CandidateStore): void {
  store = next;
}

/** Test-only: replace the singleton with a fresh, empty memory store. */
export function resetCandidateStoreForTests(): void {
  store = createMemoryCandidateStore();
}

/** Drop the pin so the next access re-resolves from the environment. */
export function clearCandidateStore(): void {
  store = null;
}

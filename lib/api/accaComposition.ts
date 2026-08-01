import type { CandidateStore } from "@/lib/builder-approval/store";
import { getCandidateStore } from "@/lib/builder-approval/store";
import { createMemoryAccaStore } from "@/lib/acca-publication/adapters/memory";
import { createPostgresAccaStore } from "@/lib/acca-publication/adapters/postgres";
import { createAccaService, type AccaService } from "@/lib/acca-publication/service";
import type { AccaStore } from "@/lib/acca-publication/store";

/**
 * Composition layer for the admin Acca API (Sprint 20B-B, stage B3).
 *
 * Exactly one of each dependency exists per process:
 *
 *   candidate store  the Builder Approval singleton (`getCandidateStore`) — NOT a second one
 *   Acca store       resolved once here, from configuration
 *   Acca service     built once, over both stores
 *
 * Routes never construct a store. That is what stops two handlers from silently talking to two
 * different memory adapters, which would look like data loss rather than a wiring bug.
 */

/**
 * A CandidateStore facade that resolves the singleton ON EVERY CALL.
 *
 * The Acca memory adapter captures its `candidateStore` at construction. If the raw singleton
 * were captured, `resetCandidateStoreForTests()` would swap the singleton while the Acca store
 * kept writing to the discarded one — the two would silently disagree. Delegating per call
 * means there is always exactly one candidate store, whichever one is currently installed, and
 * it requires no change to the frozen B2 adapter.
 */
const liveCandidateStore: CandidateStore = {
  get storageMode() {
    return getCandidateStore().storageMode;
  },
  get durable() {
    return getCandidateStore().durable;
  },
  createCandidate: (insert) => getCandidateStore().createCandidate(insert),
  getCandidate: (candidateId) => getCandidateStore().getCandidate(candidateId),
  listCandidates: (filters) => getCandidateStore().listCandidates(filters),
  transitionCandidateStatus: (input) => getCandidateStore().transitionCandidateStatus(input),
};

/**
 * Connection string resolution, mirroring `lib/builder-approval/environment.ts`: a dedicated
 * variable wins, then the Builder Approval one (the two domains share a database), then the
 * generic one. Read at call time so tests and deployments behave the same way.
 */
function resolveAccaConnectionString(env: NodeJS.ProcessEnv = process.env): string | null {
  const candidates = [
    env.ACCA_PUBLICATION_DATABASE_URL,
    env.BUILDER_APPROVAL_DATABASE_URL,
    env.DATABASE_URL,
  ];
  for (const value of candidates) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

let accaStore: AccaStore | null = null;
let accaService: AccaService | null = null;

function createDefaultAccaStore(): AccaStore {
  const url = resolveAccaConnectionString();
  if (url) return createPostgresAccaStore(url);
  return createMemoryAccaStore({ candidateStore: liveCandidateStore });
}

export function getAccaStore(): AccaStore {
  if (!accaStore) accaStore = createDefaultAccaStore();
  return accaStore;
}

export function getAccaService(): AccaService {
  if (!accaService) {
    accaService = createAccaService({
      accaStore: getAccaStore(),
      candidateStore: liveCandidateStore,
    });
  }
  return accaService;
}

export function describeAccaStorage(): {
  mode: "memory" | "postgres";
  durable: boolean;
  degradedNotice: string | null;
} {
  const store = getAccaStore();
  return {
    mode: store.storageMode,
    durable: store.durable,
    degradedNotice: store.durable
      ? null
      : "Accas are held in memory only and are lost on restart. Not suitable for production.",
  };
}

/**
 * Dependency injection for tests. This is a test seam, not a production backdoor: nothing in
 * `app/` calls it, and there is no environment variable or request header that can reach it.
 */
export function setAccaStoreForTests(next: AccaStore | null): void {
  accaStore = next;
  accaService = null;
}

/** Drop both pins so the next access re-resolves from configuration. */
export function resetAccaCompositionForTests(): void {
  accaStore = null;
  accaService = null;
}

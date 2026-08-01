import type {
  AccaActor,
  AccaEvidenceSnapshot,
  AccaLeg,
  AccaListPage,
  AccaQualificationSnapshot,
  AccaRecord,
  AccaSourceReferences,
  AccaStatus,
} from "./contracts";
import type { BuilderCandidateStatus } from "@/lib/builder-approval/contracts";
import type { AccaListFilters } from "./filters";

/**
 * Acca store contract (Sprint 20B-B, stage B2).
 *
 * INVARIANT, mirroring the Builder Approval store:
 *
 *     No arbitrary update or delete operation exists.
 *     The only Acca mutation is a guarded lifecycle transition.
 *     The Acca business snapshot remains immutable.
 *
 * There is no `updateAcca`, `patchAcca`, `saveAcca`, `setAcca`, `deleteAcca`, and no
 * per-action `publishAcca` / `archiveAcca` convenience mutator — publication and archiving
 * both go through the single guarded `transitionAccaStatus`.
 *
 * PUBLIC VISIBILITY IS NOT A STORE CONCERN. `getAccaBySlug` and `listAccas` return domain
 * records in whatever status they hold, including DRAFT and ARCHIVED, because trusted admin
 * callers legitimately need them. Public surfaces (stage B5) MUST filter through the central
 * `isPubliclyVisible` rule in `lifecycle.ts`. No public route exists yet; this note exists so
 * a later stage cannot mistake "the store returned it" for "the public may see it".
 */

/** Fully-formed draft row, built by the mapper and never by a caller. */
export type AccaDraftInsert = {
  schemaVersion: string;
  accaId: string;
  sourceCandidateId: string;
  status: Extract<AccaStatus, "DRAFT">;
  title: string;
  summary: string | null;
  locale: string;
  legs: AccaLeg[];
  combinedOdds: number;
  evidenceSnapshot: AccaEvidenceSnapshot;
  qualificationSnapshot: AccaQualificationSnapshot;
  sourceReferences: AccaSourceReferences;
  slug: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  createdBy: AccaActor;
};

/**
 * Optimistic precondition applied to the SOURCE CANDIDATE inside the same atomic unit as
 * the Acca insert. Both must hold or neither side commits.
 */
export type CandidateConversionPrecondition = {
  candidateId: string;
  expectedStatus: Extract<BuilderCandidateStatus, "APPROVED">;
  expectedVersion: number;
  actor: AccaActor;
  transitionedAt: string;
};

export type AccaCreateOutcome =
  | { ok: true; acca: AccaRecord }
  | { ok: false; code: "candidate_not_found" }
  | {
      ok: false;
      code: "candidate_status_conflict";
      currentStatus: BuilderCandidateStatus;
      currentVersion: number;
    }
  | {
      ok: false;
      code: "candidate_version_conflict";
      currentStatus: BuilderCandidateStatus;
      currentVersion: number;
    }
  | { ok: false; code: "candidate_already_converted"; existingAccaId: string | null }
  | { ok: false; code: "acca_already_exists_for_candidate"; existingAccaId: string }
  | { ok: false; code: "slug_conflict"; slug: string }
  | { ok: false; code: "storage_failed"; message: string };

export type AccaTransitionInput = {
  accaId: string;
  expectedStatus: AccaStatus;
  expectedVersion: number;
  nextStatus: AccaStatus;
  actor: AccaActor;
  transitionedAt: string;
};

export type AccaTransitionOutcome =
  | { ok: true; acca: AccaRecord }
  | { ok: false; code: "acca_not_found" }
  | { ok: false; code: "status_conflict"; currentStatus: AccaStatus; currentVersion: number }
  | { ok: false; code: "version_conflict"; currentStatus: AccaStatus; currentVersion: number }
  | { ok: false; code: "invalid_transition"; from: AccaStatus; to: AccaStatus }
  | { ok: false; code: "unknown_status" }
  | { ok: false; code: "storage_failed"; message: string };

export type AccaStore = {
  readonly storageMode: "memory" | "postgres";
  /** False for memory. Never report memory as durable. */
  readonly durable: boolean;

  /**
   * Atomically: insert the Acca draft AND transition the source candidate
   * APPROVED -> CONVERTED with `convertedAccaId` set. All or nothing.
   */
  createDraftFromCandidate(
    insert: AccaDraftInsert,
    candidate: CandidateConversionPrecondition,
  ): Promise<AccaCreateOutcome>;

  getAccaById(accaId: string): Promise<AccaRecord | null>;
  /** May return DRAFT or ARCHIVED records. Public filtering is a B5 concern. */
  getAccaBySlug(slug: string): Promise<AccaRecord | null>;
  listAccas(filters: AccaListFilters): Promise<AccaListPage>;

  /** The ONLY Acca mutation. Guarded by id + expectedStatus + expectedVersion. */
  transitionAccaStatus(input: AccaTransitionInput): Promise<AccaTransitionOutcome>;
};

/* Re-exported here so adapters import one module for the whole contract. */
export type { AccaListFilters, AccaListPage };

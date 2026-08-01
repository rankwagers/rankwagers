/**
 * Builder publication candidate contracts (Sprint 20B-A).
 *
 * Scope: a durable, server-owned, DRAFT-only artifact holding an immutable copy of a
 * Builder combination that an admin explicitly chose to save. This sprint deliberately
 * implements NO approval, rejection, publication or public visibility — those arrive in
 * Sprint 20B-B. There is no status transition anywhere in this module.
 *
 * This module is isolated from Builder scoring and generation: it never recomputes
 * predictions, confidence, scores or eligibility. It only copies, validates and stores.
 */

export const CANDIDATE_SCHEMA_VERSION = "20b-a.1.0.0";

export const SUPPORTED_CANDIDATE_SCHEMA_VERSIONS: readonly string[] = [
  CANDIDATE_SCHEMA_VERSION,
];

/**
 * Candidate lifecycle vocabulary.
 *
 * Sprint 20B-A shipped `DRAFT` only. Sprint 20B-B widens this deliberately (Decision 2),
 * keeping the existing uppercase vocabulary and treating `DRAFT` as the equivalent of
 * "pending" so no persisted row is renamed and no parallel lowercase vocabulary exists.
 *
 * Legal transitions live in `lifecycle.ts` and are enforced there, in the store, and by the
 * database CHECK constraint (widened by db/migrations/20260727_widen_candidate_status.sql).
 */
export type BuilderCandidateStatus = "DRAFT" | "APPROVED" | "REJECTED" | "CONVERTED";

export const BUILDER_CANDIDATE_STATUSES: readonly BuilderCandidateStatus[] = [
  "DRAFT",
  "APPROVED",
  "REJECTED",
  "CONVERTED",
];

/** Every candidate is created in this state. Only `lifecycle.ts` may move it onwards. */
export const CANDIDATE_INITIAL_STATUS: BuilderCandidateStatus = "DRAFT";

/** Bound for the optional operator note recorded on a rejection. */
export const CANDIDATE_NOTE_MAX_LENGTH = 500;

/**
 * Coarse-grained actor. Sprint 20B-A has no named operator accounts — admin auth is a
 * single shared secret (`lib/security/adminAuth.ts`), so the only honest attribution is
 * "an admin". Named operator identity is deferred to Sprint 20B-B or a later auth sprint.
 * Never present this as individual attribution.
 */
export type BuilderCandidateActor = "admin";

export const BUILDER_CANDIDATE_ACTOR: BuilderCandidateActor = "admin";

/** Which adapter served a candidate. `memory` is NOT restart-durable. */
export type CandidateStorageMode = "memory" | "postgres";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

/** Markets the Builder may select from daily published lists (mirrors AccaBuilderMarketKey). */
export const CANDIDATE_MARKET_KEYS: readonly string[] = ["over15", "over25", "fh", "sh"];

/**
 * Payload kinds accepted in Sprint 20B-A.
 * Only a single explicitly chosen combination is accepted; whole-generation candidates
 * are deliberately out of scope for the narrowest honest implementation.
 */
export type CandidatePayloadKind = "builder_combination";

export const CANDIDATE_PAYLOAD_KINDS: readonly CandidatePayloadKind[] = [
  "builder_combination",
];

/**
 * Bounds enforced at the input boundary. These intentionally mirror the Builder's own
 * limits (min 2 / max 8 legs, max 3 combinations) but are declared locally so this module
 * stays isolated from Builder generation and can be validated independently.
 */
export const CANDIDATE_LIMITS = {
  maxPayloadBytes: 131_072,
  minLegs: 2,
  maxLegs: 8,
  maxDepth: 14,
  maxStringLength: 2_000,
  maxArrayLength: 200,
  maxObjectKeys: 120,
  maxIdempotencyKeyLength: 200,
  minIdempotencyKeyLength: 8,
} as const;

/** List bounds. */
export const CANDIDATE_LIST_DEFAULT_LIMIT = 25;
export const CANDIDATE_LIST_MAX_LIMIT = 100;

/**
 * A stored candidate.
 *
 * IMMUTABILITY CONTRACT (Sprint 20B-B):
 * Everything below is write-once EXCEPT the lifecycle block at the end. A lifecycle
 * transition may change only `status`, `statusChangedAt`, `statusActor`, `rejectionReason`,
 * `convertedAccaId` and `version`. It may never touch `payload`, `payloadChecksum`,
 * `sourceBuilderConfig`, any `source*` identifier, `createdAt`, `actor` or `schemaVersion`.
 */
export type BuilderPublicationCandidate = {
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
  storageMode: CandidateStorageMode;

  /* ---- lifecycle block: the ONLY mutable fields ---- */
  /** Optimistic concurrency counter. Starts at 1, incremented by each transition. */
  version: number;
  /** Null until the first lifecycle transition. */
  statusChangedAt: string | null;
  /** Actor that performed the most recent transition. Coarse-grained, like `actor`. */
  statusActor: BuilderCandidateActor | null;
  /** Bounded, sanitized operator note. Only meaningful for REJECTED. */
  rejectionReason: string | null;
  /** Set when the candidate is CONVERTED. Populated by Sprint 20B-B stage B3. */
  convertedAccaId: string | null;
};

/** Input to the single guarded lifecycle transition. No other mutation exists. */
export type CandidateTransitionInput = {
  candidateId: string;
  /** Optimistic precondition: the caller's view of the current status. */
  expectedStatus: BuilderCandidateStatus;
  /** Optimistic precondition: the caller's view of the current version. */
  expectedVersion: number;
  nextStatus: BuilderCandidateStatus;
  actor: BuilderCandidateActor;
  /** Sanitized operator note; only accepted for a rejection. */
  reason?: string | null;
  /** Only accepted when transitioning to CONVERTED. */
  convertedAccaId?: string | null;
  transitionedAt: string;
};

/**
 * Typed transition outcomes.
 *
 * `status_conflict` and `version_conflict` are distinguished so an operator (and stage B3)
 * can tell "someone else already moved this candidate" from "your view of it is stale",
 * which are different operational situations even though both mean "retry with fresh state".
 */
export type CandidateTransitionOutcome =
  | { ok: true; candidate: BuilderPublicationCandidate }
  | { ok: false; code: "candidate_not_found" }
  | {
      ok: false;
      code: "status_conflict";
      currentStatus: BuilderCandidateStatus;
      currentVersion: number;
    }
  | {
      ok: false;
      code: "version_conflict";
      currentStatus: BuilderCandidateStatus;
      currentVersion: number;
    }
  | {
      ok: false;
      code: "invalid_transition";
      from: BuilderCandidateStatus;
      to: BuilderCandidateStatus;
    }
  | { ok: false; code: "unknown_status" }
  | { ok: false; code: "invalid_metadata"; detail: string }
  | { ok: false; code: "storage_failed"; message: string };

/**
 * Presence of an optional request field, as supplied by the caller.
 *
 * These three states are NEVER collapsed. An omitted property, an explicitly supplied
 * `null`, and a supplied value are distinct inputs and therefore distinct requests for
 * idempotency purposes. Empty and whitespace-only strings are rejected outright rather than
 * normalized into either of the other two states.
 */
export type FieldPresence = "omitted" | "null" | "value";

export type OptionalPresenceMap = {
  sourceRequestId: FieldPresence;
  sourceSnapshotId: FieldPresence;
  sourceDate: FieldPresence;
};

/** Validated creation input. Produced only by `validation.ts`. */
export type CandidateCreateInput = {
  schemaVersion: string;
  sourceRequestId: string | null;
  sourceSnapshotId: string | null;
  sourceDate: string | null;
  /**
   * Caller-supplied presence for each optional field. Storage cannot represent the
   * omitted/null distinction (both persist as SQL NULL), so presence is carried here and
   * folded into the idempotency fingerprint, where the distinction must survive.
   */
  optionalPresence: OptionalPresenceMap;
  sourceBuilderConfig: JsonObject;
  payload: JsonObject;
};

export type CandidateCreateOutcome =
  | { ok: true; candidate: BuilderPublicationCandidate; deduplicated: boolean }
  | { ok: false; code: "idempotency_conflict"; existingCandidateId: string }
  | { ok: false; code: "storage_failed"; message: string };

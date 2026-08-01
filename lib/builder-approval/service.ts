import "server-only";
import {
  BUILDER_CANDIDATE_ACTOR,
  type BuilderCandidateStatus,
  type BuilderPublicationCandidate,
  type CandidateTransitionOutcome,
} from "./contracts";
import { computeCandidateChecksum, computeRequestFingerprint } from "./checksum";
import {
  assertCandidateTransition,
  isBuilderCandidateStatus,
  sanitizeOperatorNote,
  transitionMetadataRules,
} from "./lifecycle";
import { isCandidateId, mintCandidateId } from "./identifiers";
import {
  validateCandidateRequest,
  validateIdempotencyKey,
  type ValidationIssue,
} from "./validation";
import { getCandidateStore, type CandidateListPage, type CandidateStore } from "./store";
import { defaultCandidateListFilters, type CandidateListFilters } from "./filters";
import { resolveCandidateAdapter } from "./environment";

/**
 * Candidate creation orchestration (Sprint 20B-A).
 *
 * Creates a DRAFT artefact and nothing else. There is no approval, rejection, publication,
 * scheduling or transition anywhere in this module, and no code path that writes any status
 * other than DRAFT.
 *
 * This module never recomputes predictions, confidence, Builder scores, eligibility or
 * odds. It copies an already-computed Builder combination, validates its shape, checksums
 * it and stores it.
 */

export type CreateCandidateResult =
  | { ok: true; candidate: BuilderPublicationCandidate; deduplicated: boolean }
  | { ok: false; kind: "validation"; issues: ValidationIssue[] }
  | { ok: false; kind: "idempotency_conflict"; existingCandidateId: string }
  | { ok: false; kind: "storage_failed"; message: string };

export async function createBuilderCandidate(input: {
  body: unknown;
  idempotencyKey: unknown;
  store?: CandidateStore;
  now?: number;
}): Promise<CreateCandidateResult> {
  const key = validateIdempotencyKey(input.idempotencyKey);
  if (!key.ok) return { ok: false, kind: "validation", issues: key.issues };

  const validated = validateCandidateRequest(input.body);
  if (!validated.ok) return { ok: false, kind: "validation", issues: validated.issues };

  const checksum = computeCandidateChecksum({
    schemaVersion: validated.value.schemaVersion,
    payload: validated.value.payload,
  });
  if (!checksum.ok) {
    return {
      ok: false,
      kind: "validation",
      issues: [
        {
          path: checksum.error.path,
          code: checksum.error.reason,
          message: "payload could not be checksummed",
        },
      ],
    };
  }

  const fingerprint = computeRequestFingerprint({
    schemaVersion: validated.value.schemaVersion,
    sourceRequestId: validated.value.sourceRequestId,
    sourceSnapshotId: validated.value.sourceSnapshotId,
    sourceDate: validated.value.sourceDate,
    // Presence is folded in so omitted and explicit-null never share a fingerprint.
    optionalPresence: validated.value.optionalPresence,
    sourceBuilderConfig: validated.value.sourceBuilderConfig,
    payload: validated.value.payload,
  });
  if (!fingerprint.ok) {
    return {
      ok: false,
      kind: "validation",
      issues: [
        {
          path: fingerprint.error.path,
          code: fingerprint.error.reason,
          message: "request could not be fingerprinted",
        },
      ],
    };
  }

  const store = input.store ?? getCandidateStore();
  const createdAt = new Date(input.now ?? Date.now()).toISOString();

  const outcome = await store.createCandidate({
    schemaVersion: validated.value.schemaVersion,
    candidateId: mintCandidateId(),
    status: "DRAFT",
    actor: BUILDER_CANDIDATE_ACTOR,
    createdAt,
    sourceRequestId: validated.value.sourceRequestId,
    sourceSnapshotId: validated.value.sourceSnapshotId,
    sourceDate: validated.value.sourceDate,
    sourceBuilderConfig: validated.value.sourceBuilderConfig,
    payload: validated.value.payload,
    payloadChecksum: checksum.checksum,
    checksumVersion: checksum.checksumVersion,
    idempotencyKey: key.value,
    requestFingerprint: fingerprint.checksum,
  });

  if (outcome.ok) {
    return { ok: true, candidate: outcome.candidate, deduplicated: outcome.deduplicated };
  }
  if (outcome.code === "idempotency_conflict") {
    return {
      ok: false,
      kind: "idempotency_conflict",
      existingCandidateId: outcome.existingCandidateId,
    };
  }
  return { ok: false, kind: "storage_failed", message: outcome.message };
}

/* ------------------------------------------------------------------ *
 * Guarded lifecycle transition (Sprint 20B-B, stage B1)
 * ------------------------------------------------------------------ */

export type TransitionCandidateResult =
  | { ok: true; candidate: BuilderPublicationCandidate }
  | { ok: false; kind: "validation"; issues: ValidationIssue[] }
  | { ok: false; kind: "conflict"; outcome: CandidateTransitionOutcome };

/**
 * The only candidate mutation exposed by the service.
 *
 * Validates input, sanitizes the bounded operator note, enforces the metadata rules and the
 * transition table, then delegates to the single guarded store operation. It never touches
 * candidate business data.
 *
 * Deliberately NOT here: idempotency keys, CSRF, rate limiting and HTTP semantics. Those are
 * stage B3 concerns. Lifecycle same-state transitions remain invalid; operation-level retry
 * handling belongs to the B3 idempotency contract.
 */
export async function transitionBuilderCandidate(input: {
  candidateId: unknown;
  expectedStatus: unknown;
  expectedVersion: unknown;
  nextStatus: unknown;
  reason?: unknown;
  convertedAccaId?: unknown;
  store?: CandidateStore;
  now?: number;
}): Promise<TransitionCandidateResult> {
  const issues: ValidationIssue[] = [];

  if (!isCandidateId(input.candidateId)) {
    issues.push({
      path: "candidateId",
      code: "invalid_candidate_id",
      message: "candidateId must be a minted candidate identifier",
    });
  }
  if (!isBuilderCandidateStatus(input.expectedStatus)) {
    issues.push({
      path: "expectedStatus",
      code: "unknown_status",
      message: "expectedStatus must be a known candidate status",
    });
  }
  if (!isBuilderCandidateStatus(input.nextStatus)) {
    issues.push({
      path: "nextStatus",
      code: "unknown_status",
      message: "nextStatus must be a known candidate status",
    });
  }
  if (
    typeof input.expectedVersion !== "number" ||
    !Number.isInteger(input.expectedVersion) ||
    input.expectedVersion < 1
  ) {
    issues.push({
      path: "expectedVersion",
      code: "invalid_version",
      message: "expectedVersion must be a positive integer",
    });
  }

  const note = sanitizeOperatorNote(input.reason);
  if (!note.ok) {
    issues.push({
      path: "reason",
      code: note.code,
      message: "operator note is not acceptable",
    });
  }

  if (issues.length) return { ok: false, kind: "validation", issues };

  const nextStatus = input.nextStatus as BuilderCandidateStatus;
  const rules = transitionMetadataRules(nextStatus);

  // Metadata may not ride a transition that does not accept it.
  if (!rules.acceptsReason && note.ok && note.value !== null) {
    return {
      ok: false,
      kind: "conflict",
      outcome: {
        ok: false,
        code: "invalid_metadata",
        detail: "a reason may only accompany a rejection",
      },
    };
  }
  if (
    !rules.acceptsConvertedAccaId &&
    input.convertedAccaId !== undefined &&
    input.convertedAccaId !== null
  ) {
    return {
      ok: false,
      kind: "conflict",
      outcome: {
        ok: false,
        code: "invalid_metadata",
        detail: "convertedAccaId may only accompany a conversion",
      },
    };
  }
  if (
    input.convertedAccaId !== undefined &&
    input.convertedAccaId !== null &&
    typeof input.convertedAccaId !== "string"
  ) {
    return {
      ok: false,
      kind: "conflict",
      outcome: { ok: false, code: "invalid_metadata", detail: "convertedAccaId must be a string" },
    };
  }

  const legality = assertCandidateTransition(input.expectedStatus, nextStatus);
  if (!legality.ok) {
    return {
      ok: false,
      kind: "conflict",
      outcome:
        legality.code === "unknown_status"
          ? { ok: false, code: "unknown_status" }
          : { ok: false, code: "invalid_transition", from: legality.from, to: legality.to },
    };
  }

  const store = input.store ?? getCandidateStore();
  const outcome = await store.transitionCandidateStatus({
    candidateId: input.candidateId as string,
    expectedStatus: input.expectedStatus as BuilderCandidateStatus,
    expectedVersion: input.expectedVersion as number,
    nextStatus,
    actor: BUILDER_CANDIDATE_ACTOR,
    reason: note.ok ? note.value : null,
    convertedAccaId: (input.convertedAccaId as string | null | undefined) ?? null,
    transitionedAt: new Date(input.now ?? Date.now()).toISOString(),
  });

  return outcome.ok
    ? { ok: true, candidate: outcome.candidate }
    : { ok: false, kind: "conflict", outcome };
}

export async function getBuilderCandidate(
  candidateId: string,
  store?: CandidateStore,
): Promise<BuilderPublicationCandidate | null> {
  return (store ?? getCandidateStore()).getCandidate(candidateId);
}

export async function listBuilderCandidates(
  filters: Partial<CandidateListFilters> = {},
  store?: CandidateStore,
): Promise<CandidateListPage> {
  return (store ?? getCandidateStore()).listCandidates({
    ...defaultCandidateListFilters(),
    ...filters,
  });
}

export type CandidateSummary = {
  candidateId: string;
  status: string;
  actor: string;
  createdAt: string;
  schemaVersion: string;
  sourceRequestId: string | null;
  sourceSnapshotId: string | null;
  sourceDate: string | null;
  payloadChecksum: string;
  checksumVersion: string;
  storageMode: string;
  combinationId: string | null;
  legCount: number | null;
};

/**
 * Metadata-only view for lists and creation responses. Deliberately excludes the payload so
 * list responses stay small and no large artefact is echoed back on write.
 */
export function summarizeCandidate(
  candidate: BuilderPublicationCandidate,
): CandidateSummary {
  const combination = candidate.payload?.combination;
  const asObject =
    combination && typeof combination === "object" && !Array.isArray(combination)
      ? (combination as Record<string, unknown>)
      : null;
  const legs = asObject?.legs;
  return {
    candidateId: candidate.candidateId,
    status: candidate.status,
    actor: candidate.actor,
    createdAt: candidate.createdAt,
    schemaVersion: candidate.schemaVersion,
    sourceRequestId: candidate.sourceRequestId,
    sourceSnapshotId: candidate.sourceSnapshotId,
    sourceDate: candidate.sourceDate,
    payloadChecksum: candidate.payloadChecksum,
    checksumVersion: candidate.checksumVersion,
    storageMode: candidate.storageMode,
    combinationId: typeof asObject?.id === "string" ? asObject.id : null,
    legCount: Array.isArray(legs) ? legs.length : null,
  };
}

export type CandidateStorageReport = {
  mode: string;
  durable: boolean;
  reason: string;
  /** Human-facing warning, present only when storage is non-durable. */
  degradedNotice: string | null;
};

/** Honest storage description for health output and admin UI. */
export function describeCandidateStorage(
  env: NodeJS.ProcessEnv = process.env,
): CandidateStorageReport {
  const resolution = resolveCandidateAdapter(env);
  return {
    mode: resolution.mode,
    durable: resolution.durable,
    reason: resolution.reason,
    degradedNotice: resolution.durable
      ? null
      : "Candidates are held in process memory and are lost on restart. Not durable.",
  };
}

import type { NextRequest } from "next/server";
import { logInfo, logWarn } from "@/lib/monitoring/logger";
import { isCandidateId } from "@/lib/builder-approval/identifiers";
import { CANDIDATE_NOTE_MAX_LENGTH } from "@/lib/builder-approval/contracts";
import { transitionBuilderCandidate } from "@/lib/builder-approval/service";
import {
  guardAdminRequest,
  readAdminJsonBody,
  readExpectedVersion,
  rejectUnexpectedKeys,
} from "./adminGuard";
import { apiError, replayableResponse, safeConflictExtras } from "./responses";
import {
  fingerprintRequest,
  validateIdempotencyKey,
  withHttpIdempotency,
  type StoredHttpResponse,
} from "./httpIdempotency";

/**
 * Shared handler for the two candidate lifecycle mutations (Sprint 20B-B, stage B3).
 *
 * Approve and reject differ only in target status and in whether an operator note is required.
 * Everything security-relevant — the guard pipeline, key rejection, expectedVersion, HTTP
 * idempotency, conflict mapping — is identical, so it lives in ONE place. Two near-copies would
 * eventually drift, and the copy that drifted would be the one missing a check.
 *
 * The client never supplies status, actor or timestamps. This handler derives all three.
 */

/** Approve accepts only these keys. Anything else is rejected, not ignored. */
export const APPROVE_ALLOWED_KEYS = ["expectedVersion"] as const;
/** Reject additionally requires a bounded operator note. */
export const REJECT_ALLOWED_KEYS = ["expectedVersion", "rejectionReason"] as const;

type TransitionConfig = {
  action: "candidate.approve" | "candidate.reject";
  nextStatus: "APPROVED" | "REJECTED";
  expectedStatus: "DRAFT";
  allowedKeys: readonly string[];
  requiresReason: boolean;
};

export const APPROVE_CONFIG: TransitionConfig = {
  action: "candidate.approve",
  nextStatus: "APPROVED",
  expectedStatus: "DRAFT",
  allowedKeys: APPROVE_ALLOWED_KEYS,
  requiresReason: false,
};

export const REJECT_CONFIG: TransitionConfig = {
  action: "candidate.reject",
  nextStatus: "REJECTED",
  expectedStatus: "DRAFT",
  allowedKeys: REJECT_ALLOWED_KEYS,
  requiresReason: true,
};

/** Map a B1 store conflict to an HTTP status. Total over the outcome union. */
function conflictStatus(code: string): number {
  switch (code) {
    case "candidate_not_found":
      return 404;
    case "status_conflict":
    case "version_conflict":
    case "invalid_transition":
      return 409;
    case "unknown_status":
    case "invalid_metadata":
      return 400;
    default:
      return 500;
  }
}

export async function handleCandidateTransition(
  req: NextRequest,
  candidateIdParam: string,
  config: TransitionConfig,
): Promise<Response> {
  const guard = guardAdminRequest({ req, family: "candidate_lifecycle", requireCsrf: true });
  if (!guard.ok) return guard.response;
  const { requestId, actorId } = guard;

  // Malformed ids get the same 404 as a genuine miss, so the response never distinguishes
  // "bad shape" from "does not exist".
  if (!isCandidateId(candidateIdParam)) {
    return apiError("candidate_not_found", 404, requestId);
  }

  const parsed = await readAdminJsonBody(req, requestId);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;

  const unexpected = rejectUnexpectedKeys(body, config.allowedKeys);
  if (!unexpected.ok) {
    return apiError("invalid_request", 400, requestId, {
      field: unexpected.key,
      detail: unexpected.reason,
    });
  }

  const version = readExpectedVersion(body);
  if (!version.ok) {
    return apiError("invalid_request", 400, requestId, {
      field: "expectedVersion",
      detail: "required_positive_integer",
    });
  }

  // The operator note is validated here so a blank or oversized reason is a 400 rather than
  // reaching the domain layer as an ambiguous metadata failure.
  let rejectionReason: string | undefined;
  if (config.requiresReason) {
    const raw = body.rejectionReason;
    if (typeof raw !== "string") {
      return apiError("invalid_request", 400, requestId, {
        field: "rejectionReason",
        detail: "required_string",
      });
    }
    const trimmed = raw.trim();
    if (trimmed === "") {
      return apiError("invalid_request", 400, requestId, {
        field: "rejectionReason",
        detail: "empty",
      });
    }
    if (trimmed.length > CANDIDATE_NOTE_MAX_LENGTH) {
      return apiError("invalid_request", 400, requestId, {
        field: "rejectionReason",
        detail: "too_long",
      });
    }
    rejectionReason = trimmed;
  }

  const keyCheck = validateIdempotencyKey(req.headers.get("idempotency-key"));
  if (!keyCheck.ok) {
    return apiError("idempotency_key_required", 400, requestId, {
      field: "Idempotency-Key",
      detail: keyCheck.reason,
    });
  }

  const outcome = await withHttpIdempotency({
    key: keyCheck.key,
    scope: { actorId, action: config.action, targetId: candidateIdParam },
    fingerprint: fingerprintRequest(body),
    execute: async (): Promise<StoredHttpResponse> => {
      const result = await transitionBuilderCandidate({
        candidateId: candidateIdParam,
        expectedStatus: config.expectedStatus,
        expectedVersion: version.value,
        nextStatus: config.nextStatus,
        // Server-derived. Never read from the request.
        reason: rejectionReason,
      });

      if (result.ok) {
        logInfo("acca_admin_candidate_transitioned", {
          requestId,
          candidateId: result.candidate.candidateId,
          nextStatus: config.nextStatus,
          version: String(result.candidate.version),
        });
        return {
          status: 200,
          body: {
            ok: true,
            requestId,
            candidate: {
              candidateId: result.candidate.candidateId,
              status: result.candidate.status,
              version: result.candidate.version,
              statusChangedAt: result.candidate.statusChangedAt,
              statusActor: result.candidate.statusActor,
              rejectionReason: result.candidate.rejectionReason,
              convertedAccaId: result.candidate.convertedAccaId,
            },
          },
        };
      }

      if (result.kind === "validation") {
        logWarn("acca_admin_candidate_rejected", {
          requestId,
          // Codes and paths only. Never values.
          issues: result.issues.map((i) => `${i.path}:${i.code}`).join("|").slice(0, 300),
        });
        return {
          status: 400,
          body: { ok: false, error: "invalid_request", requestId },
        };
      }

      const failure = result.outcome as { ok: false } & Record<string, unknown>;
      const code = String(failure.code);
      const status = conflictStatus(code);
      if (status >= 500) logWarn("acca_admin_candidate_storage_failed", { requestId });
      return {
        status,
        body: {
          ok: false,
          // `storage_failed` never carries its driver message outward.
          error: status >= 500 ? "storage_failed" : code,
          requestId,
          ...(status >= 500
            ? {}
            : safeConflictExtras({
                code,
                currentStatus: failure.currentStatus as string | undefined,
                currentVersion: failure.currentVersion as number | undefined,
              })),
        },
      };
    },
  });

  if (outcome.kind === "conflict") {
    return apiError("idempotency_conflict", 409, requestId, {
      detail: "key_reused_with_different_payload",
    });
  }

  return replayableResponse(outcome.response, requestId, outcome.kind === "replayed");
}

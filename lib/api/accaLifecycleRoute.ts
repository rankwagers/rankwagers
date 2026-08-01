import type { NextRequest } from "next/server";
import { logInfo, logWarn } from "@/lib/monitoring/logger";
import type { AccaStatus } from "@/lib/acca-publication/contracts";
import { isAccaId } from "@/lib/acca-publication/identifiers";
import { getAccaService } from "./accaComposition";
import { summarizeAcca } from "./accaPresentation";
import { guardAdminRequest, readAdminJsonBody, readExpectedVersion, rejectUnexpectedKeys } from "./adminGuard";
import { ACCA_SERVICE_HTTP_STATUS, apiError, replayableResponse, safeConflictExtras } from "./responses";
import {
  fingerprintRequest,
  validateIdempotencyKey,
  withHttpIdempotency,
  type StoredHttpResponse,
} from "./httpIdempotency";

/**
 * Shared handler for the two Acca lifecycle mutations (Sprint 20B-B, stage B3).
 *
 * Publish and archive differ only in expected and next status, both of which are DERIVED FROM
 * THE ROUTE, never from the request. A client cannot ask to archive a draft by sending
 * `expectedStatus`, because that key does not exist in the accepted set — the illegal
 * DRAFT -> ARCHIVED, ARCHIVED -> ARCHIVED and ARCHIVED -> PUBLISHED moves are refused by the
 * B1 transition table underneath, and there is no request shape that can reach them.
 *
 * The immutable Acca snapshot is untouched: the only mutation available is the guarded B2
 * lifecycle transition, which moves the lifecycle block and nothing else.
 */

/** Only the optimistic precondition. Status and lifecycle metadata are rejected keys. */
export const ACCA_LIFECYCLE_ALLOWED_KEYS = ["expectedVersion"] as const;

export type AccaLifecycleConfig = {
  action: "acca.publish" | "acca.archive";
  expectedStatus: AccaStatus;
  nextStatus: AccaStatus;
};

export const PUBLISH_CONFIG: AccaLifecycleConfig = {
  action: "acca.publish",
  expectedStatus: "DRAFT",
  nextStatus: "PUBLISHED",
};

export const ARCHIVE_CONFIG: AccaLifecycleConfig = {
  action: "acca.archive",
  expectedStatus: "PUBLISHED",
  nextStatus: "ARCHIVED",
};

export async function handleAccaLifecycle(
  req: NextRequest,
  accaIdParam: string,
  config: AccaLifecycleConfig,
): Promise<Response> {
  const guard = guardAdminRequest({ req, family: "acca_lifecycle", requireCsrf: true });
  if (!guard.ok) return guard.response;
  const { requestId, actorId } = guard;

  if (!isAccaId(accaIdParam)) {
    return apiError("acca_not_found", 404, requestId);
  }

  const parsed = await readAdminJsonBody(req, requestId);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;

  const unexpected = rejectUnexpectedKeys(body, ACCA_LIFECYCLE_ALLOWED_KEYS);
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

  const keyCheck = validateIdempotencyKey(req.headers.get("idempotency-key"));
  if (!keyCheck.ok) {
    return apiError("idempotency_key_required", 400, requestId, {
      field: "Idempotency-Key",
      detail: keyCheck.reason,
    });
  }

  const outcome = await withHttpIdempotency({
    key: keyCheck.key,
    scope: { actorId, action: config.action, targetId: accaIdParam },
    fingerprint: fingerprintRequest(body),
    execute: async (): Promise<StoredHttpResponse> => {
      const result = await getAccaService().transitionAccaLifecycle({
        accaId: accaIdParam,
        // Both statuses come from the route configuration, not the caller.
        expectedStatus: config.expectedStatus,
        expectedVersion: version.value,
        nextStatus: config.nextStatus,
        actor: "admin",
        transitionedAt: new Date().toISOString(),
      });

      if (result.ok) {
        logInfo("acca_admin_acca_transitioned", {
          requestId,
          accaId: result.acca.accaId,
          nextStatus: config.nextStatus,
          version: String(result.acca.version),
        });
        return { status: 200, body: { ok: true, requestId, acca: summarizeAcca(result.acca) } };
      }

      const status = ACCA_SERVICE_HTTP_STATUS[result.code];
      if (status >= 500) {
        logWarn("acca_admin_acca_transition_failed", { requestId, code: result.code });
        return { status, body: { ok: false, error: "storage_failed", requestId } };
      }

      const failure = result as { code: string } & Record<string, unknown>;
      return {
        status,
        body: {
          ok: false,
          error: result.code,
          requestId,
          ...safeConflictExtras({
            code: result.code,
            currentStatus: failure.currentStatus as string | undefined,
            currentVersion: failure.currentVersion as number | undefined,
            field: failure.field as string | undefined,
            detail: failure.detail as string | undefined,
          }),
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

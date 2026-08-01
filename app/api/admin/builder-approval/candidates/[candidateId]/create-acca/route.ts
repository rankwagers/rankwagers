import type { NextRequest } from "next/server";
import { logInfo, logWarn } from "@/lib/monitoring/logger";
import { isCandidateId } from "@/lib/builder-approval/identifiers";
import { isLocale } from "@/lib/i18n";
import { ACCA_CREATE_REJECTED_KEYS } from "@/lib/acca-publication/contracts";
import { getAccaService } from "@/lib/api/accaComposition";
import { summarizeAcca } from "@/lib/api/accaPresentation";
import {
  guardAdminRequest,
  readAdminJsonBody,
  rejectUnexpectedKeys,
} from "@/lib/api/adminGuard";
import {
  ACCA_SERVICE_HTTP_STATUS,
  apiError,
  replayableResponse,
  safeConflictExtras,
} from "@/lib/api/responses";
import {
  fingerprintRequest,
  validateIdempotencyKey,
  withHttpIdempotency,
  type StoredHttpResponse,
} from "@/lib/api/httpIdempotency";

/**
 * Admin candidate -> Acca draft creation (Sprint 20B-B, stage B3).
 *
 * This route performs NO conversion logic of its own. It validates the request, then makes a
 * single call to the B2 service, which performs the Acca insert and the candidate
 * APPROVED -> CONVERTED transition as ONE atomic unit. Doing the two steps separately here —
 * create the Acca, then transition the candidate — would reintroduce exactly the partial-write
 * window B2 exists to eliminate.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * The only keys a caller may send. Everything describing the bet — legs, odds, evidence,
 * qualification, source references — plus every lifecycle field is derived server-side from
 * the stored candidate and is rejected here if supplied.
 */
const ALLOWED_KEYS = [
  "expectedCandidateVersion",
  "title",
  "summary",
  "locale",
  "slugDiscriminator",
] as const;

export async function POST(req: NextRequest, ctx: { params: { candidateId: string } }) {
  const guard = guardAdminRequest({ req, family: "acca_create", requireCsrf: true });
  if (!guard.ok) return guard.response;
  const { requestId, actorId } = guard;

  const candidateId = ctx.params.candidateId;
  if (!isCandidateId(candidateId)) {
    return apiError("candidate_not_found", 404, requestId);
  }

  const parsed = await readAdminJsonBody(req, requestId);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;

  // Explicit rejection, never a silent drop. A caller that sends `combinedOdds` believes it
  // controls the published price and must be told it does not.
  const unexpected = rejectUnexpectedKeys(body, ALLOWED_KEYS);
  if (!unexpected.ok) {
    return apiError("invalid_request", 400, requestId, {
      field: unexpected.key,
      detail: (ACCA_CREATE_REJECTED_KEYS as readonly string[]).includes(unexpected.key)
        ? "server_derived_field"
        : unexpected.reason,
    });
  }

  /*
   * Sprint 20B-B stage B6 — locale must be one this site actually serves.
   *
   * The B2 domain validates locale by SHAPE (`^[a-z]{2}(-…)?$`), which is correct for a
   * self-contained domain that must not depend on the site's i18n registry. But this route is
   * the composition point where the two meet, and B6 end-to-end testing found the gap: a
   * well-shaped but unserved locale (e.g. "tr", which is not among the 30 in `lib/i18n`) yields
   * an Acca that is stored, publishable, and then PERMANENTLY UNREACHABLE — middleware only
   * routes known locale prefixes, so no reader can ever open its page.
   *
   * Publishing something no one can read is exactly the kind of silent dead end that erodes
   * trust in the record, so it is refused here with a precise field error rather than accepted
   * and quietly stranded. The check lives in the route, not in `lib/acca-publication`, to keep
   * the domain free of a dependency on the site's locale registry.
   */
  if (typeof body.locale === "string" && !isLocale(body.locale)) {
    return apiError("invalid_metadata", 400, requestId, {
      field: "locale",
      detail: "locale_not_served_by_this_site",
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
    scope: { actorId, action: "candidate.create-acca", targetId: candidateId },
    fingerprint: fingerprintRequest(body),
    execute: async (): Promise<StoredHttpResponse> => {
      const result = await getAccaService().createAccaDraftFromCandidate({
        candidateId,
        expectedCandidateVersion: body.expectedCandidateVersion as number,
        // Server-derived actor. `createdBy` is a rejected key, so this can only be the
        // verified admin identity.
        createdBy: "admin",
        title: body.title as string,
        summary: body.summary as string | null | undefined,
        locale: body.locale as string,
        slugDiscriminator: body.slugDiscriminator as string | null | undefined,
        // Server-derived timestamp. Never accepted from the request.
        createdAt: new Date().toISOString(),
      });

      if (result.ok) {
        logInfo("acca_admin_acca_created", {
          requestId,
          accaId: result.acca.accaId,
          candidateId,
          legCount: String(result.acca.legs.length),
        });
        return {
          status: 201,
          body: { ok: true, requestId, acca: summarizeAcca(result.acca) },
        };
      }

      const status = ACCA_SERVICE_HTTP_STATUS[result.code];
      if (status >= 500) {
        logWarn("acca_admin_acca_create_failed", { requestId, code: result.code });
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
            existingAccaId: failure.existingAccaId as string | null | undefined,
            slug: failure.slug as string | undefined,
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

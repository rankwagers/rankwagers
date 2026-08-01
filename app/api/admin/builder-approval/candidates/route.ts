import { NextRequest, NextResponse } from "next/server";
import { getFeatureFlags } from "@/lib/config/featureFlags";
import { clientKey, type AdminAuthResult } from "@/lib/security/adminAuth";
import { assertAdminCsrf, evaluateAdminRequest } from "@/lib/security/adminCsrf";
import { checkRateLimitSafe } from "@/lib/security/rateLimit";
import { BODY_LIMITS, readJsonBody } from "@/lib/security/requestLimits";
import { readRequestIdFromHeaders } from "@/lib/observability/requestId";
import { logInfo, logWarn } from "@/lib/monitoring/logger";
import { parseCandidateListFilters } from "@/lib/builder-approval/filters";
import { trackBuilderApprovalEvent } from "@/lib/builder-approval/analytics";
import {
  createBuilderCandidate,
  describeCandidateStorage,
  listBuilderCandidates,
  summarizeCandidate,
} from "@/lib/builder-approval/service";

/**
 * Admin-only Builder publication candidate collection (Sprint 20B-A).
 *
 * POST creates an internal DRAFT candidate. GET lists candidates.
 *
 * There is deliberately no approve, reject, publish, unpublish, schedule or transition
 * endpoint in this sprint, and no route writes any status other than DRAFT.
 *
 * Candidate payloads are never logged. Only counts, categories and opaque ids are logged.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ROBOTS = "noindex, nofollow, noarchive";

function headersFor(requestId: string): Record<string, string> {
  return {
    "Cache-Control": "no-store",
    "x-robots-tag": ROBOTS,
    "x-request-id": requestId,
  };
}

function json(
  body: Record<string, unknown>,
  status: number,
  requestId: string,
  extra: Record<string, string> = {},
): Response {
  return NextResponse.json(body, {
    status,
    headers: { ...headersFor(requestId), ...extra },
  });
}

/**
 * Feature gate runs before authentication so a disabled feature is indistinguishable from a
 * route that does not exist, and leaks nothing to unauthenticated callers.
 */
function disabledResponse(requestId: string): Response {
  return json({ ok: false, error: "route_disabled", requestId }, 404, requestId);
}

/**
 * Two limiters with DISTINCT purposes and DISTINCT thresholds:
 *
 *  - `admin:<client>` (30/min, in `lib/security/adminAuth.ts`) — credential-guessing and
 *    global admin-surface abuse guard. Charged on every request including failed auth.
 *    Pre-existing and unchanged.
 *  - `admin-builder-approval:<client>` (below) — per-endpoint usage guard, deliberately
 *    TIGHTER than the auth limiter so it is the authoritative and reachable limit for
 *    authenticated callers. Writes are stricter than reads: creating a candidate is a
 *    deliberate human action, not something a UI should issue in bursts.
 */
const WRITE_LIMIT_PER_MIN = 10;
const READ_LIMIT_PER_MIN = 20;
const LIMIT_WINDOW_MS = 60_000;

/**
 * Local denial response. The shared `adminDeniedResponse` helper emits neither
 * `Retry-After` nor `x-request-id`; building the response here keeps this route's header
 * contract true on auth-denial paths without modifying the shared security helper.
 *
 * No `Retry-After` is emitted for an auth-layer `rate_limited`: `evaluateAdminAccess` does
 * not return its remaining window, and inventing a value that might not match the real
 * limiter window would be worse than omitting the header. The route limiter below is
 * tighter, so it — with a real retry value — is what authenticated callers hit.
 */
function denied(
  auth: Extract<AdminAuthResult, { ok: false }>,
  requestId: string,
): Response {
  return json({ ok: false, error: auth.code, requestId }, auth.status, requestId);
}

function rateLimited(
  req: NextRequest,
  requestId: string,
  limit: number,
): Response | null {
  const rl = checkRateLimitSafe({
    key: `admin-builder-approval:${clientKey({ headers: req.headers })}`,
    limit,
    windowMs: LIMIT_WINDOW_MS,
    route: "admin_builder_approval",
    onAdapterFailure: "fail_closed",
  });
  if (rl.allowed) return null;
  // Retry-After comes from the limiter result, so it always matches the real window.
  return json({ ok: false, error: "rate_limited", requestId }, 429, requestId, {
    "Retry-After": String(rl.retryAfterSec),
  });
}

export async function POST(req: NextRequest) {
  const requestId = readRequestIdFromHeaders(req.headers);

  if (!getFeatureFlags().operatorApprovalEnabled) return disabledResponse(requestId);

  const auth = evaluateAdminRequest(req);
  if (!auth.ok) return denied(auth, requestId);

  const limited = rateLimited(req, requestId, WRITE_LIMIT_PER_MIN);
  if (limited) return limited;

  const csrf = assertAdminCsrf({ req, authVia: auth.via });
  if (!csrf.ok) {
    logWarn("builder_candidate_csrf_rejected", { requestId, code: csrf.code });
    return json({ ok: false, error: csrf.code, requestId }, 403, requestId);
  }

  const parsed = await readJsonBody(req, BODY_LIMITS.defaultJson);
  if (!parsed.ok) return parsed.response;

  // Header is the canonical channel; a body field is accepted as a documented fallback.
  const idempotencyKey =
    req.headers.get("idempotency-key")?.trim() || parsed.body.idempotencyKey;

  const result = await createBuilderCandidate({
    body: parsed.body,
    idempotencyKey,
  });

  if (!result.ok) {
    if (result.kind === "validation") {
      trackBuilderApprovalEvent("builder_candidate_create_failed", {
        failureCategory: "validation",
      });
      logWarn("builder_candidate_rejected", {
        requestId,
        // Codes and paths only. Never values.
        issues: result.issues.map((i) => `${i.path}:${i.code}`).join("|").slice(0, 500),
      });
      return json(
        { ok: false, error: "invalid_request", requestId, issues: result.issues },
        400,
        requestId,
      );
    }
    if (result.kind === "idempotency_conflict") {
      trackBuilderApprovalEvent("builder_candidate_create_failed", {
        failureCategory: "idempotency_conflict",
      });
      return json(
        {
          ok: false,
          error: "idempotency_conflict",
          requestId,
          existingCandidateId: result.existingCandidateId,
          message:
            "This idempotency key was already used with a different request payload.",
        },
        409,
        requestId,
      );
    }
    trackBuilderApprovalEvent("builder_candidate_create_failed", {
      failureCategory: "storage_failed",
    });
    logWarn("builder_candidate_storage_failed", { requestId });
    return json({ ok: false, error: "storage_failed", requestId }, 500, requestId);
  }

  const summary = summarizeCandidate(result.candidate);
  const storage = describeCandidateStorage();

  trackBuilderApprovalEvent("builder_candidate_created", {
    candidateId: summary.candidateId,
    schemaVersion: summary.schemaVersion,
    storageMode: summary.storageMode,
    legCount: summary.legCount ?? undefined,
    sourceDate: summary.sourceDate,
    deduplicated: result.deduplicated,
  });
  logInfo("builder_candidate_created", {
    requestId,
    candidateId: summary.candidateId,
    legCount: String(summary.legCount ?? "unknown"),
    storageMode: summary.storageMode,
    deduplicated: String(result.deduplicated),
  });

  return json(
    {
      ok: true,
      requestId,
      // A retry that resolved to the existing candidate returns 200; a fresh create is 201.
      deduplicated: result.deduplicated,
      candidate: summary,
      storage: {
        mode: storage.mode,
        durable: storage.durable,
        degradedNotice: storage.degradedNotice,
      },
      notice:
        "Created an internal DRAFT candidate. It is not approved and not published, and has no public visibility.",
    },
    result.deduplicated ? 200 : 201,
    requestId,
  );
}

export async function GET(req: NextRequest) {
  const requestId = readRequestIdFromHeaders(req.headers);

  if (!getFeatureFlags().operatorApprovalEnabled) return disabledResponse(requestId);

  const auth = evaluateAdminRequest(req);
  if (!auth.ok) return denied(auth, requestId);

  const limited = rateLimited(req, requestId, READ_LIMIT_PER_MIN);
  if (limited) return limited;

  const filters = parseCandidateListFilters(req.nextUrl.searchParams);

  try {
    const page = await listBuilderCandidates(filters);
    const storage = describeCandidateStorage();
    return json(
      {
        ok: true,
        requestId,
        total: page.total,
        limit: page.limit,
        offset: page.offset,
        candidates: page.rows.map(summarizeCandidate),
        storage: {
          mode: storage.mode,
          durable: storage.durable,
          degradedNotice: storage.degradedNotice,
        },
      },
      200,
      requestId,
    );
  } catch {
    logWarn("builder_candidate_list_failed", { requestId });
    return json({ ok: false, error: "list_failed", requestId }, 500, requestId);
  }
}

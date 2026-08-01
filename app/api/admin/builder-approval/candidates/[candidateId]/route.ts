import { NextRequest, NextResponse } from "next/server";
import { getFeatureFlags } from "@/lib/config/featureFlags";
import { clientKey, type AdminAuthResult } from "@/lib/security/adminAuth";
import { evaluateAdminRequest } from "@/lib/security/adminCsrf";
import { checkRateLimitSafe } from "@/lib/security/rateLimit";
import { readRequestIdFromHeaders } from "@/lib/observability/requestId";
import { logWarn } from "@/lib/monitoring/logger";
import { isCandidateId } from "@/lib/builder-approval/identifiers";
import { trackBuilderApprovalEvent } from "@/lib/builder-approval/analytics";
import {
  describeCandidateStorage,
  getBuilderCandidate,
  summarizeCandidate,
} from "@/lib/builder-approval/service";

/**
 * Admin-only single candidate read (Sprint 20B-A).
 *
 * Read-only. There is no PATCH, PUT or DELETE, and no transition capability: a candidate is
 * write-once for the whole of this sprint.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ROBOTS = "noindex, nofollow, noarchive";

function json(
  body: Record<string, unknown>,
  status: number,
  requestId: string,
  extra: Record<string, string> = {},
): Response {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "x-robots-tag": ROBOTS,
      "x-request-id": requestId,
      ...extra,
    },
  });
}

/** Per-endpoint read guard, deliberately tighter than the 30/min auth limiter. */
const READ_LIMIT_PER_MIN = 20;
const LIMIT_WINDOW_MS = 60_000;

/**
 * Local denial response. The shared `adminDeniedResponse` helper emits neither
 * `Retry-After` nor `x-request-id`; building it here keeps this route's header contract
 * true on auth-denial paths without modifying the shared security helper.
 *
 * No fabricated `Retry-After`: the auth limiter does not expose its remaining window.
 */
function denied(
  auth: Extract<AdminAuthResult, { ok: false }>,
  requestId: string,
): Response {
  return json({ ok: false, error: auth.code, requestId }, auth.status, requestId);
}

export async function GET(
  req: NextRequest,
  ctx: { params: { candidateId: string } },
) {
  const requestId = readRequestIdFromHeaders(req.headers);

  if (!getFeatureFlags().operatorApprovalEnabled) {
    return json({ ok: false, error: "route_disabled", requestId }, 404, requestId);
  }

  const auth = evaluateAdminRequest(req);
  if (!auth.ok) return denied(auth, requestId);

  const rl = checkRateLimitSafe({
    key: `admin-builder-approval:${clientKey({ headers: req.headers })}`,
    limit: READ_LIMIT_PER_MIN,
    windowMs: LIMIT_WINDOW_MS,
    route: "admin_builder_approval",
    onAdapterFailure: "fail_closed",
  });
  if (!rl.allowed) {
    return json({ ok: false, error: "rate_limited", requestId }, 429, requestId, {
      "Retry-After": String(rl.retryAfterSec),
    });
  }

  const { candidateId } = ctx.params;
  // Reject malformed ids before touching storage; same safe 404 as a genuine miss so the
  // response never distinguishes "bad shape" from "does not exist".
  if (!isCandidateId(candidateId)) {
    return json({ ok: false, error: "candidate_not_found", requestId }, 404, requestId);
  }

  try {
    const candidate = await getBuilderCandidate(candidateId);
    if (!candidate) {
      return json({ ok: false, error: "candidate_not_found", requestId }, 404, requestId);
    }

    const summary = summarizeCandidate(candidate);
    const storage = describeCandidateStorage();
    trackBuilderApprovalEvent("builder_candidate_viewed", {
      candidateId: summary.candidateId,
      storageMode: summary.storageMode,
      legCount: summary.legCount ?? undefined,
    });

    return json(
      {
        ok: true,
        requestId,
        candidate: {
          ...summary,
          sourceBuilderConfig: candidate.sourceBuilderConfig,
          payload: candidate.payload,
        },
        storage: {
          mode: storage.mode,
          durable: storage.durable,
          degradedNotice: storage.degradedNotice,
        },
        capabilities: {
          // Explicit and honest: nothing can be transitioned in Sprint 20B-A.
          canApprove: false,
          canReject: false,
          canPublish: false,
          reason: "Sprint 20B-A stores DRAFT candidates only; approval arrives in Sprint 20B-B.",
        },
      },
      200,
      requestId,
    );
  } catch {
    logWarn("builder_candidate_read_failed", { requestId });
    return json({ ok: false, error: "read_failed", requestId }, 500, requestId);
  }
}

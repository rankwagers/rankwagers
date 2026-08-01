import { NextRequest, NextResponse } from "next/server";
import { previewExperimentAssignment } from "@/lib/experimentation/service";
import { trackAdminExperimentAnalytics } from "@/lib/experimentation/analytics";
import { assertAdminCsrf } from "@/lib/experimentation/csrf";
import { requireAdminAccess } from "@/lib/security/requireAdminAccess";
import { readRequestIdFromHeaders } from "@/lib/observability/requestId";
import { checkRateLimitSafe } from "@/lib/security/rateLimit";
import { clientKey } from "@/lib/security/adminAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ROBOTS = "noindex, nofollow, noarchive";

export async function POST(req: NextRequest) {
  const denied = requireAdminAccess(req);
  if (denied) return denied;

  const requestId = readRequestIdFromHeaders(req.headers);
  const csrf = assertAdminCsrf(req);
  if (!csrf.ok) {
    return NextResponse.json(
      { ok: false, error: csrf.error, requestId },
      {
        status: 403,
        headers: {
          "Cache-Control": "no-store",
          "x-robots-tag": ROBOTS,
          "x-request-id": requestId,
        },
      },
    );
  }

  const rl = checkRateLimitSafe({
    key: `admin-experiments-preview:${clientKey({ headers: req.headers })}`,
    limit: 30,
    windowMs: 60_000,
    route: "admin_experiments_preview",
    onAdapterFailure: "fail_closed",
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: "rate_limited", requestId },
      {
        status: 429,
        headers: {
          "Retry-After": String(rl.retryAfterSec),
          "Cache-Control": "no-store",
          "x-robots-tag": ROBOTS,
          "x-request-id": requestId,
        },
      },
    );
  }

  const body = (await req.json().catch(() => null)) as {
    experimentId?: string;
    assignmentKey?: string;
    locale?: string;
    country?: string;
    pageType?: string;
  } | null;

  if (!body?.experimentId || !body?.assignmentKey) {
    return NextResponse.json(
      { ok: false, error: "invalid_body", requestId },
      {
        status: 400,
        headers: {
          "Cache-Control": "no-store",
          "x-robots-tag": ROBOTS,
          "x-request-id": requestId,
        },
      },
    );
  }

  trackAdminExperimentAnalytics("admin_experiment_previewed", {
    experimentId: body.experimentId,
  });

  const result = await previewExperimentAssignment({
    experimentId: body.experimentId,
    assignmentKey: body.assignmentKey,
    locale: body.locale,
    country: body.country,
    pageType: body.pageType,
  });

  return NextResponse.json(
    { ...result, requestId },
    {
      status: result.ok ? 200 : 404,
      headers: {
        "Cache-Control": "no-store",
        "x-robots-tag": ROBOTS,
        "x-request-id": requestId,
      },
    },
  );
}

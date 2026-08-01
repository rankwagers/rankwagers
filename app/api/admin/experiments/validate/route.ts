import { NextRequest, NextResponse } from "next/server";
import { validateExperimentDefinition } from "@/lib/experimentation/service";
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
    key: `admin-experiments-validate:${clientKey({ headers: req.headers })}`,
    limit: 30,
    windowMs: 60_000,
    route: "admin_experiments_validate",
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
  } | null;
  if (!body?.experimentId) {
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

  trackAdminExperimentAnalytics("admin_experiment_validation_run", {
    experimentId: body.experimentId,
  });

  const result = await validateExperimentDefinition(body.experimentId);
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

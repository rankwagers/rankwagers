import { NextRequest, NextResponse } from "next/server";
import { analyzeExperimentSynthetic } from "@/lib/experimentation/service";
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
    key: `admin-experiments-analyze:${clientKey({ headers: req.headers })}`,
    limit: 20,
    windowMs: 60_000,
    route: "admin_experiments_analyze",
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
    controlConversions?: number;
    controlN?: number;
    treatmentConversions?: number;
    treatmentN?: number;
    controlExposures?: number;
    treatmentExposures?: number;
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

  trackAdminExperimentAnalytics("admin_experiment_analysis_run", {
    experimentId: body.experimentId,
    synthetic: true,
  });

  const result = await analyzeExperimentSynthetic({
    experimentId: body.experimentId,
    controlConversions: Number(body.controlConversions ?? 0),
    controlN: Number(body.controlN ?? 0),
    treatmentConversions: Number(body.treatmentConversions ?? 0),
    treatmentN: Number(body.treatmentN ?? 0),
    controlExposures: Number(body.controlExposures ?? 0),
    treatmentExposures: Number(body.treatmentExposures ?? 0),
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

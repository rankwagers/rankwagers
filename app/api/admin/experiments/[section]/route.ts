import { NextRequest, NextResponse } from "next/server";
import {
  parseExperimentFilters,
  parseExperimentSection,
} from "@/lib/experimentation/filters";
import { getExperimentSection } from "@/lib/experimentation/service";
import { trackAdminExperimentAnalytics } from "@/lib/experimentation/analytics";
import { requireAdminAccess } from "@/lib/security/requireAdminAccess";
import { readRequestIdFromHeaders } from "@/lib/observability/requestId";
import { checkRateLimitSafe } from "@/lib/security/rateLimit";
import { clientKey } from "@/lib/security/adminAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ROBOTS = "noindex, nofollow, noarchive";

export async function GET(
  req: NextRequest,
  ctx: { params: { section: string } },
) {
  const denied = requireAdminAccess(req);
  if (denied) return denied;

  const requestId = readRequestIdFromHeaders(req.headers);
  const rl = checkRateLimitSafe({
    key: `admin-experiments:${clientKey({ headers: req.headers })}`,
    limit: 60,
    windowMs: 60_000,
    route: "admin_experiments",
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

  const section = parseExperimentSection(ctx.params.section);
  if (!section) {
    return NextResponse.json(
      { ok: false, error: "invalid_section", requestId },
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

  const filters = parseExperimentFilters(req.nextUrl.searchParams);
  trackAdminExperimentAnalytics("admin_experiment_viewed", { section });

  try {
    const data = await getExperimentSection(section, filters);
    return NextResponse.json(
      { ok: true, section, requestId, data },
      {
        headers: {
          "Cache-Control": "no-store",
          "x-robots-tag": ROBOTS,
          "x-request-id": requestId,
        },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message.slice(0, 200) : "error";
    return NextResponse.json(
      { ok: false, error: "experiments_failed", message, requestId },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
          "x-robots-tag": ROBOTS,
          "x-request-id": requestId,
        },
      },
    );
  }
}

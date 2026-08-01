import { NextRequest, NextResponse } from "next/server";
import {
  parseCalibrationFilters,
  parseCalibrationSection,
} from "@/lib/calibration-intelligence/filters";
import { getCalibrationSection } from "@/lib/calibration-intelligence/service";
import { trackAdminCalibrationAnalytics } from "@/lib/calibration-intelligence/analytics";
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
    key: `admin-calibration:${clientKey({ headers: req.headers })}`,
    limit: 60,
    windowMs: 60_000,
    route: "admin_calibration",
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

  const section = parseCalibrationSection(ctx.params.section);
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

  const filters = parseCalibrationFilters(req.nextUrl.searchParams);

  trackAdminCalibrationAnalytics("admin_calibration_viewed", { section });
  trackAdminCalibrationAnalytics("admin_calibration_evaluation_started", {
    section,
  });

  try {
    const data = await getCalibrationSection(section, filters);
    trackAdminCalibrationAnalytics("admin_calibration_evaluation_completed", {
      section,
    });
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
    trackAdminCalibrationAnalytics("admin_calibration_evaluation_failed", {
      section,
      message,
    });
    return NextResponse.json(
      { ok: false, error: "calibration_evaluation_failed", message, requestId },
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

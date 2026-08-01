import { NextRequest, NextResponse } from "next/server";
import {
  parseExperimentFilters,
  parseExperimentSection,
} from "@/lib/experimentation/filters";
import { exportExperimentSection } from "@/lib/experimentation/service";
import { trackAdminExperimentAnalytics } from "@/lib/experimentation/analytics";
import { requireAdminAccess } from "@/lib/security/requireAdminAccess";
import { readRequestIdFromHeaders } from "@/lib/observability/requestId";
import { checkRateLimitSafe } from "@/lib/security/rateLimit";
import { clientKey } from "@/lib/security/adminAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ROBOTS = "noindex, nofollow, noarchive";

export async function GET(req: NextRequest) {
  const denied = requireAdminAccess(req);
  if (denied) return denied;

  const requestId = readRequestIdFromHeaders(req.headers);
  const rl = checkRateLimitSafe({
    key: `admin-experiments-export:${clientKey({ headers: req.headers })}`,
    limit: 20,
    windowMs: 60_000,
    route: "admin_experiments_export",
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

  const section = parseExperimentSection(
    req.nextUrl.searchParams.get("section"),
  );
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

  const formatRaw = req.nextUrl.searchParams.get("format") || "csv";
  if (formatRaw !== "csv" && formatRaw !== "json") {
    return NextResponse.json(
      { ok: false, error: "invalid_format", requestId },
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
  trackAdminExperimentAnalytics("admin_experiment_exported", {
    section,
    format: formatRaw,
  });

  try {
    const file = await exportExperimentSection(section, formatRaw, filters);
    return new NextResponse(file.body, {
      status: 200,
      headers: {
        "Content-Type": file.contentType,
        "Content-Disposition": `attachment; filename="${file.filename}"`,
        "Cache-Control": "no-store",
        "x-robots-tag": ROBOTS,
        "x-request-id": requestId,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message.slice(0, 200) : "error";
    return NextResponse.json(
      { ok: false, error: "export_failed", message, requestId },
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

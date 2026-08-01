import { NextRequest, NextResponse } from "next/server";
import { parseSeoFilters, parseSeoSection } from "@/lib/seo-intelligence/filters";
import { getSeoSection, getSeoUrlDetail } from "@/lib/seo-intelligence/service";
import { trackAdminSeoAnalytics } from "@/lib/seo-intelligence/analytics";
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
    key: `admin-seo:${clientKey({ headers: req.headers })}`,
    limit: 60,
    windowMs: 60_000,
    route: "admin_seo",
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
      }
    );
  }

  const pathDetail = req.nextUrl.searchParams.get("path");
  if (pathDetail) {
    trackAdminSeoAnalytics("admin_seo_url_opened", { path: pathDetail });
    try {
      const data = await getSeoUrlDetail(pathDetail);
      if (!data) {
        return NextResponse.json(
          { ok: false, error: "not_found", requestId },
          {
            status: 404,
            headers: {
              "Cache-Control": "no-store",
              "x-robots-tag": ROBOTS,
              "x-request-id": requestId,
            },
          }
        );
      }
      return NextResponse.json(
        { ok: true, requestId, data },
        {
          headers: {
            "Cache-Control": "no-store",
            "x-robots-tag": ROBOTS,
            "x-request-id": requestId,
          },
        }
      );
    } catch (err) {
      trackAdminSeoAnalytics("admin_seo_audit_failed", {
        message: err instanceof Error ? err.message.slice(0, 120) : "error",
      });
      return NextResponse.json(
        { ok: false, error: "seo_detail_failed", requestId },
        {
          status: 500,
          headers: {
            "Cache-Control": "no-store",
            "x-robots-tag": ROBOTS,
            "x-request-id": requestId,
          },
        }
      );
    }
  }

  const section = parseSeoSection(req.nextUrl.searchParams.get("section"));
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
      }
    );
  }

  const filters = parseSeoFilters(req.nextUrl.searchParams);
  trackAdminSeoAnalytics("admin_seo_viewed", { section });
  trackAdminSeoAnalytics("admin_seo_audit_started", { section });

  try {
    const data = await getSeoSection(section, filters);
    trackAdminSeoAnalytics("admin_seo_audit_completed", { section });
    return NextResponse.json(
      { ok: true, section, requestId, data },
      {
        headers: {
          "Cache-Control": "no-store",
          "x-robots-tag": ROBOTS,
          "x-request-id": requestId,
        },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message.slice(0, 200) : "error";
    trackAdminSeoAnalytics("admin_seo_audit_failed", { section, message });
    return NextResponse.json(
      { ok: false, error: "seo_audit_failed", message, requestId },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
          "x-robots-tag": ROBOTS,
          "x-request-id": requestId,
        },
      }
    );
  }
}

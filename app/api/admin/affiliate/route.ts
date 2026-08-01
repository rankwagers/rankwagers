import { NextRequest, NextResponse } from "next/server";
import {
  parseAffiliateFilters,
  parseAffiliateSection,
} from "@/lib/affiliate-intelligence/filters";
import {
  getAffiliateOperatorDetail,
  getAffiliateSection,
} from "@/lib/affiliate-intelligence/service";
import { trackAdminAffiliateAnalytics } from "@/lib/affiliate-intelligence/analytics";
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
    key: `admin-affiliate:${clientKey({ headers: req.headers })}`,
    limit: 60,
    windowMs: 60_000,
    route: "admin_affiliate",
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

  const filters = parseAffiliateFilters(req.nextUrl.searchParams);
  const operatorId = req.nextUrl.searchParams.get("operatorId");
  if (operatorId) {
    trackAdminAffiliateAnalytics("admin_affiliate_operator_opened", {
      operatorId,
    });
    try {
      const data = await getAffiliateOperatorDetail(operatorId, filters);
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
      trackAdminAffiliateAnalytics("admin_affiliate_audit_failed", {
        message: err instanceof Error ? err.message.slice(0, 120) : "error",
      });
      return NextResponse.json(
        { ok: false, error: "affiliate_detail_failed", requestId },
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

  const section = parseAffiliateSection(req.nextUrl.searchParams.get("section"));
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

  trackAdminAffiliateAnalytics("admin_affiliate_viewed", { section });
  trackAdminAffiliateAnalytics("admin_affiliate_audit_started", { section });

  try {
    const data = await getAffiliateSection(section, filters);
    trackAdminAffiliateAnalytics("admin_affiliate_audit_completed", { section });
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
    trackAdminAffiliateAnalytics("admin_affiliate_audit_failed", {
      section,
      message,
    });
    return NextResponse.json(
      { ok: false, error: "affiliate_audit_failed", message, requestId },
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

import { NextRequest, NextResponse } from "next/server";
import {
  parseAdminFilters,
  type AdminDashboardSection,
} from "@/lib/admin-dashboard";
import { getAdminDashboardSection } from "@/lib/admin-dashboard/service";
import { trackAdminAnalytics } from "@/lib/admin-dashboard/adminAnalytics";
import { requireAdminAccess } from "@/lib/security/requireAdminAccess";
import { readRequestIdFromHeaders } from "@/lib/observability/requestId";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SECTIONS: AdminDashboardSection[] = [
  "overview",
  "predictions",
  "markets",
  "leagues",
  "builder",
  "operators",
  "search",
  "system",
];

export async function GET(req: NextRequest) {
  const denied = requireAdminAccess(req);
  if (denied) return denied;

  const requestId = readRequestIdFromHeaders(req.headers);
  const sectionRaw = req.nextUrl.searchParams.get("section") || "overview";
  if (!SECTIONS.includes(sectionRaw as AdminDashboardSection)) {
    return NextResponse.json(
      { ok: false, error: "invalid_section", requestId },
      {
        status: 400,
        headers: {
          "Cache-Control": "no-store",
          "x-robots-tag": "noindex, nofollow, noarchive",
          "x-request-id": requestId,
        },
      }
    );
  }

  const filters = parseAdminFilters(req.nextUrl.searchParams);
  trackAdminAnalytics("admin_section_opened", { section: sectionRaw });

  try {
    const data = await getAdminDashboardSection(
      sectionRaw as AdminDashboardSection,
      filters
    );
    return NextResponse.json(
      { ok: true, section: sectionRaw, requestId, data },
      {
        headers: {
          "Cache-Control": "no-store",
          "x-robots-tag": "noindex, nofollow, noarchive",
          "x-request-id": requestId,
        },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message.slice(0, 200) : "error";
    return NextResponse.json(
      { ok: false, error: "dashboard_failed", message, requestId },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
          "x-robots-tag": "noindex, nofollow, noarchive",
          "x-request-id": requestId,
        },
      }
    );
  }
}

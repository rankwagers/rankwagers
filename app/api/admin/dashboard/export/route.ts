import { NextRequest, NextResponse } from "next/server";
import {
  dashboardToCsv,
  dashboardToJson,
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
  const format = (req.nextUrl.searchParams.get("format") || "json").toLowerCase();
  if (!SECTIONS.includes(sectionRaw as AdminDashboardSection)) {
    return NextResponse.json(
      { ok: false, error: "invalid_section", requestId },
      { status: 400, headers: { "Cache-Control": "no-store", "x-request-id": requestId } }
    );
  }
  if (format !== "json" && format !== "csv") {
    return NextResponse.json(
      { ok: false, error: "invalid_format", requestId },
      { status: 400, headers: { "Cache-Control": "no-store", "x-request-id": requestId } }
    );
  }

  const filters = parseAdminFilters(req.nextUrl.searchParams);
  const data = await getAdminDashboardSection(
    sectionRaw as AdminDashboardSection,
    filters
  );
  trackAdminAnalytics("admin_dashboard_exported", {
    section: sectionRaw,
    format,
  });

  if (format === "csv") {
    const body = dashboardToCsv(
      sectionRaw as AdminDashboardSection,
      data
    );
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="admin-${sectionRaw}.csv"`,
        "Cache-Control": "no-store",
        "x-robots-tag": "noindex, nofollow, noarchive",
        "x-request-id": requestId,
      },
    });
  }

  const body = dashboardToJson(sectionRaw as AdminDashboardSection, data);
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="admin-${sectionRaw}.json"`,
      "Cache-Control": "no-store",
      "x-robots-tag": "noindex, nofollow, noarchive",
      "x-request-id": requestId,
    },
  });
}

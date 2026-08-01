import { NextRequest, NextResponse } from "next/server";
import { getCrawlQualityApiPayload, getCrawlQualityReport } from "@/lib/crawl-quality";
import { requireDiagnosticsAccess } from "@/lib/security/requireDiagnosticsAccess";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const denied = requireDiagnosticsAccess(req);
  if (denied) return denied;

  const report = getCrawlQualityReport();
  const payload = getCrawlQualityApiPayload();
  const status =
    report.status === "unhealthy" || payload.orphanPages > 0 || payload.brokenCanonicals > 0
      ? 503
      : 200;
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}

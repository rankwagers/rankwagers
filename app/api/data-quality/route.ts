import { NextRequest, NextResponse } from "next/server";
import { getDataQualityApiPayload } from "@/lib/data-quality";
import { requireDiagnosticsAccess } from "@/lib/security/requireDiagnosticsAccess";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const denied = requireDiagnosticsAccess(req);
  if (denied) return denied;

  const payload = getDataQualityApiPayload();
  const status = payload.status === "unhealthy" ? 503 : 200;
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}

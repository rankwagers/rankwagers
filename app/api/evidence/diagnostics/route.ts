import { NextRequest, NextResponse } from "next/server";
import { getEvidenceDiagnostics } from "@/lib/evidence-ui";
import { requireDiagnosticsAccess } from "@/lib/security/requireDiagnosticsAccess";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const denied = requireDiagnosticsAccess(req);
  if (denied) return denied;
  return NextResponse.json(getEvidenceDiagnostics(), {
    headers: {
      "Cache-Control": "no-store",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}

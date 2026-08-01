import { NextRequest, NextResponse } from "next/server";
import { buildOperatorsDiagnostics } from "@/lib/operators/diagnostics";
import { requireDiagnosticsAccess } from "@/lib/security/requireDiagnosticsAccess";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const denied = requireDiagnosticsAccess(req);
  if (denied) return denied;
  return NextResponse.json(buildOperatorsDiagnostics(), {
    headers: {
      "Cache-Control": "no-store",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}

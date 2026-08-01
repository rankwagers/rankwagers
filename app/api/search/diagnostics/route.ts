import { NextRequest, NextResponse } from "next/server";
import { getSearchDiagnostics } from "@/lib/search";
import { requireDiagnosticsAccess } from "@/lib/security/requireDiagnosticsAccess";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Read-only search index diagnostics for the developer dashboard. */
export async function GET(req: NextRequest) {
  const denied = requireDiagnosticsAccess(req);
  if (denied) return denied;
  const diagnostics = getSearchDiagnostics({ force: false });
  return NextResponse.json(diagnostics, {
    headers: {
      "Cache-Control": "no-store",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}

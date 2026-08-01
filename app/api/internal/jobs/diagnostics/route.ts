import { NextRequest, NextResponse } from "next/server";
import { getEvidenceJobDiagnostics } from "@/lib/jobs/diagnostics";
import { requireDiagnosticsAccess } from "@/lib/security/requireDiagnosticsAccess";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Operational freshness for the M9 capture/settlement jobs (C7). Access-guarded like the
// other diagnostics surfaces; read-only projection over the in-process job log.
export async function GET(req: NextRequest) {
  const denied = requireDiagnosticsAccess(req);
  if (denied) return denied;
  return NextResponse.json(getEvidenceJobDiagnostics(), {
    headers: {
      "Cache-Control": "no-store",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}

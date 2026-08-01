import type { NextRequest } from "next/server";
import { handleCronPost } from "@/lib/jobs/cronHandler";
import { runEvidenceCaptureJob } from "@/lib/jobs/runner";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// Access + rate-limit + advisory lock via handleCronPost; capture flag gated inside the
// job (fail-closed → `skipped`/409 when EVIDENCE_CAPTURE_ENABLED is off). External
// scheduling is an out-of-repo operational action and is never authored here.
export async function POST(req: NextRequest) {
  return handleCronPost(req, () => runEvidenceCaptureJob());
}

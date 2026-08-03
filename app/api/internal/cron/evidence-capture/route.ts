import type { NextRequest } from "next/server";
import { handleCronPost } from "@/lib/jobs/cronHandler";
import { runEvidenceCaptureJob } from "@/lib/jobs/runner";
import { produceLiveCaptureRequests } from "@/lib/evidence-capture/candidates/live-capture-candidates";
import { todayMatchDateStr } from "@/lib/footystats/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// Access + rate-limit + advisory lock via handleCronPost; capture flag gated inside the
// job (fail-closed → `skipped`/409 when EVIDENCE_CAPTURE_ENABLED is off). External
// scheduling is an out-of-repo operational action and is never authored here.
export async function POST(req: NextRequest) {
  return handleCronPost(req, () =>
    runEvidenceCaptureJob({
      /*
       * The live candidate producer. Without it `candidates` defaulted to `[]` and every run
       * reported success having written nothing — the failure mode a schedule would have hidden.
       *
       * Discovery runs INSIDE the job's lock (INV-L), which is why a producer is supplied rather
       * than a pre-computed array: the job decides when to call it.
       */
      provideCandidates: async () => {
        const date = todayMatchDateStr();
        const result = await produceLiveCaptureRequests({
          config: { date, evaluationInstant: new Date().toISOString() },
        });
        return result.candidates;
      },
    })
  );
}

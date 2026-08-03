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
       *
       * `provideCandidateBatch`, NOT `provideCandidates`. The latter returns bare candidates and
       * drops the producer's diagnostics on the floor, which made two completely different runs
       * indistinguishable in the job record: "nothing was in the pre-kickoff window" and "thirteen
       * fixtures were in the window and every one of them failed to derive" both recorded
       * `considered: 0` and reported success. This seam merges `candidatesEligible` and
       * `candidatesRejectedByReason` into `resultCounts` and emits producer metrics, so an empty
       * run now states WHY it was empty.
       */
      provideCandidateBatch: async () => {
        const date = todayMatchDateStr();
        const result = await produceLiveCaptureRequests({
          config: { date, evaluationInstant: new Date().toISOString() },
        });
        return { candidates: result.candidates, diagnostics: result.diagnostics };
      },
    })
  );
}

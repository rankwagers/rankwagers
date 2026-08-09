import type { NextRequest } from "next/server";
import { handleCronPost } from "@/lib/jobs/cronHandler";
import { runComposedSettlementJob } from "@/lib/evidence-capture/jobs/composed-settlement";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// Access + rate-limit + advisory lock via handleCronPost; settlement flag gated inside
// the job (fail-closed → `skipped`/409 when EVIDENCE_SETTLEMENT_ENABLED is off), and the
// activation MODE (off / dry_run / canary) gated inside the composition — both fail closed,
// so this wiring is byte-for-byte inert until two env values are deliberately set.
// External scheduling is an out-of-repo operational action and is never authored here.
export async function POST(req: NextRequest) {
  return handleCronPost(req, () => runComposedSettlementJob());
}

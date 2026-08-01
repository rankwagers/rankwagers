import type { NextRequest } from "next/server";
import { REJECT_CONFIG, handleCandidateTransition } from "@/lib/api/candidateTransitionRoute";

/**
 * Admin candidate rejection (Sprint 20B-B, stage B3).
 *
 * DRAFT -> REJECTED via the guarded B1 lifecycle transition. The client supplies
 * `expectedVersion` and a bounded `rejectionReason`; status, actor and timestamp are all
 * server-derived. The note is trimmed and length-bounded, and a blank one is rejected rather
 * than stored as an empty reason.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest, ctx: { params: { candidateId: string } }) {
  return handleCandidateTransition(req, ctx.params.candidateId, REJECT_CONFIG);
}

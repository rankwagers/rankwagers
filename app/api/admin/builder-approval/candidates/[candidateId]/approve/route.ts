import type { NextRequest } from "next/server";
import {
  APPROVE_CONFIG,
  handleCandidateTransition,
} from "@/lib/api/candidateTransitionRoute";

/**
 * Admin candidate approval (Sprint 20B-B, stage B3).
 *
 * DRAFT -> APPROVED via the guarded B1 lifecycle transition. The client supplies only
 * `expectedVersion`; status, actor and timestamp are all server-derived.
 *
 * `runtime = "nodejs"` is mandatory, not stylistic: the PostgreSQL adapter reached through this
 * handler uses `pg` and `node:crypto`, neither of which exists on the Edge runtime.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest, ctx: { params: { candidateId: string } }) {
  return handleCandidateTransition(req, ctx.params.candidateId, APPROVE_CONFIG);
}

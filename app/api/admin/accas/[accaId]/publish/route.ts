import type { NextRequest } from "next/server";
import { PUBLISH_CONFIG, handleAccaLifecycle } from "@/lib/api/accaLifecycleRoute";

/**
 * Admin Acca publication (Sprint 20B-B, stage B3).
 *
 * DRAFT -> PUBLISHED. The client supplies only `expectedVersion`; expected status, next status,
 * actor and timestamp are derived from the route and the verified session.
 *
 * Publishing sets the lifecycle block only. The immutable snapshot — legs, odds, evidence,
 * qualification, slug, title — is never rewritten by this endpoint.
 *
 * NOTE: this creates no public page. Public Acca surfaces are stage B5.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest, ctx: { params: { accaId: string } }) {
  return handleAccaLifecycle(req, ctx.params.accaId, PUBLISH_CONFIG);
}

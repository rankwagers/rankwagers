import type { NextRequest } from "next/server";
import { ARCHIVE_CONFIG, handleAccaLifecycle } from "@/lib/api/accaLifecycleRoute";

/**
 * Admin Acca archiving (Sprint 20B-B, stage B3).
 *
 * PUBLISHED -> ARCHIVED, and only that. DRAFT -> ARCHIVED, ARCHIVED -> ARCHIVED and
 * ARCHIVED -> PUBLISHED are all unreachable: the expected status is fixed by the route, so a
 * draft fails the precondition, and ARCHIVED is terminal in the B1 transition table.
 *
 * Prior publication metadata is preserved by the transition, so an archived Acca still records
 * when and by whom it was published.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest, ctx: { params: { accaId: string } }) {
  return handleAccaLifecycle(req, ctx.params.accaId, ARCHIVE_CONFIG);
}

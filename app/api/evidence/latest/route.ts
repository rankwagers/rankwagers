import { NextRequest } from "next/server";
import {
  evidenceApiResponse,
  parseEvidenceQuery,
} from "@/lib/archive/evidence/api";
import { getLatestEvidenceSnapshot } from "@/lib/archive/evidence/service";
import { verifySnapshotIntegrity } from "@/lib/evidence/integrity";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/evidence/latest?fixtureId=123
 *
 * The highest-sequence snapshot for a fixture, returned verbatim — this is the raw
 * archived row, not a projection, so a consumer can recompute its content hash and
 * check it independently. `integrityVerified` reports our own check of the same thing.
 */
export async function GET(req: NextRequest) {
  const parsed = parseEvidenceQuery(req.nextUrl.searchParams);
  if (!parsed.ok) return evidenceApiResponse(parsed.body, parsed.status);

  const { fixtureId } = parsed.query;
  const snapshot = await getLatestEvidenceSnapshot(fixtureId);

  return evidenceApiResponse({
    fixtureId,
    available: snapshot !== null,
    snapshot,
    integrityVerified: snapshot ? verifySnapshotIntegrity(snapshot) : true,
  });
}

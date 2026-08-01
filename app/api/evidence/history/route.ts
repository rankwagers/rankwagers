import { NextRequest } from "next/server";
import {
  evidenceApiResponse,
  parseEvidenceQuery,
} from "@/lib/archive/evidence/api";
import { getEvidenceHistoryView } from "@/lib/archive/evidence/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/evidence/history?fixtureId=123[&limit=50][&locale=en]
 *
 * The full projected evidence history for a fixture — the same view the fixture page
 * server-renders. Fixtures with no archive return 200 with `available: false`, not 404:
 * "we have no evidence for this fixture" is a real, useful answer, and the caller
 * should not have to distinguish it from a broken route.
 */
export async function GET(req: NextRequest) {
  const parsed = parseEvidenceQuery(req.nextUrl.searchParams);
  if (!parsed.ok) return evidenceApiResponse(parsed.body, parsed.status);

  const { fixtureId, limit, locale } = parsed.query;
  const view = await getEvidenceHistoryView(fixtureId, { limit, locale });
  return evidenceApiResponse(view);
}

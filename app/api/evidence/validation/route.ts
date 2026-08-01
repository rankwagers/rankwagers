import { NextRequest } from "next/server";
import {
  evidenceApiResponse,
  parseEvidenceQuery,
} from "@/lib/archive/evidence/api";
import {
  getEvidenceHistoryView,
  getValidationRevisions,
} from "@/lib/archive/evidence/service";
import { verifyAllValidationChains } from "@/lib/validation/integrity";
import { currentValidationRevisions } from "@/lib/validation/records";
import { isScoredValidationState } from "@/lib/validation/states";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/evidence/validation?fixtureId=123[&limit=50][&locale=en]
 *
 * Validation records for a fixture, with every revision retained.
 *
 * `totals.scored` counts only `won` / `lost`. The four unscored terminal states — void,
 * cancelled, postponed, abandoned — are reported separately rather than folded into a
 * hit rate, so a consumer cannot accidentally read them as losses.
 */
export async function GET(req: NextRequest) {
  const parsed = parseEvidenceQuery(req.nextUrl.searchParams);
  if (!parsed.ok) return evidenceApiResponse(parsed.body, parsed.status);

  const { fixtureId, limit, locale } = parsed.query;

  const [view, revisions] = await Promise.all([
    getEvidenceHistoryView(fixtureId, { limit, locale }),
    getValidationRevisions(fixtureId, { limit }),
  ]);

  const subjects = view.snapshots.flatMap((snapshot) => snapshot.validations);
  const current = [...currentValidationRevisions(revisions).values()];

  return evidenceApiResponse({
    fixtureId,
    available: subjects.length > 0,
    subjects,
    totals: {
      subjects: current.length,
      revisions: revisions.length,
      corrected: current.filter((record) => record.revision > 1).length,
      pending: current.filter((record) => record.state === "pending").length,
      scored: current.filter((record) => isScoredValidationState(record.state)).length,
    },
    integrity: verifyAllValidationChains(revisions),
  });
}

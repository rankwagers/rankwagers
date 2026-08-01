/**
 * Link helpers for the evidence archive (Sprint 23).
 *
 * Browser-safe apart from `evidenceHistoryUrl`, which needs the configured site origin.
 * Sprint 23 adds no route of its own — every link points at the existing fixture page
 * plus a fragment, which keeps the indexable URL set unchanged.
 */

import { fixturePath } from "@/lib/fixtures/paths";
import { siteUrl } from "@/lib/seo";

/** DOM id of the Evidence History section — also the deep-link fragment. */
export const EVIDENCE_HISTORY_ANCHOR = "evidence-history";

/** Relative path to a fixture's evidence history. */
export function evidenceHistoryPath(locale: string, fixtureId: number): string {
  return `${fixturePath(locale, fixtureId)}#${EVIDENCE_HISTORY_ANCHOR}`;
}

/** Absolute URL to a fixture's evidence history. */
export function evidenceHistoryUrl(locale: string, fixtureId: number): string {
  return `${siteUrl()}${evidenceHistoryPath(locale, fixtureId)}`;
}

/** Internal API paths, so callers never hand-build query strings. */
export function evidenceApiPaths(fixtureId: number) {
  const qs = `?fixtureId=${fixtureId}`;
  return {
    history: `/api/evidence/history${qs}`,
    latest: `/api/evidence/latest${qs}`,
    validation: `/api/evidence/validation${qs}`,
  };
}

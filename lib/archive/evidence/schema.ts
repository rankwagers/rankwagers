/**
 * Structured data for the evidence archive (Sprint 23).
 *
 * URL POLICY: the Evidence History section renders on the EXISTING fixture URL. Sprint
 * 23 introduces no new indexable route, so there is no duplicate-URL surface and no
 * canonical to declare — the fixture page's own canonical already covers it. The anchor
 * below is a fragment, which search engines treat as the same URL.
 *
 * `Dataset` is used deliberately: a fixture's evidence archive is a versioned,
 * timestamped measurement series, which is exactly what `Dataset` describes. It is not
 * a rich-result type, so it makes an accurate claim without competing with the
 * `SportsEvent` markup the fixture page already emits.
 *
 * Emitted only when history actually exists — never assert a dataset that is empty.
 */

import { siteUrl } from "@/lib/seo";
import type { EvidenceHistoryView } from "@/types/evidence";
import { evidenceHistoryUrl } from "./links";

export function evidenceHistoryDatasetLd(input: {
  locale: string;
  fixtureId: number;
  fixtureName: string;
  view: EvidenceHistoryView;
}): Record<string, unknown> | null {
  const { view } = input;
  if (!view.available || !view.snapshots.length) return null;

  const temporalCoverage =
    view.firstCapturedAt && view.lastCapturedAt
      ? `${view.firstCapturedAt}/${view.lastCapturedAt}`
      : undefined;

  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: `Evidence history — ${input.fixtureName}`,
    description:
      "Immutable, append-only archive of evidence snapshots and prediction validation records captured for this fixture.",
    url: evidenceHistoryUrl(input.locale, input.fixtureId),
    isAccessibleForFree: true,
    creator: {
      "@type": "Organization",
      name: "RankWagers",
      url: siteUrl(),
    },
    ...(temporalCoverage ? { temporalCoverage } : {}),
    ...(view.lastCapturedAt ? { dateModified: view.lastCapturedAt } : {}),
    variableMeasured: [
      { "@type": "PropertyValue", name: "evidenceScore" },
      { "@type": "PropertyValue", name: "qualification" },
      { "@type": "PropertyValue", name: "validationState" },
      { "@type": "PropertyValue", name: "modelVersion" },
    ],
  };
}

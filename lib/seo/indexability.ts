/**
 * Quality-gated indexability policy for discovery surfaces.
 * Prefer noindex over thin / doorway pages.
 */

import type { IndexabilityVerdict } from "@/lib/knowledge-graph/contracts";

export function searchResultsIndexability(): IndexabilityVerdict {
  return {
    indexable: false,
    reason: "search_results_page",
    notes: ["Search result pages stay noindex to prevent thin duplicate SERPs."],
  };
}

export function countryLandingIndexability(input: {
  hasProfile: boolean;
  competitionCount: number;
  operatorCount: number;
  uniqueSummaryLength: number;
  fixtureSampleCount: number;
}): IndexabilityVerdict {
  const notes: string[] = [];
  if (!input.hasProfile) {
    return {
      indexable: false,
      reason: "incomplete_entity",
      notes: ["Country profile is not configured."],
    };
  }
  if (input.competitionCount < 1) {
    notes.push("No registry competitions resolved from profile leagues.");
  }
  if (input.operatorCount < 1) {
    notes.push("No affiliate-enabled operators available for this country.");
  }
  if (input.uniqueSummaryLength < 80) {
    notes.push("Summary copy is too short for unique landing value.");
  }
  if (input.competitionCount < 1 || input.operatorCount < 1 || input.uniqueSummaryLength < 80) {
    return {
      indexable: false,
      reason: notes.some((n) => n.includes("Summary"))
        ? "thin_content"
        : "missing_unique_value",
      notes,
    };
  }
  // Doorway risk: country page with only a single competition and no fixtures/operators depth
  if (input.competitionCount === 1 && input.operatorCount < 2 && input.fixtureSampleCount === 0) {
    return {
      indexable: false,
      reason: "doorway_risk",
      notes: [
        "Insufficient unique depth — would risk a thin geo doorway page.",
        ...notes,
      ],
    };
  }
  return {
    indexable: true,
    reason: "ok",
    notes: [
      `${input.competitionCount} competitions`,
      `${input.operatorCount} operators`,
      `${input.fixtureSampleCount} fixture samples`,
    ],
  };
}

export function entityPageIndexability(input: {
  hasTitle: boolean;
  hasDescription: boolean;
  relatedCount: number;
  contentBlocks: number;
}): IndexabilityVerdict {
  if (!input.hasTitle || !input.hasDescription) {
    return {
      indexable: false,
      reason: "incomplete_entity",
      notes: ["Missing title or description."],
    };
  }
  if (input.contentBlocks < 1 && input.relatedCount < 1) {
    return {
      indexable: false,
      reason: "thin_content",
      notes: ["No content blocks or related entities."],
    };
  }
  return { indexable: true, reason: "ok", notes: [] };
}

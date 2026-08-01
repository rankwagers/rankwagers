/**
 * Thin-content detection — structural/factual signals, not word-count filler rewards.
 */

export type ThinSignalCode =
  | "missing_primary_entity"
  | "no_published_prediction"
  | "no_evidence"
  | "no_archive_value"
  | "too_few_fixtures"
  | "boilerplate_only"
  | "missing_unique_metadata"
  | "empty_tables"
  | "placeholder_values"
  | "unsupported_statistics"
  | "weak_internal_links"
  | "excessive_overlap";

export type ThinAssessment = {
  signals: ThinSignalCode[];
  thin: boolean;
  notes: string[];
};

export function assessThinContent(input: {
  hasPrimaryEntity: boolean;
  hasPublishedPrediction: boolean;
  hasEvidence: boolean;
  hasArchiveValue: boolean;
  fixtureCount: number;
  hasUniqueMetadata: boolean;
  emptyTables: boolean;
  placeholderValues: boolean;
  inboundLinks: number;
  boilerplateOnly?: boolean;
}): ThinAssessment {
  const signals: ThinSignalCode[] = [];
  if (!input.hasPrimaryEntity) signals.push("missing_primary_entity");
  if (!input.hasPublishedPrediction && !input.hasArchiveValue) {
    signals.push("no_published_prediction");
  }
  if (!input.hasEvidence && !input.hasArchiveValue) signals.push("no_evidence");
  if (!input.hasArchiveValue && input.fixtureCount === 0) {
    signals.push("no_archive_value");
  }
  if (input.fixtureCount > 0 && input.fixtureCount < 2) {
    signals.push("too_few_fixtures");
  }
  if (!input.hasUniqueMetadata) signals.push("missing_unique_metadata");
  if (input.emptyTables) signals.push("empty_tables");
  if (input.placeholderValues) signals.push("placeholder_values");
  if (input.inboundLinks < 1) signals.push("weak_internal_links");
  if (input.boilerplateOnly) signals.push("boilerplate_only");

  return {
    signals,
    thin: signals.length >= 2,
    notes: signals.map((s) => s.replace(/_/g, " ")),
  };
}

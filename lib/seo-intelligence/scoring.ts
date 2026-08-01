import type {
  IndexabilityDecision,
  QualityComponent,
  QualityScore,
} from "./contracts";

export type ScoringInput = {
  decision: IndexabilityDecision;
  hasPrimaryEntity: boolean;
  hasTitle: boolean;
  hasDescription: boolean;
  factualBlocks: number;
  hasEvidence: boolean;
  hasArchiveValue: boolean;
  schemaOk: boolean | null;
  inboundLinks: number;
  freshnessOk: boolean | null;
  duplicateRisk: boolean;
  thinSignals: number;
  invalidState: boolean;
};

function clamp(n: number, max: number): number {
  return Math.max(0, Math.min(max, n));
}

/** Explainable quality score — never overrides hard NOINDEX/REDIRECT/EXCLUDED/ERROR. */
export function scoreUrlQuality(input: ScoringInput): QualityScore {
  const components: QualityComponent[] = [
    {
      id: "entity_completeness",
      label: "Primary entity completeness",
      max: 15,
      score: input.hasPrimaryEntity ? 15 : 0,
      notes: input.hasPrimaryEntity ? [] : ["Missing primary entity"],
    },
    {
      id: "factual_content",
      label: "Unique factual content",
      max: 15,
      score: clamp(input.factualBlocks * 5, 15),
      notes: input.factualBlocks < 1 ? ["No factual blocks counted"] : [],
    },
    {
      id: "evidence_presence",
      label: "Published evidence",
      max: 10,
      score: input.hasEvidence ? 10 : 0,
      notes: input.hasEvidence ? [] : ["No evidence signal"],
    },
    {
      id: "archive_value",
      label: "Settlement / archive value",
      max: 10,
      score: input.hasArchiveValue ? 10 : 0,
      notes: [],
    },
    {
      id: "metadata_completeness",
      label: "Metadata completeness",
      max: 10,
      score: (input.hasTitle ? 5 : 0) + (input.hasDescription ? 5 : 0),
      notes: [],
    },
    {
      id: "schema_validity",
      label: "Schema validity",
      max: 10,
      score:
        input.schemaOk == null ? null : input.schemaOk ? 10 : 2,
      notes: input.schemaOk === false ? ["Schema validation failed"] : [],
    },
    {
      id: "internal_links",
      label: "Internal-link support",
      max: 10,
      score: clamp(input.inboundLinks >= 3 ? 10 : input.inboundLinks * 3, 10),
      notes: input.inboundLinks === 0 ? ["Orphan / near-orphan risk"] : [],
    },
    {
      id: "freshness",
      label: "Freshness",
      max: 10,
      score: input.freshnessOk == null ? null : input.freshnessOk ? 10 : 4,
      notes: [],
    },
    {
      id: "duplicate_penalty",
      label: "Duplicate-risk penalty",
      max: 0,
      score: input.duplicateRisk ? -10 : 0,
      notes: input.duplicateRisk ? ["Duplicate metadata risk"] : [],
    },
    {
      id: "thin_penalty",
      label: "Thin-content penalty",
      max: 0,
      score: input.thinSignals >= 2 ? -15 : input.thinSignals === 1 ? -5 : 0,
      notes: input.thinSignals ? [`thinSignals=${input.thinSignals}`] : [],
    },
    {
      id: "invalid_state_penalty",
      label: "Invalid-state penalty",
      max: 0,
      score: input.invalidState ? -20 : 0,
      notes: input.invalidState ? ["Invalid page state"] : [],
    },
  ];

  const scored = components.filter((c) => c.score != null);
  const total = scored.reduce((sum, c) => sum + (c.score as number), 0);
  const max = 90;
  const hardBlock =
    input.decision === "NOINDEX" ||
    input.decision === "EXCLUDED" ||
    input.decision === "REDIRECT" ||
    input.decision === "ERROR";

  return {
    total: Math.max(0, Math.min(100, Math.round(total))),
    max,
    components,
    overriddenByIndexability: hardBlock,
  };
}

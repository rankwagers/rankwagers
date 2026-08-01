import type { AccaBuilderCandidate } from "./contracts";

/** Factual evidence completeness 0–100 from published fields only. */
export function computeEvidenceCompleteness(input: {
  hasCompetition: boolean;
  hasCountry: boolean;
  confidence: number;
  hasOdds: boolean;
}): number {
  return Math.min(
    100,
    40 +
      (input.hasCompetition ? 15 : 0) +
      (input.hasCountry ? 10 : 0) +
      (input.confidence >= 60 ? 20 : 10) +
      (input.hasOdds ? 15 : 0)
  );
}

export function evidenceLinesForCandidate(
  candidate: AccaBuilderCandidate
): string[] {
  return [
    ...candidate.evidenceSummary,
    `Eligibility: ${candidate.eligible ? "passed" : "excluded"}`,
    ...(candidate.exclusionReasons.length
      ? [`Exclusion reasons: ${candidate.exclusionReasons.join(", ")}`]
      : []),
  ];
}

/**
 * Evidence qualification — whether a snapshot's evidence was strong enough to publish.
 *
 * Pure and browser-safe. Qualification is stored on the snapshot rather than recomputed
 * at read time: the archive must show what was decided then, not what today's
 * thresholds would decide.
 */

import type { EvidenceQualification } from "@/types/evidence";
import {
  EVIDENCE_MIN_SAMPLE_SIZE,
  EVIDENCE_QUALIFICATION_THRESHOLDS,
} from "./constants";
import { normalizeEvidenceScore } from "./score";

export const EVIDENCE_QUALIFICATIONS: readonly EvidenceQualification[] = [
  "qualified",
  "provisional",
  "unqualified",
  "excluded",
] as const;

export const EVIDENCE_QUALIFICATION_LABELS: Record<EvidenceQualification, string> = {
  qualified: "Qualified",
  provisional: "Provisional",
  unqualified: "Not qualified",
  excluded: "Excluded",
};

export const EVIDENCE_QUALIFICATION_DESCRIPTIONS: Record<
  EvidenceQualification,
  string
> = {
  qualified: "Met every publication rule at capture time.",
  provisional: "Met the score threshold but not the full sample requirement.",
  unqualified: "Did not meet the publication threshold at capture time.",
  excluded: "Ruled out by a hard filter regardless of score.",
};

export function isEvidenceQualification(
  value: unknown
): value is EvidenceQualification {
  return (
    typeof value === "string" &&
    (EVIDENCE_QUALIFICATIONS as readonly string[]).includes(value)
  );
}

export function qualificationLabel(value: EvidenceQualification): string {
  return EVIDENCE_QUALIFICATION_LABELS[value];
}

export function qualificationDescription(value: EvidenceQualification): string {
  return EVIDENCE_QUALIFICATION_DESCRIPTIONS[value];
}

/** Sort weight — higher is stronger. Stable ordering for tables and aggregations. */
export function qualificationRank(value: EvidenceQualification): number {
  switch (value) {
    case "qualified":
      return 3;
    case "provisional":
      return 2;
    case "unqualified":
      return 1;
    case "excluded":
      return 0;
  }
}

/**
 * Derive a qualification from score and sample size.
 *
 * `excluded` is never derived — it is an explicit decision by a hard filter upstream
 * and must be passed in by the caller that applied the filter.
 */
export function deriveQualification(input: {
  evidenceScore: number;
  sampleSize: number;
}): EvidenceQualification {
  const score = normalizeEvidenceScore(input.evidenceScore);
  const sufficientSample = input.sampleSize >= EVIDENCE_MIN_SAMPLE_SIZE;
  if (score >= EVIDENCE_QUALIFICATION_THRESHOLDS.qualified) {
    return sufficientSample ? "qualified" : "provisional";
  }
  if (score >= EVIDENCE_QUALIFICATION_THRESHOLDS.provisional && sufficientSample) {
    return "provisional";
  }
  return "unqualified";
}

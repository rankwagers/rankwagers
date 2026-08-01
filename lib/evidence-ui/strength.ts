import type { EvidenceStrength } from "./types";
import { EVIDENCE_STRENGTH_LABELS } from "./types";

export type StrengthInput = {
  sampleSize: number;
  coveragePercent: number | null;
  qualified?: boolean;
  providerComplete?: boolean;
};

/**
 * Deterministic Evidence Strength — no ML.
 * Very Strong: sample ≥ 20 and coverage ≥ 85% and qualified
 * Strong: sample ≥ 12 and coverage ≥ 70%
 * Moderate: sample ≥ 6 and coverage ≥ 50%
 * Limited: sample ≥ 3
 * Insufficient: sample < 3 or missing provider fields
 */
export function resolveEvidenceStrength(input: StrengthInput): EvidenceStrength {
  const sample = Math.max(0, Math.floor(input.sampleSize));
  const coverage = input.coveragePercent;
  const providerComplete = input.providerComplete !== false;
  const qualified = input.qualified !== false;

  if (!providerComplete || sample < 3) return "insufficient";

  if (sample >= 20 && (coverage ?? 0) >= 85 && qualified) return "very_strong";
  if (sample >= 12 && (coverage ?? 0) >= 70) return "strong";
  if (sample >= 6 && (coverage ?? 0) >= 50) return "moderate";
  if (sample >= 3) return "limited";
  return "insufficient";
}

export function evidenceStrengthLabel(strength: EvidenceStrength): string {
  return EVIDENCE_STRENGTH_LABELS[strength];
}

/** Map legacy entity sampleQuality enums into a sample-size proxy for strength. */
export function sampleSizeProxyFromLegacyQuality(
  quality: "none" | "very-limited" | "limited" | "adequate" | string
): number {
  switch (quality) {
    case "adequate":
      return 12;
    case "limited":
      return 5;
    case "very-limited":
      return 2;
    case "none":
      return 0;
    default:
      return 0;
  }
}

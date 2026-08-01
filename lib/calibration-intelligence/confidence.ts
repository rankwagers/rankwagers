import type { ConfidenceNormalized, ConfidenceSemantics } from "./contracts";
import { CONFIDENCE_NORMALIZATION_VERSION } from "./contracts";

/**
 * Archive confidence is stored as 0–100 "Model probability at list qualification".
 * Treated as PROVIDER_PERCENTAGE / CALIBRATABLE_PROBABILITY for metric eligibility.
 * Does NOT mean the value is a well-calibrated true probability.
 */
export function classifyConfidenceSemantics(): ConfidenceSemantics {
  return "CALIBRATABLE_PROBABILITY";
}

export function normalizeConfidence(
  raw: number | null | undefined,
  source = "archive.confidence",
): ConfidenceNormalized {
  const semantics = classifyConfidenceSemantics();
  if (raw == null || !Number.isFinite(raw)) {
    return {
      rawValue: null,
      rawSource: source,
      normalized0to1: null,
      normalized0to100: null,
      semantics: "UNKNOWN_SEMANTICS",
      normalizationVersion: CONFIDENCE_NORMALIZATION_VERSION,
    };
  }
  // Archive uses 0–100 scale
  const as100 = Math.max(0, Math.min(100, raw));
  return {
    rawValue: raw,
    rawSource: source,
    normalized0to1: as100 / 100,
    normalized0to100: as100,
    semantics,
    normalizationVersion: CONFIDENCE_NORMALIZATION_VERSION,
  };
}

export function isProbabilistic(semantics: ConfidenceSemantics): boolean {
  return semantics === "CALIBRATABLE_PROBABILITY" || semantics === "PROVIDER_PERCENTAGE";
}

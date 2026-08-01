import type { PredictionStrings } from "./predictionsEn";
import { predictionsEn } from "./predictionsEn";

export function mergePredictions(
  overrides: Partial<PredictionStrings>
): PredictionStrings {
  return { ...predictionsEn, ...overrides };
}

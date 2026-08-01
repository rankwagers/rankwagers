import { combinedDecimalOdds } from "./odds";
import type { AccaRiskAssessment, AccaRiskClass, AccaSelection } from "./types";

const LABELS: Record<AccaRiskClass, string> = {
  low_risk: "Low Risk",
  balanced: "Balanced",
  aggressive: "Aggressive",
  very_aggressive: "Very Aggressive",
};

/**
 * Explainable risk from legs, combined odds, and average confidence.
 * Never AI-generated — deterministic thresholds only.
 */
export function assessAccaRisk(
  selections: readonly AccaSelection[]
): AccaRiskAssessment {
  const limitations = [
    "Risk class is a research heuristic, not a bookmaker rating.",
    "It does not predict outcomes or guarantee returns.",
  ];

  if (!selections.length) {
    return {
      class: "balanced",
      label: LABELS.balanced,
      reasons: ["No selections yet."],
      averageConfidence: null,
      limitations,
    };
  }

  const confidences = selections
    .map((s) => s.confidence)
    .filter((c): c is number => c != null && Number.isFinite(c));
  const averageConfidence = confidences.length
    ? Math.round(
        confidences.reduce((a, b) => a + b, 0) / confidences.length
      )
    : null;

  const { combinedOdds, oddsComplete, missingOddsCount } =
    combinedDecimalOdds(selections);
  const legs = selections.length;
  const reasons: string[] = [];

  let score = 0;
  if (legs >= 5) {
    score += 3;
    reasons.push(`${legs} legs increases correlation and variance.`);
  } else if (legs >= 4) {
    score += 2;
    reasons.push(`${legs} legs — moderately long Acca.`);
  } else if (legs === 3) {
    score += 1;
    reasons.push("Three-leg Acca.");
  } else {
    reasons.push(`${legs} selection${legs === 1 ? "" : "s"}.`);
  }

  if (combinedOdds != null) {
    if (combinedOdds >= 12) {
      score += 3;
      reasons.push(`Combined odds ${combinedOdds.toFixed(2)} are high.`);
    } else if (combinedOdds >= 6) {
      score += 2;
      reasons.push(`Combined odds ${combinedOdds.toFixed(2)}.`);
    } else if (combinedOdds >= 3) {
      score += 1;
      reasons.push(`Combined odds ${combinedOdds.toFixed(2)}.`);
    } else {
      reasons.push(`Combined odds ${combinedOdds.toFixed(2)} stay relatively contained.`);
    }
  }

  if (averageConfidence != null) {
    if (averageConfidence < 55) {
      score += 2;
      reasons.push(`Average model probability ${averageConfidence}% is modest.`);
    } else if (averageConfidence < 65) {
      score += 1;
      reasons.push(`Average model probability ${averageConfidence}%.`);
    } else {
      reasons.push(`Average model probability ${averageConfidence}%.`);
      score -= 1;
    }
  } else {
    reasons.push("Confidence unavailable for one or more legs.");
  }

  if (!oddsComplete) {
    score += 1;
    reasons.push(`Odds missing on ${missingOddsCount} leg(s) — risk incomplete.`);
  }

  let riskClass: AccaRiskClass;
  if (score <= 1) riskClass = "low_risk";
  else if (score <= 3) riskClass = "balanced";
  else if (score <= 5) riskClass = "aggressive";
  else riskClass = "very_aggressive";

  return {
    class: riskClass,
    label: LABELS[riskClass],
    reasons,
    averageConfidence,
    limitations,
  };
}

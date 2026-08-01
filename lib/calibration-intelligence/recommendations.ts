import type { CalibrationIssue } from "./contracts";

export type ReviewRecommendation = {
  id: string;
  title: string;
  cohort: string;
  evidenceLinkedIssueCodes: string[];
  sampleAware: true;
  automatic: false;
  reviewRequired: true;
  guidance: string;
};

export function buildRecommendations(
  issues: CalibrationIssue[],
): ReviewRecommendation[] {
  const out: ReviewRecommendation[] = [];
  for (const issue of issues) {
    if (issue.severity === "INFO" && issue.sampleSize < 20) {
      out.push({
        id: `rec-${issue.code}`,
        title: "Suspend interpretation due to insufficient data",
        cohort: issue.cohort,
        evidenceLinkedIssueCodes: [issue.code],
        sampleAware: true,
        automatic: false,
        reviewRequired: true,
        guidance: issue.remediation,
      });
      continue;
    }
    if (issue.code === "SEVERE_OVERCONFIDENCE" || issue.code === "CALIBRATION_INVERSION") {
      out.push({
        id: `rec-${issue.code}-${issue.cohort}`,
        title: "Review confidence threshold / band interpretation for cohort",
        cohort: issue.cohort,
        evidenceLinkedIssueCodes: [issue.code],
        sampleAware: true,
        automatic: false,
        reviewRequired: true,
        guidance:
          "Do not auto-tune. Inspect market mix and sample gates before any config change.",
      });
    }
    if (issue.code === "BUILDER_MODE_CONFIGURATION_DRIFT") {
      out.push({
        id: "rec-mode-separation",
        title: "Review Builder mode separation",
        cohort: "builder_modes",
        evidenceLinkedIssueCodes: [issue.code],
        sampleAware: true,
        automatic: false,
        reviewRequired: true,
        guidance: issue.remediation,
      });
    }
    if (issue.code === "BUILDER_COMBINATION_SNAPSHOTS_MISSING") {
      out.push({
        id: "rec-persist-snapshots",
        title: "Inspect persistence gap for Builder generation snapshots",
        cohort: "builder",
        evidenceLinkedIssueCodes: [issue.code],
        sampleAware: true,
        automatic: false,
        reviewRequired: true,
        guidance: issue.remediation,
      });
    }
  }
  return out;
}

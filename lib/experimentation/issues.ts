import type { IssueSeverity, SrmStatus } from "./contracts";

export type ExperimentIssue = {
  code: string;
  severity: IssueSeverity;
  experimentId: string;
  experimentVersion: string;
  explanation: string;
  evidence: string;
  timestamp: string;
  remediation: string;
  status: "open" | "acknowledged";
};

export function buildIssues(input: {
  experimentId: string;
  experimentVersion: string;
  srmStatus: SrmStatus;
  missingPrimary: boolean;
  guardrailBreach: boolean;
  insufficientSample: boolean;
  definitionEditedWhileRunning: boolean;
  previewMixed: boolean;
  exposureMissing: boolean;
  runtimeDays: number;
  minRuntimeDays: number;
  prematureWinnerClaim: boolean;
}): ExperimentIssue[] {
  const now = new Date().toISOString();
  const issues: ExperimentIssue[] = [];
  const push = (
    code: string,
    severity: IssueSeverity,
    explanation: string,
    evidence: string,
    remediation: string,
  ) => {
    issues.push({
      code,
      severity,
      experimentId: input.experimentId,
      experimentVersion: input.experimentVersion,
      explanation,
      evidence,
      timestamp: now,
      remediation,
      status: "open",
    });
  };

  if (input.missingPrimary) {
    push(
      "MISSING_PRIMARY_METRIC",
      "CRITICAL",
      "Experiment lacks a valid primary metric",
      "definition.primaryMetricId",
      "Assign a registered primary metric before review",
    );
  }
  if (input.srmStatus === "MATERIAL_SRM") {
    push(
      "MATERIAL_SRM",
      "CRITICAL",
      "Observed exposure allocation materially differs from expected weights",
      `srm=${input.srmStatus}`,
      "Do not declare a winner; investigate assignment/exposure integrity",
    );
  }
  if (input.guardrailBreach) {
    push(
      "GUARDRAIL_BREACH",
      "CRITICAL",
      "Critical guardrail metric deteriorated",
      "guardrail evaluation",
      "STOP_FOR_HARM — manual review required",
    );
  }
  if (input.insufficientSample) {
    push(
      "INSUFFICIENT_SAMPLE",
      "HIGH",
      "Sample below minimum per variant",
      "sampleStatus=INSUFFICIENT",
      "Continue or pause — do not claim uplift",
    );
  }
  if (input.definitionEditedWhileRunning) {
    push(
      "DEFINITION_EDITED_AFTER_ACTIVATION",
      "CRITICAL",
      "Definition mutation attempted while RUNNING",
      "immutable definition rule",
      "Create a new experiment version",
    );
  }
  if (input.previewMixed) {
    push(
      "PREVIEW_TRAFFIC_MIXED",
      "HIGH",
      "Preview/test traffic mixed into analysis cohort",
      "preview=true records present in primary analysis",
      "Exclude preview from analysis snapshots",
    );
  }
  if (input.exposureMissing) {
    push(
      "MISSING_EXPOSURE_LOGGING",
      "HIGH",
      "Assignment without meaningful exposure logging",
      "exposures=0 while assignments calculated",
      "Verify render-path exposure hooks",
    );
  }
  if (
    input.prematureWinnerClaim ||
    input.runtimeDays < input.minRuntimeDays
  ) {
    if (input.prematureWinnerClaim) {
      push(
        "RESULT_BEFORE_MINIMUM_RUNTIME",
        "HIGH",
        "Result interpreted before minimum runtime",
        `runtimeDays=${input.runtimeDays} < min=${input.minRuntimeDays}`,
        "Wait for minimum runtime before analysis claims",
      );
    }
  }
  return issues;
}

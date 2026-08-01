import type { BandMetrics, CalibrationIssue, IssueSeverity } from "./contracts";
import type { ModeOrderingValidation } from "./builder-evaluation";
import type { DriftStatus } from "./contracts";

export function buildCalibrationIssues(input: {
  totalPublished: number;
  settledWl: number;
  unresolvedRate: number | null;
  semanticsUnknown: boolean;
  bands: BandMetrics[];
  inversions: Array<{ higher: string; lower: string; gap: number }>;
  overallGap: number | null;
  modeOrdering: ModeOrderingValidation;
  driftStatus: DriftStatus;
  snapshotImmutability: string;
  builderSnapshotsMissing: boolean;
  oddsMissing: boolean;
}): CalibrationIssue[] {
  const now = new Date().toISOString();
  const issues: CalibrationIssue[] = [];

  const push = (
    code: string,
    severity: IssueSeverity,
    cohort: string,
    explanation: string,
    sampleSize: number,
    remediation: string,
  ) => {
    issues.push({
      code,
      severity,
      cohort,
      explanation,
      sampleSize,
      remediation,
      detectedAt: now,
      status: "open",
    });
  };

  if (input.snapshotImmutability !== "append_only") {
    push(
      "PUBLICATION_SNAPSHOT_MUTABLE",
      "HIGH",
      "all",
      "Daily archives are overwrite-mutable; primary calibration uses best-effort archive rows, not append-only publication freeze.",
      input.totalPublished,
      "Introduce immutable publication snapshots before treating calibration as production-grade.",
    );
  }

  if (input.semanticsUnknown) {
    push(
      "CONFIDENCE_SEMANTICS_UNKNOWN",
      "CRITICAL",
      "all",
      "Confidence semantics could not be classified; probability metrics must not be shown.",
      input.totalPublished,
      "Document and normalize confidence via typed adapters.",
    );
  }

  if (input.builderSnapshotsMissing) {
    push(
      "BUILDER_COMBINATION_SNAPSHOTS_MISSING",
      "HIGH",
      "builder",
      "Durable Builder generation/combination snapshots are not persisted; combination settlement and exclusion counterfactuals are Unavailable.",
      0,
      "Persist generation-time candidate and combination snapshots for evaluation.",
    );
  }

  if (input.oddsMissing) {
    push(
      "ODDS_DEPENDENT_METRIC_UNAVAILABLE",
      "MEDIUM",
      "all",
      "Publication odds are null in archives; ROI/return metrics are Unavailable.",
      input.totalPublished,
      "Archive publication-time odds before enabling financial metrics.",
    );
  }

  if (input.unresolvedRate != null && input.unresolvedRate > 0.35 && input.totalPublished >= 20) {
    push(
      "EXCESSIVE_UNRESOLVED",
      "MEDIUM",
      "all",
      `Unresolved/pending rate ${(input.unresolvedRate * 100).toFixed(1)}% exceeds 35%.`,
      input.totalPublished,
      "Inspect settlement linkage and fixture status handling.",
    );
  }

  if (input.overallGap != null && input.overallGap > 0.12 && input.settledWl >= 50) {
    push(
      "SEVERE_OVERCONFIDENCE",
      "HIGH",
      "all",
      `Overall calibration gap ${input.overallGap.toFixed(3)} (confidence − observed) indicates overconfidence.`,
      input.settledWl,
      "Review confidence bands and market cohorts; do not auto-tune thresholds.",
    );
  }

  if (input.overallGap != null && input.overallGap < -0.12 && input.settledWl >= 50) {
    push(
      "SEVERE_UNDERCONFIDENCE",
      "HIGH",
      "all",
      `Overall calibration gap ${input.overallGap.toFixed(3)} indicates underconfidence.`,
      input.settledWl,
      "Review confidence assignment; do not auto-tune.",
    );
  }

  for (const inv of input.inversions) {
    push(
      "CALIBRATION_INVERSION",
      "HIGH",
      `bands:${inv.higher}->${inv.lower}`,
      `Higher band ${inv.higher} underperforms lower band ${inv.lower} by ${(inv.gap * 100).toFixed(1)} pp (sample-gated).`,
      input.settledWl,
      "Inspect market mix within bands before changing rules.",
    );
  }

  if (input.modeOrdering.status === "CONFIG_DRIFT") {
    push(
      "BUILDER_MODE_CONFIGURATION_DRIFT",
      "CRITICAL",
      "builder_modes",
      input.modeOrdering.findings.join(" "),
      0,
      "Align RISK_MODE_RULES with documented mode ordering; review required.",
    );
  }

  if (input.driftStatus === "MATERIAL_CHANGE") {
    push(
      "MATERIAL_DRIFT",
      "MEDIUM",
      "recent_vs_prior",
      "Hit-rate or calibration-gap drift classified MATERIAL_CHANGE.",
      input.settledWl,
      "Compare recent vs prior windows; do not auto-adjust.",
    );
  }

  if (input.settledWl < 20 && input.totalPublished > 0) {
    push(
      "INSUFFICIENT_DATA_FOR_CLAIMED_METRIC",
      "INFO",
      "all",
      "Settled W+L sample below reliable gates for overall calibration claims.",
      input.settledWl,
      "Wait for more settlements; show INSUFFICIENT sample status.",
    );
  }

  return issues;
}

export function filterIssues(
  issues: CalibrationIssue[],
  opts: { severity?: string | null; offset: number; limit: number },
): { items: CalibrationIssue[]; total: number } {
  let items = issues;
  if (opts.severity) {
    items = items.filter((i) => i.severity === opts.severity);
  }
  const total = items.length;
  return {
    items: items.slice(opts.offset, opts.offset + opts.limit),
    total,
  };
}

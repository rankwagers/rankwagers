/**
 * Calibration Intelligence contracts (Sprint 24).
 * Immutable evaluation principle documented; archives are best-effort publication proxies.
 */

export type ConfidenceSemantics =
  | "SCORE"
  | "RANKING_SIGNAL"
  | "PROVIDER_PERCENTAGE"
  | "CALIBRATABLE_PROBABILITY"
  | "UNKNOWN_SEMANTICS";

export type SampleStatus =
  | "INSUFFICIENT"
  | "EARLY_SIGNAL"
  | "REVIEWABLE"
  | "RELIABLE";

export type CapabilityStatus =
  | "fully_supported"
  | "partial"
  | "unavailable"
  | "statistically_unsafe";

export type DriftStatus =
  | "STABLE"
  | "WATCH"
  | "MATERIAL_CHANGE"
  | "INSUFFICIENT_DATA";

export type CombinationSettlement =
  | "WON"
  | "LOST"
  | "VOID"
  | "PARTIAL_VOID"
  | "PENDING"
  | "UNRESOLVED"
  | "INVALID";

export type IssueSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";

export type CalibrationSection =
  | "overview"
  | "confidence"
  | "markets"
  | "leagues"
  | "predictions"
  | "builder"
  | "combinations"
  | "exclusions"
  | "cohorts"
  | "issues"
  | "methodology";

export type CalibrationFilters = {
  from: string | null;
  to: string | null;
  market: string | null;
  competition: string | null;
  country: string | null;
  riskMode: string | null;
  q: string | null;
  offset: number;
  limit: number;
  dateLimit: number;
};

export type CapabilityRow = {
  analysis: string;
  status: CapabilityStatus;
  blockingReason: string | null;
  source: string;
};

export type ConfidenceNormalized = {
  rawValue: number | null;
  rawSource: string;
  normalized0to1: number | null;
  normalized0to100: number | null;
  semantics: ConfidenceSemantics;
  normalizationVersion: string;
};

export type BandMetrics = {
  band: string;
  published: number;
  settled: number;
  won: number;
  lost: number;
  voided: number;
  observedRate: number | null;
  averageConfidence: number | null;
  calibrationGap: number | null;
  sampleStatus: SampleStatus;
};

export type CohortMetrics = {
  cohortId: string;
  definition: string;
  published: number;
  settled: number;
  won: number;
  lost: number;
  voided: number;
  pending: number;
  hitRate: number | null;
  averageConfidence: number | null;
  calibrationGap: number | null;
  brierScore: number | null;
  logLoss: number | null;
  ece: number | null;
  mce: number | null;
  sampleStatus: SampleStatus;
  notes: string[];
};

export type CalibrationIssue = {
  code: string;
  severity: IssueSeverity;
  cohort: string;
  explanation: string;
  sampleSize: number;
  remediation: string;
  detectedAt: string;
  status: "open" | "acknowledged";
};

export type CalibrationOverview = {
  generatedAt: string;
  methodologyVersion: string;
  normalizationVersion: string;
  totalPublished: number;
  settled: number;
  calibrationEligible: number;
  confidenceSemantics: ConfidenceSemantics;
  overallHitRate: number | null;
  overallAverageConfidence: number | null;
  overallCalibrationGap: number | null;
  brierScore: number | null;
  unresolvedRate: number | null;
  reliableCohorts: number;
  insufficientCohorts: number;
  builderGenerations: number | null;
  settledBuilderLegs: number | null;
  settledCombinations: number | null;
  modeOrderingStatus: string;
  driftStatus: DriftStatus;
  criticalIssues: number;
  highIssues: number;
  lastEvaluationAt: string;
  notes: string[];
};

export const CALIBRATION_METHODOLOGY_VERSION = "24.0.0";
export const CONFIDENCE_NORMALIZATION_VERSION = "24.0.0-pct100";
export const CALIBRATION_EXPORT_MAX_ROWS = 2_000;
export const CALIBRATION_DEFAULT_PAGE_SIZE = 50;
export const CALIBRATION_MAX_PAGE_SIZE = 200;

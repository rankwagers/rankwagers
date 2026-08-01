/**
 * Experimentation platform contracts (Sprint 25).
 * Experiments default DRAFT; public behavior remains control unless explicitly enabled.
 */

export type ExperimentStatus =
  | "DRAFT"
  | "READY_FOR_REVIEW"
  | "APPROVED"
  | "SCHEDULED"
  | "RUNNING"
  | "PAUSED"
  | "STOPPED"
  | "COMPLETED"
  | "ARCHIVED"
  | "INVALIDATED";

export type ExperimentEnvironment = "LOCAL" | "TEST" | "STAGING" | "PRODUCTION";

export type ExposureUnit =
  | "anonymous_visitor"
  | "session"
  | "request"
  | "device_like_anonymous"
  | "locale_session"
  | "admin_test_identity";

export type EligibilityReasonCode =
  | "ELIGIBLE"
  | "ENVIRONMENT_BLOCKED"
  | "EXPERIMENT_NOT_RUNNING"
  | "EXPERIMENTATION_DISABLED"
  | "LOCALE_EXCLUDED"
  | "COUNTRY_EXCLUDED"
  | "PAGE_TYPE_EXCLUDED"
  | "FEATURE_UNAVAILABLE"
  | "CONSENT_REQUIRED"
  | "CONFLICTING_EXPERIMENT"
  | "TRAFFIC_BUCKET_EXCLUDED"
  | "INVALID_ASSIGNMENT_KEY"
  | "TEST_IDENTITY_ONLY"
  | "STATUS_NOT_ACTIVE";

export type SrmStatus =
  | "NO_ISSUE"
  | "WATCH"
  | "MATERIAL_SRM"
  | "INSUFFICIENT_DATA";

export type StoppingRecommendation =
  | "CONTINUE"
  | "PAUSE_FOR_REVIEW"
  | "STOP_FOR_HARM"
  | "INVALIDATE"
  | "READY_FOR_ANALYSIS";

export type IssueSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";

export type MetricType =
  | "binary_conversion"
  | "count"
  | "rate"
  | "continuous"
  | "latency"
  | "failure_rate";

export type MetricDirection = "increase" | "decrease" | "monitor";

export type ExperimentSection =
  | "overview"
  | "definitions"
  | "assignments"
  | "exposures"
  | "metrics"
  | "results"
  | "guardrails"
  | "issues"
  | "methodology"
  | "audit";

export type ExperimentFilters = {
  status: ExperimentStatus | null;
  environment: ExperimentEnvironment | null;
  q: string | null;
  offset: number;
  limit: number;
};

export type VariantRole = "CONTROL" | "TREATMENT";

export type ExperimentVariant = {
  id: string;
  label: string;
  role: VariantRole;
  allocationWeight: number;
  enabled: boolean;
  config: Record<string, string | number | boolean | null>;
  safetyNotes: string[];
};

export type ExperimentMetricRef = {
  metricId: string;
  role: "primary" | "secondary" | "guardrail";
};

export type ExperimentDefinition = {
  id: string;
  name: string;
  hypothesis: string;
  owner: string;
  status: ExperimentStatus;
  environments: ExperimentEnvironment[];
  exposureUnit: ExposureUnit;
  variants: ExperimentVariant[];
  primaryMetricId: string;
  secondaryMetricIds: string[];
  guardrailMetricIds: string[];
  conflictGroup: string | null;
  trafficPercent: number;
  locales: string[] | null;
  countries: string[] | null;
  pageTypes: string[] | null;
  minSamplePerVariant: number;
  minRuntimeDays: number;
  maxRuntimeDays: number;
  minimumDetectableEffect: number | null;
  assignmentVersion: string;
  metricVersion: string;
  methodologyVersion: string;
  createdAt: string;
  approvedAt: string | null;
  activatedAt: string | null;
  ethicalReviewNotes: string[];
  risks: string[];
};

export type CapabilityRow = {
  analysis: string;
  status: "fully_supported" | "partial" | "unavailable" | "privacy_constraint";
  blockingReason: string | null;
  source: string;
};

export const EXPERIMENT_METHODOLOGY_VERSION = "25.0.0";
export const EXPERIMENT_ASSIGNMENT_VERSION_DEFAULT = "25.0.0";
export const EXPERIMENT_EXPORT_MAX_ROWS = 2_000;
export const EXPERIMENT_DEFAULT_PAGE_SIZE = 50;
export const EXPERIMENT_MAX_PAGE_SIZE = 200;

/** Public experimentation is disabled unless explicitly enabled. */
export const FF_EXPERIMENTATION_ENABLED = "FF_EXPERIMENTATION_ENABLED";

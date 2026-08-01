export type EvidenceStrength =
  | "very_strong"
  | "strong"
  | "moderate"
  | "limited"
  | "insufficient";

export const EVIDENCE_STRENGTH_LABELS: Record<EvidenceStrength, string> = {
  very_strong: "Very Strong",
  strong: "Strong",
  moderate: "Moderate",
  limited: "Limited",
  insufficient: "Insufficient",
};

export type BaselineRelation = "above" | "near" | "below" | "unavailable";

export type BaselineKind =
  | "league"
  | "competition"
  | "season"
  | "team"
  | "home"
  | "away";

export type SampleQualityView = {
  sampleSize: number;
  coveragePercent: number | null;
  eligible: number;
  skipped: number;
  unknown: number;
  label: string;
  note?: string;
};

export type BaselineView = {
  kind: BaselineKind;
  label: string;
  value: number | null;
  displayValue: string;
  relation: BaselineRelation;
  deltaDisplay?: string;
};

export type SplitView = {
  overall: { value: number | null; displayValue: string; sampleSize: number };
  home: { value: number | null; displayValue: string; sampleSize: number };
  away: { value: number | null; displayValue: string; sampleSize: number };
  differenceDisplay: string;
  coveragePercent: number | null;
  cautionNote?: string;
};

export type QualificationView = {
  included: string[];
  excluded: string[];
  rules: string[];
  filters: string[];
  threshold?: number;
  difference?: number;
};

export type ProvenanceView = {
  provider: string;
  calculationSource: string;
  qualificationEngine: string;
  lastVerifiedAt: string | null;
  lastVerifiedLabel: string;
};

export type TimelineEvent = {
  id: string;
  kind: "qualified_fixture" | "evidence_update" | "coverage_change" | "season_progress" | "provider_refresh";
  title: string;
  detail?: string;
  at: string | null;
  atLabel: string;
};

export type EvidenceMetricView = {
  id: string;
  metric: string;
  value: number | null;
  displayValue: string;
  sample: SampleQualityView;
  strength: EvidenceStrength;
  baseline?: BaselineView;
  split?: SplitView;
  qualificationSummary?: string;
  provenance?: ProvenanceView;
  notes?: string;
  updatedAt?: string | null;
  updatedLabel?: string;
  entityKey?: string;
};

export type EvidenceBundle = {
  entityKey: string;
  title: string;
  metrics: EvidenceMetricView[];
  qualification?: QualificationView;
  timeline: TimelineEvent[];
  provenance?: ProvenanceView;
  summaryStrength: EvidenceStrength;
};

export type EvidenceDiagnosticFinding = {
  id: string;
  severity: "info" | "warning" | "error";
  category: "coverage" | "sample" | "baseline" | "qualification" | "freshness" | "missing";
  message: string;
  entityKey?: string;
};

export type EvidenceDiagnostics = {
  generatedAt: string;
  coverage: { withEvidence: number; missing: number };
  sampleQuality: Record<string, number>;
  baselines: { present: number; missing: number };
  qualification: { complete: number; incomplete: number };
  freshness: { fresh: number; stale: number; unknown: number };
  findings: EvidenceDiagnosticFinding[];
  entityBreakdown: Array<{ entityType: string; metrics: number; lowSample: number }>;
  performance: { cacheEntries: number; averageAdapterMs: number };
};

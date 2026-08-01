import type { MetricDirection, MetricType } from "./contracts";

export type MetricDefinition = {
  id: string;
  displayName: string;
  type: MetricType;
  numeratorEvents: string[];
  denominatorEvents: string[];
  inclusionRules: string[];
  exclusionRules: string[];
  deduplication: "first_per_unit" | "first_per_session" | "all";
  attributionWindowHours: number;
  dataAvailability: "supported" | "partial" | "unavailable";
  minSample: number;
  direction: MetricDirection;
  guardrailSuitable: boolean;
  metricVersion: string;
  notes: string[];
};

const UNSUPPORTED_FORBIDDEN = new Set([
  "ftd",
  "deposit",
  "revenue",
  "ltv",
  "downstream_conversion",
]);

export const METRIC_REGISTRY: MetricDefinition[] = [
  {
    id: "fixture_open_rate",
    displayName: "Fixture open rate",
    type: "binary_conversion",
    numeratorEvents: ["fixture_open", "match_detail_viewed"],
    denominatorEvents: ["homepage_view", "search_result_impression"],
    inclusionRules: ["Has session_id"],
    exclusionRules: ["Preview traffic"],
    deduplication: "first_per_session",
    attributionWindowHours: 24,
    dataAvailability: "partial",
    minSample: 200,
    direction: "increase",
    guardrailSuitable: false,
    metricVersion: "25.0.0",
    notes: ["Denominator depends on page-view coverage"],
  },
  {
    id: "prediction_open_rate",
    displayName: "Prediction open rate",
    type: "binary_conversion",
    numeratorEvents: ["match_prediction_expanded"],
    denominatorEvents: ["match_detail_viewed"],
    inclusionRules: [],
    exclusionRules: ["Preview traffic"],
    deduplication: "first_per_session",
    attributionWindowHours: 24,
    dataAvailability: "supported",
    minSample: 200,
    direction: "increase",
    guardrailSuitable: false,
    metricVersion: "25.0.0",
    notes: [],
  },
  {
    id: "evidence_view_rate",
    displayName: "Evidence view rate",
    type: "binary_conversion",
    numeratorEvents: ["match_evidence_viewed"],
    denominatorEvents: ["match_detail_viewed"],
    inclusionRules: [],
    exclusionRules: ["Preview traffic"],
    deduplication: "first_per_session",
    attributionWindowHours: 24,
    dataAvailability: "supported",
    minSample: 200,
    direction: "increase",
    guardrailSuitable: true,
    metricVersion: "25.0.0",
    notes: ["Also usable as engagement guardrail"],
  },
  {
    id: "search_result_click_rate",
    displayName: "Search result click rate",
    type: "binary_conversion",
    numeratorEvents: ["search_result_click"],
    denominatorEvents: ["search_query", "search"],
    inclusionRules: [],
    exclusionRules: ["Preview traffic"],
    deduplication: "first_per_session",
    attributionWindowHours: 1,
    dataAvailability: "supported",
    minSample: 300,
    direction: "increase",
    guardrailSuitable: false,
    metricVersion: "25.0.0",
    notes: [],
  },
  {
    id: "no_result_search_rate",
    displayName: "Search no-result rate",
    type: "failure_rate",
    numeratorEvents: ["search_no_results"],
    denominatorEvents: ["search_query", "search"],
    inclusionRules: [],
    exclusionRules: [],
    deduplication: "all",
    attributionWindowHours: 1,
    dataAvailability: "partial",
    minSample: 200,
    direction: "decrease",
    guardrailSuitable: true,
    metricVersion: "25.0.0",
    notes: [],
  },
  {
    id: "acca_builder_open_rate",
    displayName: "Acca Builder open rate",
    type: "binary_conversion",
    numeratorEvents: ["acca_builder_opened"],
    denominatorEvents: ["homepage_view", "acca_opened"],
    inclusionRules: [],
    exclusionRules: ["Preview traffic"],
    deduplication: "first_per_session",
    attributionWindowHours: 24,
    dataAvailability: "partial",
    minSample: 200,
    direction: "increase",
    guardrailSuitable: false,
    metricVersion: "25.0.0",
    notes: [],
  },
  {
    id: "builder_generation_success_rate",
    displayName: "Builder generation success rate",
    type: "rate",
    numeratorEvents: ["acca_builder_generation_succeeded"],
    denominatorEvents: ["acca_builder_generation_started"],
    inclusionRules: [],
    exclusionRules: [],
    deduplication: "all",
    attributionWindowHours: 1,
    dataAvailability: "supported",
    minSample: 100,
    direction: "increase",
    guardrailSuitable: true,
    metricVersion: "25.0.0",
    notes: [],
  },
  {
    id: "builder_to_studio_rate",
    displayName: "Builder → Studio transfer rate",
    type: "binary_conversion",
    numeratorEvents: ["acca_builder_added_to_studio"],
    denominatorEvents: ["acca_builder_generation_succeeded"],
    inclusionRules: [],
    exclusionRules: ["Preview traffic"],
    deduplication: "first_per_session",
    attributionWindowHours: 24,
    dataAvailability: "supported",
    minSample: 100,
    direction: "increase",
    guardrailSuitable: false,
    metricVersion: "25.0.0",
    notes: [],
  },
  {
    id: "studio_handoff_rate",
    displayName: "Studio operator handoff rate",
    type: "binary_conversion",
    numeratorEvents: ["operator_click", "affiliate_redirect_created"],
    denominatorEvents: ["acca_opened"],
    inclusionRules: ["Operator must remain eligibility-gated"],
    exclusionRules: ["Preview traffic"],
    deduplication: "first_per_session",
    attributionWindowHours: 24,
    dataAvailability: "partial",
    minSample: 150,
    direction: "increase",
    guardrailSuitable: false,
    metricVersion: "25.0.0",
    notes: ["Never override operator availability"],
  },
  {
    id: "operator_cta_click_rate",
    displayName: "Operator CTA click rate",
    type: "binary_conversion",
    numeratorEvents: ["operator_click", "operator_affiliate_cta_click"],
    denominatorEvents: ["operator_impression"],
    inclusionRules: ["Availability decision must remain authoritative"],
    exclusionRules: ["Preview traffic"],
    deduplication: "first_per_session",
    attributionWindowHours: 24,
    dataAvailability: "supported",
    minSample: 300,
    direction: "increase",
    guardrailSuitable: false,
    metricVersion: "25.0.0",
    notes: [],
  },
  {
    id: "signed_redirect_success_rate",
    displayName: "Signed redirect success rate",
    type: "rate",
    numeratorEvents: ["affiliate_redirect_completed"],
    denominatorEvents: ["affiliate_redirect_created"],
    inclusionRules: [],
    exclusionRules: [],
    deduplication: "all",
    attributionWindowHours: 1,
    dataAvailability: "supported",
    minSample: 100,
    direction: "increase",
    guardrailSuitable: true,
    metricVersion: "25.0.0",
    notes: [],
  },
  {
    id: "page_error_rate",
    displayName: "Page error rate",
    type: "failure_rate",
    numeratorEvents: ["page_error", "match_detail_retry"],
    denominatorEvents: ["match_detail_viewed", "homepage_view"],
    inclusionRules: [],
    exclusionRules: [],
    deduplication: "all",
    attributionWindowHours: 1,
    dataAvailability: "partial",
    minSample: 200,
    direction: "decrease",
    guardrailSuitable: true,
    metricVersion: "25.0.0",
    notes: [],
  },
  {
    id: "api_failure_rate",
    displayName: "API failure rate",
    type: "failure_rate",
    numeratorEvents: [
      "acca_builder_generation_failed",
      "affiliate_redirect_failed",
    ],
    denominatorEvents: [
      "acca_builder_generation_started",
      "affiliate_redirect_created",
    ],
    inclusionRules: [],
    exclusionRules: [],
    deduplication: "all",
    attributionWindowHours: 1,
    dataAvailability: "supported",
    minSample: 100,
    direction: "decrease",
    guardrailSuitable: true,
    metricVersion: "25.0.0",
    notes: [],
  },
];

export function getMetric(id: string): MetricDefinition | null {
  return METRIC_REGISTRY.find((m) => m.id === id) ?? null;
}

export function assertSupportedMetric(id: string): {
  ok: boolean;
  error?: string;
  metric?: MetricDefinition;
} {
  const lower = id.toLowerCase();
  if (UNSUPPORTED_FORBIDDEN.has(lower) || lower.includes("ftd") || lower.includes("revenue")) {
    return {
      ok: false,
      error: `Metric "${id}" is unavailable — FTD/revenue/deposit/LTV are not registered without verified data sources`,
    };
  }
  const metric = getMetric(id);
  if (!metric) {
    return { ok: false, error: `Unknown metric "${id}"` };
  }
  if (metric.dataAvailability === "unavailable") {
    return { ok: false, error: `Metric "${id}" is unavailable` };
  }
  return { ok: true, metric };
}

export function listSupportedMetrics(): MetricDefinition[] {
  return METRIC_REGISTRY.filter((m) => m.dataAvailability !== "unavailable");
}

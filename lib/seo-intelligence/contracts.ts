/**
 * SEO Intelligence contracts — browser-safe DTOs (Sprint 22).
 * Deterministic indexability + quality; no opaque AI scores.
 */

export type IndexabilityDecision =
  | "INDEX"
  | "NOINDEX"
  | "EXCLUDED"
  | "REDIRECT"
  | "ERROR"
  | "REVIEW_REQUIRED";

export type IndexabilityReasonCode =
  | "VALID_EVERGREEN_PAGE"
  | "VALID_PUBLISHED_MATCH"
  | "VALID_SETTLED_ARCHIVE"
  | "THIN_CONTENT"
  | "NO_PUBLISHED_PREDICTION"
  | "INVALID_FIXTURE"
  | "CANCELLED_FIXTURE"
  | "POSTPONED_WITHOUT_VALUE"
  | "DUPLICATE_FILTER_STATE"
  | "PAGINATION_OUT_OF_RANGE"
  | "SEARCH_RESULT_PAGE"
  | "PRIVATE_WORKSPACE"
  | "ADMIN_ROUTE"
  | "CANONICAL_REDIRECT"
  | "UNSUPPORTED_LOCALE"
  | "STALE_WITHOUT_ARCHIVE_VALUE"
  | "MISSING_REQUIRED_METADATA"
  | "MISSING_PRIMARY_ENTITY"
  | "EMPTY_COLLECTION"
  | "LOW_SAMPLE_CONTENT"
  | "AFFILIATE_DOORWAY_RISK"
  | "DEVELOPER_ROUTE"
  | "UTILITY_NOINDEX"
  | "STAGING_OVERRIDE";

export type IssueSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";

export type SeoPageType =
  | "home"
  | "search"
  | "fixture"
  | "competition_hub"
  | "competition"
  | "team_hub"
  | "team"
  | "market_hub"
  | "market"
  | "season_hub"
  | "season"
  | "archive_hub"
  | "archive_day"
  | "methodology"
  | "operator_hub"
  | "operator"
  | "review"
  | "country_hub"
  | "country"
  | "compare"
  | "acca_studio"
  | "acca_builder"
  | "combo_redirect"
  | "affiliate_hub"
  | "legal"
  | "admin"
  | "developer"
  | "error"
  | "utility"
  | "unknown";

export type MatchLifecycleState =
  | "pre_match"
  | "live"
  | "recently_completed"
  | "settled"
  | "archived"
  | "stale"
  | "invalid"
  | "cancelled"
  | "postponed"
  | "abandoned";

export type QualityComponentId =
  | "entity_completeness"
  | "factual_content"
  | "evidence_presence"
  | "archive_value"
  | "metadata_completeness"
  | "schema_validity"
  | "internal_links"
  | "freshness"
  | "duplicate_penalty"
  | "thin_penalty"
  | "invalid_state_penalty";

export type QualityComponent = {
  id: QualityComponentId;
  label: string;
  score: number | null;
  max: number;
  notes: string[];
};

export type QualityScore = {
  total: number | null;
  max: number;
  components: QualityComponent[];
  /** Hard noindex/redirect/excluded always wins over score. */
  overriddenByIndexability: boolean;
};

export type SeoUrlRecord = {
  url: string;
  path: string;
  locale: string;
  pageType: SeoPageType;
  canonicalUrl: string;
  indexability: IndexabilityDecision;
  reasonCodes: IndexabilityReasonCode[];
  sitemapIncluded: boolean;
  httpStatusExpectation: number;
  title: string;
  metaDescription: string | null;
  h1: string | null;
  schemaTypes: string[];
  contentSignals: string[];
  inboundLinks: number;
  outboundLinks: number;
  lastMeaningfulUpdate: string | null;
  kickoffAt: string | null;
  lifecycle: MatchLifecycleState | null;
  quality: QualityScore;
  issueCodes: string[];
};

export type SeoIssue = {
  code: string;
  severity: IssueSeverity;
  pageType: SeoPageType;
  url: string;
  explanation: string;
  remediation: string;
  detectedAt: string;
  status: "open" | "acknowledged";
};

export type SeoOverview = {
  generatedAt: string;
  ruleVersion: string;
  totalUrls: number;
  indexable: number;
  noindex: number;
  excluded: number;
  redirects: number;
  errors: number;
  reviewRequired: number;
  criticalIssues: number;
  highIssues: number;
  sitemapHealth: "healthy" | "degraded" | "unhealthy";
  schemaHealth: "healthy" | "degraded" | "unhealthy";
  orphanCount: number;
  thinPageCount: number;
  duplicateMetadataCount: number;
  stalePageCount: number;
  localeIssueCount: number;
  lastAuditAt: string;
  notes: string[];
};

export type SeoFilters = {
  pageType: SeoPageType | "all";
  locale: string | null;
  indexability: IndexabilityDecision | "all";
  severity: IssueSeverity | "all";
  sitemap: "all" | "included" | "excluded";
  q: string | null;
  offset: number;
  limit: number;
};

export type SeoSection =
  | "overview"
  | "urls"
  | "page-types"
  | "issues"
  | "sitemaps"
  | "structured-data"
  | "internal-links"
  | "content-quality";

export const SEO_RULE_VERSION = "22.0.0";
export const SEO_EXPORT_MAX_ROWS = 2_000;
export const SEO_DEFAULT_PAGE_SIZE = 50;
export const SEO_MAX_PAGE_SIZE = 200;
/** Bound locale expansion in inventory (en + sample). */
export const SEO_INVENTORY_LOCALES = ["en"] as const;

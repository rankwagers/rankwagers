/**
 * Affiliate Intelligence contracts — browser-safe DTOs (Sprint 23).
 * No fabricated revenue, FTD, or bonus claims.
 */

export type AvailabilityDecision =
  | "AVAILABLE"
  | "UNAVAILABLE"
  | "UNKNOWN"
  | "DISABLED"
  | "MISCONFIGURED"
  | "REVIEW_REQUIRED";

export type AvailabilityReasonCode =
  | "COUNTRY_SUPPORTED"
  | "COUNTRY_BLOCKED"
  | "LOCALE_UNSUPPORTED"
  | "CAMPAIGN_MISSING"
  | "DESTINATION_MISSING"
  | "SIGNING_KEY_MISSING"
  | "FEATURE_FLAG_DISABLED"
  | "OPERATOR_INACTIVE"
  | "MARKET_UNSUPPORTED"
  | "STALE_AVAILABILITY_DATA"
  | "UNKNOWN_GEO"
  | "INVALID_CONFIGURATION"
  | "TEST_ONLY_OPERATOR"
  | "AFFILIATE_URL_UNCONFIGURED"
  | "NO_COUNTRY_RESTRICTION"
  | "POSTBACK_DISABLED";

export type IssueSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";

export type AffiliateSection =
  | "overview"
  | "operators"
  | "placements"
  | "funnels"
  | "campaigns"
  | "redirects"
  | "availability"
  | "issues"
  | "quality";

export type PlacementProminence = "primary" | "secondary" | "tertiary" | "utility";

export type AffiliateFilters = {
  operator: string | null;
  placement: string | null;
  country: string | null;
  availability: AvailabilityDecision | "all";
  severity: IssueSeverity | "all";
  q: string | null;
  offset: number;
  limit: number;
};

export type OperatorRegistryRow = {
  operatorId: string;
  displayName: string;
  partnerId: string | null;
  supportedCountries: string[];
  blockedCountries: string[];
  supportedLocales: string[];
  supportedMarkets: string[];
  destinationConfigured: boolean;
  affiliateEnabled: boolean;
  verificationStatus: "verified" | "unverified";
  availabilitySource: string;
  lastVerifiedAt: string | null;
  signingReady: boolean;
  disclaimerSource: string;
  logoPresent: boolean;
  fallbackBehavior: string;
  knownIssues: string[];
  availabilityDecision: AvailabilityDecision;
  reasonCodes: AvailabilityReasonCode[];
};

export type PlacementRecord = {
  placementId: string;
  pageType: string;
  componentPath: string;
  userIntentStage: string;
  operatorSelection: string;
  attributionSchema: string[];
  signingMethod: string;
  availabilityRule: string;
  fallbackBehavior: string;
  eventNames: string[];
  duplicateCtaRisk: "low" | "medium" | "high";
  prominence: PlacementProminence;
  qualityStatus: "ok" | "review" | "issue";
  notes: string[];
};

export type FunnelStepMetric = {
  step: string;
  eventNames: string[];
  count: number | null;
  available: boolean;
  reason?: string;
};

export type FunnelDefinition = {
  id: string;
  label: string;
  steps: FunnelStepMetric[];
  notes: string[];
};

export type CampaignRecord = {
  campaignId: string;
  operatorId: string;
  partnerId: string | null;
  placementEligibility: string[];
  localeCountryEligibility: string;
  destinationMapped: boolean;
  activePeriod: string | null;
  status: "active" | "inactive" | "unknown" | "unavailable";
  lastVerifiedAt: string | null;
  attributionMapping: string;
  issueStatus: string;
  notes: string[];
};

export type RedirectHealth = {
  creationAttempts: number | null;
  successfulSignatures: number | null;
  validationFailures: number | null;
  expiredLinks: number | null;
  malformedLinks: number | null;
  disabledOperatorAttempts: number | null;
  unavailableOperatorAttempts: number | null;
  destinationFailures: number | null;
  resolvedRedirects: number | null;
  clickToRedirectRate: number | null;
  notes: string[];
};

export type QualityComponent = {
  id: string;
  label: string;
  score: number | null;
  max: number;
  notes: string[];
};

export type QualityScore = {
  total: number | null;
  max: number;
  components: QualityComponent[];
  purpose: "internal_operational_only";
};

export type AffiliateIssue = {
  code: string;
  severity: IssueSeverity;
  operatorId: string | null;
  placementId: string | null;
  context: string;
  explanation: string;
  remediation: string;
  detectedAt: string;
  status: "open" | "acknowledged";
};

export type AffiliateOverview = {
  generatedAt: string;
  ruleVersion: string;
  activeOperators: number;
  disabledOperators: number;
  unknownAvailability: number;
  totalPlacements: number;
  ctaViews: number | null;
  ctaClicks: number | null;
  signedRedirectsCreated: number | null;
  redirectsResolved: number | null;
  redirectFailures: number | null;
  clickToRedirectSuccessRate: number | null;
  topPlacements: Array<{ placementId: string; clicks: number }>;
  topOperators: Array<{ operatorId: string; redirects: number }>;
  brokenOperators: string[];
  staleAvailabilityCount: number;
  attributionIssueCount: number;
  criticalIssues: number;
  highIssues: number;
  lastAuditAt: string;
  notes: string[];
};

export const AFFILIATE_RULE_VERSION = "23.0.0";
export const AFFILIATE_EXPORT_MAX_ROWS = 2_000;
export const AFFILIATE_DEFAULT_PAGE_SIZE = 50;
export const AFFILIATE_MAX_PAGE_SIZE = 200;

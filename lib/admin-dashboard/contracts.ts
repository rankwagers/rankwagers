/** Internal Intelligence Dashboard contracts — browser-safe DTOs. */

export type MetricValue =
  | { available: true; value: number | string }
  | { available: false; reason: string };

export type AdminDashboardFilters = {
  locale: string;
  /** Inclusive YYYY-MM-DD */
  from: string | null;
  to: string | null;
  competition: string | null;
  country: string | null;
  /** Present in UI; archives do not yet expose a season field. */
  season: string | null;
  market: string | null;
  predictionSource: string | null;
  riskMode: string | null;
  dateLimit: number;
};

export type ChartPoint = { label: string; value: number | null };

export type OverviewDashboard = {
  generatedAt: string;
  filters: AdminDashboardFilters;
  publishedPredictions: MetricValue;
  settledPredictions: MetricValue;
  won: MetricValue;
  lost: MetricValue;
  voided: MetricValue;
  hitRate: MetricValue;
  pending: MetricValue;
  todayPredictions: MetricValue;
  last7Days: MetricValue;
  last30Days: MetricValue;
  averageConfidence: MetricValue;
  averageOdds: MetricValue;
  dataFreshness: MetricValue;
  builderUsage: MetricValue;
  operatorClicks: MetricValue;
  archiveGrowthDays: MetricValue;
  searchUsage: MetricValue;
  errors: MetricValue;
  charts: {
    dailyPredictions: ChartPoint[];
    dailyHitRate: ChartPoint[];
    builderGenerations: ChartPoint[];
    operatorClicks: ChartPoint[];
  };
  notes: string[];
};

export type PredictionQualityDashboard = {
  generatedAt: string;
  filters: AdminDashboardFilters;
  won: MetricValue;
  lost: MetricValue;
  voided: MetricValue;
  hitRate: MetricValue;
  averageConfidence: MetricValue;
  averageOdds: MetricValue;
  averagePublicationDelay: MetricValue;
  averageSettlementDelay: MetricValue;
  trend: ChartPoint[];
  byMarket: Array<{
    market: string;
    sampleSize: number;
    won: number;
    lost: number;
    voided: number;
    hitRate: number | null;
    averageConfidence: number | null;
  }>;
  notes: string[];
};

export type MarketAnalysisDashboard = {
  generatedAt: string;
  filters: AdminDashboardFilters;
  markets: Array<{
    market: string;
    sampleSize: number;
    won: number;
    lost: number;
    voided: number;
    hitRate: number | null;
    averageConfidence: number | null;
    confidenceDistribution: ChartPoint[];
    trend: ChartPoint[];
    supported: boolean;
    note?: string;
  }>;
  notes: string[];
};

export type LeagueAnalysisDashboard = {
  generatedAt: string;
  filters: AdminDashboardFilters;
  leagues: Array<{
    league: string;
    published: number;
    won: number;
    lost: number;
    voided: number;
    hitRate: number | null;
    averageConfidence: number | null;
    builderUsage: MetricValue;
    operatorClicks: MetricValue;
  }>;
  topLeagues: string[];
  worstLeagues: string[];
  mostActive: string[];
  notes: string[];
};

export type BuilderDashboard = {
  generatedAt: string;
  filters: AdminDashboardFilters;
  generations: MetricValue;
  successful: MetricValue;
  failed: MetricValue;
  averageGenerationTime: MetricValue;
  averageLegs: MetricValue;
  riskModeDistribution: ChartPoint[];
  averageEvidenceCompleteness: MetricValue;
  averageCandidatePool: MetricValue;
  averageEligible: MetricValue;
  averageExcluded: MetricValue;
  transferToStudio: MetricValue;
  merge: MetricValue;
  replace: MetricValue;
  operatorClickThrough: MetricValue;
  popularMarkets: ChartPoint[];
  popularCompetitions: ChartPoint[];
  charts: { generations: ChartPoint[] };
  notes: string[];
};

export type SystemHealthDashboard = {
  generatedAt: string;
  filters: AdminDashboardFilters;
  providerLatency: MetricValue;
  providerFailures: MetricValue;
  cacheHitRatio: MetricValue;
  apiFailures: MetricValue;
  rateLimitEvents: MetricValue;
  responses429: MetricValue;
  requestIdsSample: string[];
  averageResponseTime: MetricValue;
  averageBuilderLatency: MetricValue;
  readinessChecks: Array<{ name: string; ok: boolean; detail?: string }>;
  notes: string[];
};

export type OperatorDashboard = {
  generatedAt: string;
  filters: AdminDashboardFilters;
  redirects: MetricValue;
  signedRedirectFailures: MetricValue;
  clickCounts: MetricValue;
  ctr: MetricValue;
  brokenOperators: string[];
  unavailableOperators: string[];
  byOperator: Array<{
    slug: string;
    impressions: number;
    clicks: number;
    ctr: number | null;
  }>;
  charts: { clicks: ChartPoint[] };
  notes: string[];
};

export type SearchDashboard = {
  generatedAt: string;
  filters: AdminDashboardFilters;
  mostSearchedTeams: ChartPoint[];
  mostSearchedLeagues: ChartPoint[];
  mostSearchedFixtures: ChartPoint[];
  noResultSearches: MetricValue;
  searchCtr: MetricValue;
  notes: string[];
};

export type AdminDashboardSection =
  | "overview"
  | "predictions"
  | "markets"
  | "leagues"
  | "builder"
  | "operators"
  | "search"
  | "system";

import type { MatchListKind } from "@/lib/footystats/types";
import type { OperatorMarketKey } from "@/lib/operators/types";

export type MarketCategory =
  | "totals"
  | "half-time"
  | "both-teams"
  | "handicap"
  | "result";

export type MarketEvidenceMetricId =
  | "goal_frequency"
  | "btts_rate"
  | "xg_environment"
  | "league_baseline"
  | "home_away_split"
  | "sample_quality";

export type MarketSeo = {
  titleTemplate: string;
  description: string;
  faqs: Array<{ question: string; answer: string }>;
};

/** First-class market intelligence entity. */
export type MarketDefinition = {
  slug: string;
  name: string;
  shortDescription: string;
  longDescription: string;
  howItWorks: readonly string[];
  category: MarketCategory;
  /** Internal qualification / odds key when RankWagers tracks the market. */
  listKind: MatchListKind | null;
  operatorMarketKey: OperatorMarketKey | null;
  evidenceMetrics: readonly MarketEvidenceMetricId[];
  relatedMarketSlugs: readonly string[];
  relatedLeagues: readonly string[];
  seo: MarketSeo;
};

export type MarketHistoricalStats = {
  qualifiedFixtureCount: number;
  averageModelProbability: number | null;
  highestModelProbability: number | null;
  leagueCoverage: number;
  topLeagues: Array<{ league: string; count: number }>;
  sampleNote: string;
};

export type MarketOddsSummary = {
  sampleSize: number;
  bestOdds: number | null;
  averageOdds: number | null;
  lowestOdds: number | null;
  movementCount: number;
  steamCount: number;
  clvAveragePercent: number | null;
};

export type MarketEvidenceIndicator = {
  id: MarketEvidenceMetricId;
  label: string;
  description: string;
  available: boolean;
};

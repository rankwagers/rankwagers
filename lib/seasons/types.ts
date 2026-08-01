export type SeasonEntity = {
  id: string;
  /** URL segment under the competition (e.g. 2025-26). */
  slug: string;
  competitionSlug: string;
  displayName: string;
  startDate: string;
  endDate: string;
  providerSeasonId?: string | number;
  active: boolean;
  countryCode?: string;
  /** Human label from competition registry (e.g. 2025/26). */
  yearLabel: string;
};

export type SeasonSampleQuality = "none" | "very-limited" | "limited" | "adequate";

export type SeasonMarketRow = {
  marketSlug: string;
  marketLabel: string;
  qualifiedCount: number;
  averageModelProbability: number | null;
};

export type SeasonIntelligence = {
  qualifiedFixtureCount: number;
  uniqueMatchCount: number;
  upcomingCount: number;
  completedCount: number;
  participatingTeamCount: number;
  homeRows: number;
  awayRows: number;
  averageModelProbability: number | null;
  marketProfile: SeasonMarketRow[];
  sampleQuality: SeasonSampleQuality;
  sampleNote: string;
  /** Goal/xG rates require match-detail enrichment — never invented. */
  hasGoalEnrichment: boolean;
};

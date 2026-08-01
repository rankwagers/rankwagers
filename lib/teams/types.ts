export type TeamProviderIds = {
  footyStats?: number | string;
  apiFootball?: number | string;
};

export type TeamEntity = {
  id: string;
  providerIds?: TeamProviderIds;
  slug: string;
  name: string;
  shortName?: string;
  countryCode?: string;
  competitionSlugs: readonly string[];
  logoUrl?: string;
  aliases?: readonly string[];
  foundedYear?: number;
  venueName?: string;
  active: boolean;
  relatedMarketSlugs: readonly string[];
  relatedOperatorSlugs: readonly string[];
  relatedTeamSlugs: readonly string[];
};

export type TeamSampleQuality = "none" | "very-limited" | "limited" | "adequate";

export type TeamMarketProfileRow = {
  marketSlug: string;
  marketLabel: string;
  qualifiedCount: number;
  averageModelProbability: number | null;
};

export type TeamIntelligence = {
  matchesInSample: number;
  uniqueMatchCount: number;
  homeAppearances: number;
  awayAppearances: number;
  averageModelProbability: number | null;
  marketProfile: TeamMarketProfileRow[];
  sampleQuality: TeamSampleQuality;
  sampleNote: string;
  /** True only when goal/xG enrichment exists — currently always false without invented data. */
  hasGoalEnrichment: boolean;
};

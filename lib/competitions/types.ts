export type CompetitionConfederation =
  | "UEFA"
  | "CONMEBOL"
  | "CAF"
  | "AFC"
  | "CONCACAF"
  | "OFC"
  | "FIFA"
  | "Domestic";

export type CompetitionDefinition = {
  id: string;
  slug: string;
  name: string;
  country: string | null;
  confederation: CompetitionConfederation;
  logo: string | null;
  season: string;
  description: string;
  /** Case-insensitive substrings matched against fixture.league */
  aliases: readonly string[];
  relatedMarketSlugs: readonly string[];
  relatedOperatorSlugs: readonly string[];
  relatedCompetitionSlugs: readonly string[];
  relatedTeamHints: readonly string[];
};

export type CompetitionResearchStats = {
  qualifiedFixtureCount: number;
  uniqueMatchCount: number;
  averageModelProbability: number | null;
  marketBreakdown: Array<{ market: string; count: number; averageProbability: number }>;
  sampleQuality: "none" | "very-limited" | "limited" | "adequate";
  sampleNote: string;
};

export type CompetitionOddsSummary = {
  sampleSize: number;
  bestOdds: number | null;
  averageOdds: number | null;
  movementCount: number;
};

/**
 * Homepage decision-support contracts (UI-independent).
 * Safe for a future Flutter / API client.
 */

export type HomepageResultStatus = "won" | "lost" | "void" | "pending";

export type HomepageTopPick = {
  matchId: number;
  home: string;
  away: string;
  competition: string;
  marketKey: string;
  marketLabel: string;
  confidence: number;
  kickoffLabel: string;
  kickoffDateTime: string;
  publishedAt: string | null;
  evidenceLine: string;
  matchHref: string;
};

export type HomepageRecentResult = {
  id: string;
  matchId: number;
  home: string;
  away: string;
  competition: string;
  marketKey: string;
  marketLabel: string;
  status: HomepageResultStatus;
  scoreLabel: string;
  matchHref: string;
  date: string;
};

export type HomepageVerifiedPerformance = {
  availability: "available" | "unavailable";
  windowLabel: string;
  lastUpdatedAt: string | null;
  totalPredictions: number;
  settledPredictions: number;
  pendingPredictions: number;
  voidPredictions: number;
  won: number;
  lost: number;
  /** Hit rate among settled W+L only; null when settled sample is empty */
  hitRatePct: number | null;
  sampleNote: string;
  methodologyHref: string;
  archiveEntryHref: string;
};

export type HomepageFeaturedLeague = {
  name: string;
  href: string | null;
  source: "registry" | "label_only";
};

export type HomepageTrustModel = {
  verified: HomepageVerifiedPerformance;
  recentResults: HomepageRecentResult[];
  featuredLeagues: HomepageFeaturedLeague[];
  liveMatchCount: number;
  qualifiedFixtureCount: number;
};

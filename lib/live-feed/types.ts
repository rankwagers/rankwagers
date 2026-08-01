export type LiveStrategyId = "fh05" | "o25";

export type LiveSignalPublic = {
  id: string;
  strategy: LiveStrategyId;
  home: string;
  away: string;
  league: string;
  country?: string;
  homeScore: number;
  awayScore: number;
  minute?: string;
  /** Score/minute when the pick was confirmed (from Telegram monitor) */
  winHomeScore?: number;
  winAwayScore?: number;
  winMinute?: string;
  liveOdd?: number;
  marketLabel: string;
  status: string;
  /** UI win state — enriched from Telegram status + live scores */
  resultState: "live" | "pending" | "win_pending" | "won" | "lost";
  signaledAt: string;
  homeLogo?: string;
  awayLogo?: string;
  featured: true;
};

export type LiveSignalLocked = {
  id: string;
  strategy: LiveStrategyId;
  signaledAt: string;
  teaser: string;
  isNew: boolean;
  /** telegram = doğrudan kanal/bot; unlock = affiliate modal */
  cta: "telegram" | "unlock";
};

export type LiveHistoryItem = {
  id: string;
  strategy: LiveStrategyId;
  home: string;
  away: string;
  league: string;
  marketLabel: string;
  resultState: "won" | "lost" | "pending" | "live" | "win_pending";
  homeScore: number;
  awayScore: number;
  minute?: string;
  signaledAt: string;
  homeLogo?: string;
  awayLogo?: string;
};

export type UpcomingMatchPublic = {
  id: string;
  strategy: LiveStrategyId;
  strategies: LiveStrategyId[];
  home: string;
  away: string;
  league: string;
  country?: string;
  kickoffIso: string;
  startsInMinutes: number;
  prematchOdd?: number;
  /** Badge text — always "Upcoming". */
  marketLabel: string;
  /** e.g. "1H 0.5+ · Over 2.5" */
  predictionLabel: string;
  homeLogo?: string;
  awayLogo?: string;
};

export type UpcomingMatchLocked = {
  id: string;
  home: string;
  away: string;
  league: string;
  homeLogo?: string;
  awayLogo?: string;
  startsInMinutes: number;
  predictionLabel: string;
};

export type LiveFeedResponse = {
  hourKey: string;
  featured: LiveSignalPublic | null;
  locked: LiveSignalLocked[];
  history: LiveHistoryItem[];
  upcomingFeatured: UpcomingMatchPublic | null;
  upcomingLocked: UpcomingMatchLocked[];
  upcomingBatchKey: string | null;
  nextUpcomingRefreshAt: string | null;
  telegramBotUrl: string | null;
  source: "telegram-eng" | "footystats-fallback" | "empty";
};

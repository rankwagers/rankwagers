/**
 * Homepage decision-support contracts (UI-independent).
 * Safe for a future Flutter / API client.
 */

import type { MatchListKind } from "@/lib/footystats/types";
import type { ResearchRunRules } from "@/lib/research/researchRun";

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

/* ==========================================================================
   HOMEPAGE HERO — Sprint 1
   --------------------------------------------------------------------------
   The approved hero reads a richer fixture than this product currently
   derives. Rather than narrow the contract to today's data, every field the
   composition needs is present and the ones with no production source are
   typed `| null`.

   That is the whole activation story: when the Sprint 23B evidence model is
   switched on, `buildHomepageHeroModel` starts populating `evidence`,
   `signals`, `confidence`, `history` and `funnel.analysed`, and the hero
   renders the rings and figures it already knows how to draw. No component
   changes, no contract change, no migration.

   NOTHING in here may be defaulted to a synthetic value. `null` means "no
   production source", and the UI is required to omit rather than invent.
   ========================================================================== */

/** A weighted signal behind an evidence score. Sprint 23B (M5) will supply these. */
export type HeroSignal = {
  name: string;
  /** Contribution to the evidence score, 0–1. */
  weight: number;
  detail: string;
};

/** A settled outcome for this fixture's model, oldest → newest. */
export type HeroSettledOutcome = "win" | "loss" | "void";

/**
 * One fixture in the hero's ranked selection.
 *
 * READY fields come from the daily provider lists that already back the homepage.
 * BLOCKED fields are `null` until a backend source exists.
 */
export type HeroPick = {
  /* ---- READY: sourced from DailyMatchLists ---- */
  matchId: number;
  home: string;
  away: string;
  homeImage?: string;
  awayImage?: string;
  league: string;
  leagueImage?: string;
  /** Normalized competition key, used only to look up presentation tint. */
  leagueKey: string;
  kickoff: string;
  kickoffDateTime: string;
  market: string;
  marketKind: MatchListKind;
  /** Provider model probability for this fixture's strongest qualified market. */
  probability: number;
  matchHref: string;

  /* ---- BLOCKED: no production source (Sprint 23B evidence model) ---- */
  /** 0–10 evidence score. */
  evidence: number | null;
  /** 1–5 confidence band. */
  confidence: number | null;
  confidenceLabel: string | null;
  /** The three stated reasons carried by the lead pick. */
  reasons: string[] | null;
  summary: string | null;
  signals: HeroSignal[] | null;
  /** Last settled calls by this fixture's model, oldest → newest. */
  history: HeroSettledOutcome[] | null;
  /** Competition round / matchday, e.g. "Matchday 32". */
  round: string | null;
  venue: string | null;
};

/**
 * The research funnel (rwdesign §6).
 *
 * The five stages of the descent, plus the pre-existing `published`. Each is a count the
 * pipeline observed, or `null`.
 *
 * `analysed`, `validated` and `inScope` arrive from `ResearchRun` — the qualification pipeline
 * records them at the one point where the rejected population is visible. All three are `null`
 * whenever the lists were served from an archive or a fallback rather than built by a live run,
 * because that population was observed on an earlier request and not on this one.
 *
 * `published` is `null` always: this product has no publication state distinct from qualification.
 * It is not derived by subtraction and never renders as zero (§3.2, §3.8).
 */
export type HeroFunnel = {
  analysed: number | null;
  validated: number | null;
  inScope: number | null;
  qualified: number | null;
  featured: number | null;
  published: number | null;
  /** Identifier of the rule behind each stage, where one exists. */
  rules: ResearchRunRules;
};

export type HomepageHeroModel = {
  funnel: HeroFunnel;
  /** Ranked strongest-first. Empty on a day with no qualified fixtures. */
  picks: HeroPick[];
  /** When the day's lists were retrieved. Null when the provider stamp is unusable. */
  fetchedAt: string | null;
};

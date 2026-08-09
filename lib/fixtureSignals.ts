import type {
  HistoricalMatch,
  LeagueSeasonContext,
  VenueSideStats,
} from "@/lib/footystats/matchDetail";

/* ============================================================================
   FIXTURE SIGNALS — the scoring behind the five-level page
   ----------------------------------------------------------------------------
   Pure and deterministic: the same inputs always produce the same signals in
   the same order. Nothing here reads a clock, a locale or a network.

   THE GRAMMAR. Every candidate normalizes to the same shape — a market, a
   count over a sample, the rate they imply, and the baseline the rate is read
   against. A signal that cannot state all four does not get to the top of the
   page: it keeps an explicit `baseline: null` state and lives in the detail
   level, never behind a silently invented number.

   THE SCORE. |rate − baseline| × reliability(sample).

   reliability(n) = n / (n + K)        for n ≥ MIN_RANK_SAMPLE (K = 5)
   reliability(n) = 0                  for n < MIN_RANK_SAMPLE

   The zero tier is the HARD CAP the architecture demands: a run over fewer
   than five matches is context, not a finding, and no deviation — however
   extreme — can rank it above a pattern observed ten times. Making the cap a
   property of the function (rather than a comparator special-case) keeps the
   invariant structural: score 0 can never exceed any positive score. For
   n ≥ 5 the curve is n/(n+5): 5 matches earn half weight, 10 earn two thirds,
   20 earn four fifths — monotonic, bounded, and cheap to explain in the ⓘ.

   A signal with no baseline scores 0 for the same reason the cap exists: a
   deviation from nothing is not a finding. The state is carried, not hidden.

   THE THRESHOLDS. L1 (the lead) requires LEAD_MIN_SCORE; L2 (supports)
   SUPPORT_MIN_SCORE; below that a signal is detail. Calibration: a season
   venue sample (n≈10–15) needs roughly a 13-point deviation to lead and a
   7-point deviation to support — a typical mid-data fixture yields one lead
   and three-to-five supports, a data-poor fixture yields none, and the page
   omits the level rather than padding it.
   ========================================================================== */

export type SignalMarket =
  | "over15"
  | "over25"
  | "over35"
  | "fh05"
  | "sh05"
  | "btts"
  | "cleanSheets"
  | "failedToScore";

export type SignalScope =
  | "home_venue"
  | "away_venue"
  | "recent_home"
  | "recent_away"
  | "h2h";

export type SignalDirection = "above_baseline" | "below_baseline" | "no_baseline";

export type FixtureSignal = {
  market: SignalMarket;
  direction: SignalDirection;
  /** Observed hits. */
  count: number;
  /** Observations behind the rate. */
  sample: number;
  /** 0–1. */
  rate: number;
  /** 0–1, or null — an explicit no-baseline state, never a stand-in number. */
  baseline: number | null;
  scope: SignalScope;
  /** `season` for venue aggregates, `last{n}` for recent windows. */
  window: string;
  score: number;
  level: "lead" | "support" | "detail";
};

export type FixtureSignalInputs = {
  homeAtHome: VenueSideStats | null | undefined;
  awayAtAway: VenueSideStats | null | undefined;
  leagueSeason: LeagueSeasonContext | null | undefined;
  history?: {
    homeAtHome?: HistoricalMatch[];
    awayAtAway?: HistoricalMatch[];
    headToHead?: HistoricalMatch[];
  } | null;
};

export type FixtureSignalReport = {
  lead: FixtureSignal | null;
  supports: FixtureSignal[];
  detail: FixtureSignal[];
};

/** Below this sample a signal cannot rank — reliability is zero, level is detail. */
export const MIN_RANK_SAMPLE = 5;
/** The reliability curve's half-weight point: n/(n+K). */
export const RELIABILITY_K = 5;
/** L1 eligibility. */
export const LEAD_MIN_SCORE = 0.09;
/** L2 eligibility. */
export const SUPPORT_MIN_SCORE = 0.045;
/** At most this many supporting rows — the level is a shortlist, not a table. */
export const MAX_SUPPORTS = 5;
/** Recent windows read at most this many matches, newest first. */
export const RECENT_WINDOW = 7;

export function reliability(sample: number): number {
  if (!Number.isFinite(sample) || sample < MIN_RANK_SAMPLE) return 0;
  return sample / (sample + RELIABILITY_K);
}

/** League baselines exist for exactly these markets; the rest carry `null` honestly. */
const LEAGUE_BASELINE_KEY: Partial<
  Record<SignalMarket, keyof Pick<LeagueSeasonContext, "over15" | "over25" | "fh05" | "sh05" | "btts">>
> = {
  over15: "over15",
  over25: "over25",
  fh05: "fh05",
  sh05: "sh05",
  btts: "btts",
};

/** The league's own sample must clear the same floor before it may serve as a baseline. */
export const LEAGUE_MIN_SAMPLE = 8;

function leagueBaseline(
  league: LeagueSeasonContext | null | undefined,
  market: SignalMarket
): number | null {
  const key = LEAGUE_BASELINE_KEY[market];
  if (!key || !league) return null;
  if (!Number.isFinite(league.played) || league.played < LEAGUE_MIN_SAMPLE) return null;
  const pct = league[key];
  if (!Number.isFinite(pct) || pct <= 0 || pct > 100) return null;
  return pct / 100;
}

function makeSignal(args: {
  market: SignalMarket;
  count: number;
  sample: number;
  baseline: number | null;
  scope: SignalScope;
  window: string;
}): FixtureSignal | null {
  const { market, count, sample, baseline, scope, window } = args;
  if (!Number.isFinite(sample) || sample <= 0) return null;
  if (!Number.isFinite(count) || count < 0 || count > sample) return null;
  const rate = count / sample;
  const direction: SignalDirection =
    baseline === null ? "no_baseline" : rate >= baseline ? "above_baseline" : "below_baseline";
  const score = baseline === null ? 0 : Math.abs(rate - baseline) * reliability(sample);
  return { market, direction, count, sample, rate, baseline, scope, window, score, level: "detail" };
}

/** Season venue aggregates → one candidate per market per side. */
function seasonSignals(
  side: VenueSideStats | null | undefined,
  scope: "home_venue" | "away_venue",
  league: LeagueSeasonContext | null | undefined
): FixtureSignal[] {
  if (!side) return [];
  const markets: SignalMarket[] = [
    "over15",
    "over25",
    "over35",
    "fh05",
    "sh05",
    "btts",
    "cleanSheets",
    "failedToScore",
  ];
  const out: FixtureSignal[] = [];
  for (const market of markets) {
    const stat = side[market as "over15"];
    if (!stat) continue;
    const signal = makeSignal({
      market,
      count: stat.hits,
      sample: stat.played,
      baseline: leagueBaseline(league, market),
      scope,
      window: "season",
    });
    if (signal) out.push(signal);
  }
  return out;
}

/** FT-score predicates for the recent windows. Half markets need half scores this history
 *  does not carry, so recent windows honestly cover only what a full-time score can settle. */
const FT_PREDICATES: Partial<Record<SignalMarket, (home: number, away: number) => boolean>> = {
  over15: (h, a) => h + a >= 2,
  over25: (h, a) => h + a >= 3,
  over35: (h, a) => h + a >= 4,
  btts: (h, a) => h > 0 && a > 0,
};

function recentSignals(
  matches: HistoricalMatch[] | undefined,
  scope: "recent_home" | "recent_away" | "h2h",
  league: LeagueSeasonContext | null | undefined
): FixtureSignal[] {
  if (!matches || matches.length === 0) return [];
  /* Newest first, deterministically: kickoff desc, id desc as the stable tie-break. */
  const window = [...matches]
    .sort((a, b) => (a.kickoffAt < b.kickoffAt ? 1 : a.kickoffAt > b.kickoffAt ? -1 : b.id - a.id))
    .slice(0, RECENT_WINDOW);
  const out: FixtureSignal[] = [];
  for (const market of Object.keys(FT_PREDICATES) as SignalMarket[]) {
    const hit = FT_PREDICATES[market];
    if (!hit) continue;
    let count = 0;
    let sample = 0;
    for (const m of window) {
      const h = m.home?.score;
      const a = m.away?.score;
      if (!Number.isFinite(h) || !Number.isFinite(a)) continue;
      sample += 1;
      if (hit(h, a)) count += 1;
    }
    const signal = makeSignal({
      market,
      count,
      sample,
      baseline: leagueBaseline(league, market),
      scope,
      window: `last${sample}`,
    });
    if (signal) out.push(signal);
  }
  return out;
}

/** score desc → sample desc → market A–Z → scope A–Z. Total and stable by construction. */
export function compareSignals(a: FixtureSignal, b: FixtureSignal): number {
  if (b.score !== a.score) return b.score - a.score;
  if (b.sample !== a.sample) return b.sample - a.sample;
  if (a.market !== b.market) return a.market < b.market ? -1 : 1;
  return a.scope < b.scope ? -1 : a.scope > b.scope ? 1 : 0;
}

/**
 * Score every candidate and split them into the page's levels.
 *
 * The lead is the single top signal at or above `LEAD_MIN_SCORE` — or null, and the page omits
 * the level (the empty-state law: never a filler headline). Supports are the next signals at or
 * above `SUPPORT_MIN_SCORE`, at most `MAX_SUPPORTS`. Everything else — small samples, missing
 * baselines, mild deviations — is detail, still carrying its honest components.
 */
export function scoreFixtureSignals(inputs: FixtureSignalInputs): FixtureSignalReport {
  const candidates: FixtureSignal[] = [
    ...seasonSignals(inputs.homeAtHome, "home_venue", inputs.leagueSeason),
    ...seasonSignals(inputs.awayAtAway, "away_venue", inputs.leagueSeason),
    ...recentSignals(inputs.history?.homeAtHome, "recent_home", inputs.leagueSeason),
    ...recentSignals(inputs.history?.awayAtAway, "recent_away", inputs.leagueSeason),
    ...recentSignals(inputs.history?.headToHead, "h2h", inputs.leagueSeason),
  ].sort(compareSignals);

  const lead = candidates.length > 0 && candidates[0].score >= LEAD_MIN_SCORE ? candidates[0] : null;
  if (lead) lead.level = "lead";

  const supports: FixtureSignal[] = [];
  const detail: FixtureSignal[] = [];
  for (const signal of candidates) {
    if (signal === lead) continue;
    if (signal.score >= SUPPORT_MIN_SCORE && supports.length < MAX_SUPPORTS) {
      signal.level = "support";
      supports.push(signal);
    } else {
      detail.push(signal);
    }
  }
  return { lead, supports, detail };
}

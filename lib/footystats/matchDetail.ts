import { unstable_cache } from "next/cache";
import {
  FOOTYSTATS_BASE_URL,
  getFootyStatsApiKey,
} from "./config";
import { teamImageUrl } from "./images";
import { footyStatsGptKey, type Locale } from "@/lib/i18n";
import { getFixtureOdds, type FixtureOdds } from "@/lib/api-football/odds";

type RawStats = Record<string, unknown>;

export type MarketHitStat = {
  hits: number;
  played: number;
  pct: number;
};

export type VenueSideStats = {
  played: number;
  over15: MarketHitStat;
  over25: MarketHitStat;
  over35: MarketHitStat;
  fh05: MarketHitStat;
  sh05: MarketHitStat;
  btts: MarketHitStat;
  cleanSheets: MarketHitStat;
  failedToScore: MarketHitStat;
  scoredAvg: number;
  concededAvg: number;
  xgFor?: number;
  xgAgainst?: number;
  pointsPerGame?: number;
  leaguePosition?: number;
  wins?: number;
  draws?: number;
  losses?: number;
};

export type MatchDetailPublic = {
  matchId: number;
  homeTeam: string;
  awayTeam: string;
  homeAtHome: VenueSideStats;
  awayAtAway: VenueSideStats;
  matchPotential: {
    over15: number;
    over25: number;
    fh05: number;
    sh05: number;
    over35?: number;
    btts?: number;
    avgGoals?: number;
  };
  prematchXg?: { home: number; away: number; total: number };
  leagueSeason?: LeagueSeasonContext;
  odds?: FixtureOdds;
  visitorCountry?: string;
  /** Server-signed affiliate CTAs by market key (from /api/match-detail). */
  signedPartnerOffersByMarket?: Record<
    string,
    Array<{
      partnerId: string;
      slug: string;
      displayName: string;
      bookmakerId?: number;
      odds?: number;
      oddsVerified: boolean;
      oddsUpdatedAt?: string;
      logo?: string;
      highlights: string[];
      crypto: boolean;
      rating: number;
      payoutTime?: string;
      licenses?: string[];
      outboundPath: string;
      availability: string;
      matchMethod: string;
      linkType: string;
    }>
  >;
  history: {
    homeAtHome: HistoricalMatch[];
    awayAtAway: HistoricalMatch[];
    headToHead: HistoricalMatch[];
  };
  ai: {
    expectation: string;
    reason: string;
  } | null;
};

export type LeagueSeasonContext = {
  played: number;
  avgGoals: number;
  over15: number;
  over25: number;
  fh05: number;
  sh05: number;
  btts: number;
  avgTotalXg?: number;
};

export type HistoricalMatch = {
  id: number;
  kickoffAt: string;
  home: { name: string; logo?: string; score: number };
  away: { name: string; logo?: string; score: number };
};

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function pct(v: unknown): number {
  const n = num(v);
  if (n > 0 && n <= 1) return Math.round(n * 100);
  return Math.round(n);
}

function marketHit(stats: RawStats, venue: "home" | "away", numKey: string, pctKey: string, played: number): MarketHitStat {
  let hits = num(stats[numKey]);
  let p = played > 0 ? played : num(stats[`seasonMatchesPlayed_${venue}`]);
  if (p < 0) p = 0;
  if (hits > p) hits = p;
  if (hits < 0) hits = 0;
  let pc = pct(stats[pctKey]);
  if (pc < 0) pc = 0;
  if (pc > 100) pc = 100;
  if (p > 0 && pc === 0 && hits > 0) {
    pc = Math.round((hits / p) * 100);
  }
  return { hits, played: p, pct: pc };
}

function venueStatsFromTeam(stats: RawStats, venue: "home" | "away"): VenueSideStats {
  const played = num(stats[`seasonMatchesPlayed_${venue}`]);
  return {
    played,
    over15: marketHit(stats, venue, `seasonOver15Num_${venue}`, `seasonOver15Percentage_${venue}`, played),
    over25: marketHit(stats, venue, `seasonOver25Num_${venue}`, `seasonOver25Percentage_${venue}`, played),
    over35: marketHit(
      stats,
      venue,
      `seasonOver35Num_${venue}`,
      `seasonOver35Percentage_${venue}`,
      played
    ),
    fh05: marketHit(stats, venue, `seasonOver05NumHT_${venue}`, `seasonOver05PercentageHT_${venue}`, played),
    sh05: marketHit(stats, venue, `over05_2hg_num_${venue}`, `over05_2hg_percentage_${venue}`, played),
    btts: marketHit(
      stats,
      venue,
      `seasonBTTSNum_${venue}`,
      `seasonBTTSPercentage_${venue}`,
      played
    ),
    cleanSheets: marketHit(stats, venue, `seasonCS_${venue}`, `seasonCSPercentage_${venue}`, played),
    failedToScore: marketHit(stats, venue, `seasonFTS_${venue}`, `seasonFTSPercentage_${venue}`, played),
    scoredAvg: num(stats[`seasonScoredAVG_${venue}`]),
    concededAvg: num(stats[`seasonConcededAVG_${venue}`]),
    xgFor: num(stats[`xg_for_avg_${venue}`]) || undefined,
    xgAgainst: num(stats[`xg_against_avg_${venue}`]) || undefined,
    pointsPerGame: num(stats[`seasonPPG_${venue}`]) || undefined,
    leaguePosition: num(stats[`leaguePosition_${venue}`]) || undefined,
    wins: num(stats[`seasonWinsNum_${venue}`]) || undefined,
    draws: num(stats[`seasonDrawsNum_${venue}`]) || undefined,
    losses: num(stats[`seasonLossesNum_${venue}`]) || undefined,
  };
}

const GPT_LOCALE_MAP: Record<string, string> = { ...footyStatsGptKey };

function gptTextForLocale(match: Record<string, unknown>, locale: string): string | null {
  const loc =
    footyStatsGptKey[locale as Locale] ?? GPT_LOCALE_MAP[locale] ?? "en";
  if (loc === "en") {
    const en = match.gpt_en;
    if (typeof en === "string" && en.trim()) return en.trim();
  }
  const gptInt = match.gpt_int;
  if (gptInt && typeof gptInt === "object") {
    const block = (gptInt as Record<string, unknown>)[loc];
    if (typeof block === "string" && block.trim()) return block.trim();
  }
  const en = match.gpt_en;
  if (typeof en === "string" && en.trim()) return en.trim();
  return null;
}

function isGarbageAiText(s: string): boolean {
  const t = s.trim();
  if (t.length < 12) return true;
  if (/^\d+$/.test(t)) return true;
  if (/^[\d\s.%]+$/.test(t)) return true;
  if (t.length < 25 && !/[a-zA-Z]{4,}/.test(t)) return true;
  return false;
}

export function simplifyGptAnalysis(full: string): { expectation: string; reason: string } | null {
  const normalized = full.replace(/\r\n/g, "\n").trim();
  if (!normalized || normalized.length < 40) return null;

  const lines = normalized.split("\n").map((l) => l.trim()).filter(Boolean);

  const predictionLine = lines.find((l) =>
    /prediction|predicción|tahmin|prognóstico|lectura|market|beklenti|resultado probable|likely/i.test(l)
  );
  const body = lines.filter((l) => l.length > 20 && !l.startsWith("-") && !/^Context/i.test(l));

  const sentences = normalized
    .replace(/\n+/g, " ")
    .match(/[^.!?]+[.!?]+/g)
    ?.map((s) => s.trim())
    .filter((s) => s.length > 20 && !isGarbageAiText(s)) ?? [];

  if (sentences.length === 0) return null;

  let expectation =
    predictionLine && predictionLine.length < 200 && !isGarbageAiText(predictionLine)
      ? predictionLine.replace(/^[^:]*:\s*/, "")
      : sentences.find((s) => /over|goal|win|BTTS|gol|victory|yüksek|high|under|score/i.test(s)) ||
        sentences[0];

  let reason =
    sentences.find(
      (s) =>
        s !== expectation &&
        /xG|home|away|evde|deplas|form|average|ortalama|because|çünkü|recent|trend/i.test(s)
    ) ||
    sentences.find((s) => s !== expectation) ||
    body[1] ||
    "";

  expectation = expectation.slice(0, 220).trim();
  reason = reason.slice(0, 200).trim();

  if (isGarbageAiText(expectation)) return null;
  if (reason && isGarbageAiText(reason)) reason = "";

  return { expectation, reason };
}

async function fetchJson(endpoint: string, params: Record<string, string>): Promise<unknown | null> {
  const { executeProviderCallSoft } = await import("@/lib/providers/reliability");
  const key = getFootyStatsApiKey();
  const url = new URL(`${FOOTYSTATS_BASE_URL}/${endpoint}`);
  url.searchParams.set("key", key);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return executeProviderCallSoft<unknown>({
    provider: "footystats",
    operation: endpoint === "team" ? "team_stats" : "fixture_detail",
    endpoint,
    fetch: (signal) =>
      fetch(url.toString(), {
        signal,
        next: { revalidate: 300 },
      }),
    parse: (res) => res.json(),
  });
}

async function fetchTeamStats(teamId: number, seasonId: number): Promise<RawStats | null> {
  const raw = await fetchJson("team", {
    team_id: String(teamId),
    season_id: String(seasonId),
  });
  if (!raw || typeof raw !== "object") return null;
  const data = (raw as { data?: unknown }).data;
  if (!Array.isArray(data) || data.length === 0) return null;
  const entry = data[0] as { stats?: RawStats };
  return entry.stats ?? null;
}

async function fetchLeagueMatches(seasonId: number): Promise<RawStats[]> {
  const raw = await fetchJson("league-matches", { season_id: String(seasonId) });
  if (!raw || typeof raw !== "object") return [];
  const data = (raw as { data?: unknown }).data;
  return Array.isArray(data) ? data.filter((match): match is RawStats => Boolean(match && typeof match === "object")) : [];
}

function historyMatch(raw: RawStats): HistoricalMatch | null {
  const id = num(raw.id);
  const kickoff = num(raw.date_unix);
  const home = String(raw.home_name ?? "");
  const away = String(raw.away_name ?? "");
  const homeScore = num(raw.homeGoalCount);
  const awayScore = num(raw.awayGoalCount);
  if (!id || !kickoff || !home || !away) return null;
  return {
    id,
    kickoffAt: new Date(kickoff * 1000).toISOString(),
    home: { name: home, logo: teamImageUrl(typeof raw.home_image === "string" ? raw.home_image : undefined), score: homeScore },
    away: { name: away, logo: teamImageUrl(typeof raw.away_image === "string" ? raw.away_image : undefined), score: awayScore },
  };
}

function completedBefore(raw: RawStats, kickoff: number): boolean {
  return String(raw.status).toLowerCase() === "complete" && num(raw.date_unix) < kickoff;
}

function validNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Uses only completed league matches before the target fixture's kickoff.
 * Outcome fields are derived from final scores rather than provider potentials.
 */
export function computeLeagueSeasonContext(matches: RawStats[]): LeagueSeasonContext | undefined {
  const outcomes = matches.flatMap((match) => {
    const homeGoals = validNumber(match.homeGoalCount);
    const awayGoals = validNumber(match.awayGoalCount);
    if (homeGoals === null || awayGoals === null || homeGoals < 0 || awayGoals < 0) return [];

    const halfTimeGoals = validNumber(match.HTGoalCount);
    const secondHalfGoals = validNumber(match.GoalCount_2hg);
    const totalXg = validNumber(match.total_xg);
    return [{
      totalGoals: homeGoals + awayGoals,
      halfTimeGoals: halfTimeGoals !== null && halfTimeGoals >= 0 ? halfTimeGoals : undefined,
      secondHalfGoals: secondHalfGoals !== null && secondHalfGoals >= 0 ? secondHalfGoals : undefined,
      btts: homeGoals > 0 && awayGoals > 0,
      totalXg: totalXg !== null && totalXg >= 0 ? totalXg : undefined,
    }];
  });
  if (outcomes.length < 5) return undefined;

  const rate = (predicate: (outcome: (typeof outcomes)[number]) => boolean) =>
    Math.round((outcomes.filter(predicate).length / outcomes.length) * 100);
  const withXg = outcomes.filter((outcome) => outcome.totalXg !== undefined);
  return {
    played: outcomes.length,
    avgGoals: Number((outcomes.reduce((sum, outcome) => sum + outcome.totalGoals, 0) / outcomes.length).toFixed(2)),
    over15: rate((outcome) => outcome.totalGoals >= 2),
    over25: rate((outcome) => outcome.totalGoals >= 3),
    fh05: rate((outcome) => outcome.halfTimeGoals !== undefined && outcome.halfTimeGoals >= 1),
    sh05: rate((outcome) => outcome.secondHalfGoals !== undefined && outcome.secondHalfGoals >= 1),
    btts: rate((outcome) => outcome.btts),
    avgTotalXg: withXg.length >= 5
      ? Number((withXg.reduce((sum, outcome) => sum + (outcome.totalXg ?? 0), 0) / withXg.length).toFixed(2))
      : undefined,
  };
}

type FixtureMatchContext = { competition?: string; country?: string };

async function fetchMatchDetailUncached(matchId: number, locale: string, context: FixtureMatchContext = {}): Promise<MatchDetailPublic | null> {
  const raw = await fetchJson("match", { match_id: String(matchId) });
  if (!raw || typeof raw !== "object") return null;
  const wrap = raw as { data?: Record<string, unknown> };
  const m = wrap.data;
  if (!m || typeof m !== "object") return null;

  const seasonId = num(m.competition_id);
  const homeId = num(m.homeID);
  const awayId = num(m.awayID);
  if (!seasonId || !homeId || !awayId) return null;

  const kickoff = num(m.date_unix);
  const [homeStats, awayStats, leagueMatches] = await Promise.all([
    fetchTeamStats(homeId, seasonId),
    fetchTeamStats(awayId, seasonId),
    // Large league payloads can exceed Next's unstable_cache item limit.
    // The outer match-detail cache still deduplicates this per fixture window.
    fetchLeagueMatches(seasonId),
  ]);

  if (!homeStats || !awayStats) return null;

  const gptRaw = gptTextForLocale(m, locale);
  const aiParsed = gptRaw ? simplifyGptAnalysis(gptRaw) : null;
  const ai = aiParsed?.expectation ? aiParsed : null;
  const completed = leagueMatches.filter((row) => completedBefore(row, kickoff));
  const leagueSeason = computeLeagueSeasonContext(completed);
  const homeAtHome = completed
    .filter((row) => num(row.homeID) === homeId)
    .sort((a, b) => num(b.date_unix) - num(a.date_unix))
    .slice(0, 5)
    .map(historyMatch)
    .filter((row): row is HistoricalMatch => row !== null);
  const awayAtAway = completed
    .filter((row) => num(row.awayID) === awayId)
    .sort((a, b) => num(b.date_unix) - num(a.date_unix))
    .slice(0, 5)
    .map(historyMatch)
    .filter((row): row is HistoricalMatch => row !== null);
  const h2hRows = m.h2h && typeof m.h2h === "object"
    ? (m.h2h as { previous_matches_ids?: unknown }).previous_matches_ids
    : [];
  const currentHomeImage = typeof m.home_image === "string" ? m.home_image : undefined;
  const currentAwayImage = typeof m.away_image === "string" ? m.away_image : undefined;
  const headToHead = (Array.isArray(h2hRows) ? h2hRows : [])
    .filter((row): row is RawStats => Boolean(row && typeof row === "object"))
    .filter((row) => num(row.date_unix) < kickoff)
    .sort((a, b) => num(b.date_unix) - num(a.date_unix))
    .slice(0, 5)
    .map((row): HistoricalMatch | null => {
      const homeIsCurrentHome = num(row.team_a_id) === homeId;
      const homeIsCurrentAway = num(row.team_a_id) === awayId;
      if (!homeIsCurrentHome && !homeIsCurrentAway) return null;
      const homeName = homeIsCurrentHome ? String(m.home_name) : String(m.away_name);
      const awayName = homeIsCurrentHome ? String(m.away_name) : String(m.home_name);
      return {
        id: num(row.id),
        kickoffAt: new Date(num(row.date_unix) * 1000).toISOString(),
        home: {
          name: homeName,
          logo: teamImageUrl(homeIsCurrentHome ? currentHomeImage : currentAwayImage),
          score: num(row.team_a_goals),
        },
        away: {
          name: awayName,
          logo: teamImageUrl(homeIsCurrentHome ? currentAwayImage : currentHomeImage),
          score: num(row.team_b_goals),
        },
      };
    })
    .filter((row): row is HistoricalMatch => row !== null);

  const detail: MatchDetailPublic = {
    matchId,
    homeTeam: String(m.home_name ?? ""),
    awayTeam: String(m.away_name ?? ""),
    homeAtHome: {
      ...venueStatsFromTeam(homeStats, "home"),
    },
    awayAtAway: {
      ...venueStatsFromTeam(awayStats, "away"),
    },
    matchPotential: {
      over15: pct(m.o15_potential),
      over25: pct(m.o25_potential),
      fh05: pct(m.o05HT_potential),
      sh05: pct(m.o05_2H_potential),
      over35: pct(m.o35_potential ?? m.o35Potential) || undefined,
      btts: pct(m.btts_potential ?? m.bttsPotential) || undefined,
      avgGoals: num(m.avg_potential) || undefined,
    },
    prematchXg:
      num(m.team_a_xg_prematch) > 0 &&
      num(m.team_b_xg_prematch) > 0 &&
      num(m.total_xg_prematch) > 0
        ? {
            home: num(m.team_a_xg_prematch),
            away: num(m.team_b_xg_prematch),
            total: num(m.total_xg_prematch),
          }
        : undefined,
    history: { homeAtHome, awayAtAway, headToHead },
    ai: ai && ai.expectation ? ai : null,
  };
  const odds = await getFixtureOdds({
    home: detail.homeTeam,
    away: detail.awayTeam,
    kickoffAt: new Date(kickoff * 1000).toISOString(),
    competition: context.competition,
    country: context.country,
  });
  return { ...detail, leagueSeason, ...(odds ? { odds } : {}) };
}

export async function getMatchDetail(matchId: number, locale = "en", context: FixtureMatchContext = {}): Promise<MatchDetailPublic | null> {
  return unstable_cache(
    () => fetchMatchDetailUncached(matchId, locale, context),
    ["footystats-match-detail", String(matchId), locale, context.competition ?? "", context.country ?? ""],
    { revalidate: 300 }
  )();
}

/** Live/header fields from the same FootyStats match endpoint (betting-relevant only). */
export type MatchLiveContext = {
  matchId: number;
  status: string;
  homeTeam: string;
  awayTeam: string;
  homeImage?: string;
  awayImage?: string;
  competition: string;
  country: string;
  venue: string | null;
  kickoffUnix: number;
  homeScore: number;
  awayScore: number;
  htHome: number | null;
  htAway: number | null;
  minute: number;
  possessionHome: number | null;
  possessionAway: number | null;
  shotsHome: number | null;
  shotsAway: number | null;
  shotsOnTargetHome: number | null;
  shotsOnTargetAway: number | null;
  xgHome: number | null;
  xgAway: number | null;
  cornersHome: number | null;
  cornersAway: number | null;
  cardsHome: number | null;
  cardsAway: number | null;
  dangerousAttacksHome: number | null;
  dangerousAttacksAway: number | null;
  events: Array<{
    id: string;
    type: "goal" | "red_card" | "other";
    minute: number | null;
    team: "home" | "away" | "unknown";
    label: string;
  }>;
  potentials: {
    over15: number;
    over25: number;
    fh05: number;
    sh05: number;
    btts: number | null;
  };
  fetchedAt: string;
};

function optionalNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * A live counting/percentage stat, or null.
 *
 * FootyStats returns `-1` as its "not recorded" sentinel, and `optionalNum` accepts it because
 * -1 is a finite number — which is how `Cards -1 / -1` reached the page. Every quantity this
 * guards (possession %, shots, xG, corners, cards, dangerous attacks) is non-negative by
 * definition, so a negative value is not a low reading, it is an absent one. Treated as absent,
 * the stat row is filtered out upstream rather than published as a negative count.
 */
export function nonNegativeNum(v: unknown): number | null {
  const n = optionalNum(v);
  return n != null && n >= 0 ? n : null;
}

function parseMatchEvents(raw: Record<string, unknown>, homeId: number, awayId: number): MatchLiveContext["events"] {
  const candidates = [raw.goals, raw.goalscorers, raw.events, raw.timeline];
  const out: MatchLiveContext["events"] = [];
  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue;
    candidate.forEach((item, index) => {
      if (!item || typeof item !== "object") return;
      const row = item as Record<string, unknown>;
      const minute = optionalNum(row.minute ?? row.time ?? row.min);
      const teamId = optionalNum(row.team_id ?? row.teamID ?? row.side_id);
      const team =
        teamId === homeId ? "home" : teamId === awayId ? "away" : "unknown";
      const text = String(row.player_name ?? row.score ?? row.type ?? row.event ?? "Event");
      const typeRaw = String(row.type ?? row.event_type ?? text).toLowerCase();
      const type: "goal" | "red_card" | "other" = typeRaw.includes("red")
        ? "red_card"
        : typeRaw.includes("goal") || row.home_scorer != null || row.away_scorer != null
          ? "goal"
          : "other";
      if (type === "other" && !typeRaw.includes("card")) return;
      out.push({
        id: `${type}-${minute ?? "x"}-${index}`,
        type,
        minute,
        team,
        label: text,
      });
    });
    if (out.length) break;
  }
  return out.slice(0, 40);
}

async function fetchMatchLiveUncached(matchId: number): Promise<MatchLiveContext | null> {
  const raw = await fetchJson("match", { match_id: String(matchId) });
  if (!raw || typeof raw !== "object") return null;
  const m = (raw as { data?: Record<string, unknown> }).data;
  if (!m || typeof m !== "object") return null;
  const homeId = num(m.homeID);
  const awayId = num(m.awayID);
  const htHomeRaw = m.ht_goals_team_a;
  const htAwayRaw = m.ht_goals_team_b;
  return {
    matchId,
    status: String(m.status ?? ""),
    homeTeam: String(m.home_name ?? ""),
    awayTeam: String(m.away_name ?? ""),
    homeImage: teamImageUrl(typeof m.home_image === "string" ? m.home_image : undefined),
    awayImage: teamImageUrl(typeof m.away_image === "string" ? m.away_image : undefined),
    competition: String(m.competition_name ?? m.league_name ?? ""),
    country: String(m.country ?? ""),
    venue: typeof m.stadium_name === "string" && m.stadium_name.trim()
      ? m.stadium_name.trim()
      : typeof m.venue === "string" && m.venue.trim()
        ? m.venue.trim()
        : null,
    kickoffUnix: num(m.date_unix),
    homeScore: num(m.homeGoalCount),
    awayScore: num(m.awayGoalCount),
    htHome: htHomeRaw != null && htHomeRaw !== "" ? Number(htHomeRaw) : null,
    htAway: htAwayRaw != null && htAwayRaw !== "" ? Number(htAwayRaw) : null,
    minute: num(m.minute),
    possessionHome: nonNegativeNum(m.team_a_possession ?? m.home_possession),
    possessionAway: nonNegativeNum(m.team_b_possession ?? m.away_possession),
    shotsHome: nonNegativeNum(m.team_a_shots ?? m.home_shots),
    shotsAway: nonNegativeNum(m.team_b_shots ?? m.away_shots),
    shotsOnTargetHome: nonNegativeNum(m.team_a_shotsOnTarget ?? m.home_shots_on_target),
    shotsOnTargetAway: nonNegativeNum(m.team_b_shotsOnTarget ?? m.away_shots_on_target),
    xgHome: nonNegativeNum(m.team_a_xg ?? m.home_xg),
    xgAway: nonNegativeNum(m.team_b_xg ?? m.away_xg),
    cornersHome: nonNegativeNum(m.team_a_corners ?? m.home_corners),
    cornersAway: nonNegativeNum(m.team_b_corners ?? m.away_corners),
    cardsHome: nonNegativeNum(m.team_a_cards_num ?? m.home_cards),
    cardsAway: nonNegativeNum(m.team_b_cards_num ?? m.away_cards),
    dangerousAttacksHome: nonNegativeNum(m.team_a_dangerous_attacks),
    dangerousAttacksAway: nonNegativeNum(m.team_b_dangerous_attacks),
    events: parseMatchEvents(m, homeId, awayId),
    potentials: {
      over15: pct(m.o15_potential),
      over25: pct(m.o25_potential),
      fh05: pct(m.o05HT_potential),
      sh05: pct(m.o05_2H_potential),
      btts: pct(m.btts_potential ?? m.bttsPotential) || null,
    },
    fetchedAt: new Date().toISOString(),
  };
}

export async function getMatchLiveContext(matchId: number): Promise<MatchLiveContext | null> {
  return unstable_cache(
    () => fetchMatchLiveUncached(matchId),
    ["footystats-match-live", String(matchId)],
    { revalidate: 60 }
  )();
}

/**
 * Bounded, failure-isolated detail enrichment for a small fixture surface.
 * `getMatchDetail` remains cache-backed, so duplicate fixture IDs do not
 * duplicate upstream work during a revalidation window.
 */
export async function getMatchDetails(
  matchIds: number[],
  locale = "en",
  concurrency = 3
): Promise<Map<number, MatchDetailPublic>> {
  const uniqueIds = [...new Set(matchIds)].filter((id) => Number.isSafeInteger(id) && id > 0);
  const results = new Map<number, MatchDetailPublic>();
  for (let index = 0; index < uniqueIds.length; index += concurrency) {
    const batch = uniqueIds.slice(index, index + concurrency);
    const settled = await Promise.allSettled(batch.map((id) => getMatchDetail(id, locale)));
    settled.forEach((result, batchIndex) => {
      if (result.status === "fulfilled" && result.value) {
        results.set(batch[batchIndex], result.value);
      }
    });
  }
  return results;
}

import type { DailyMatchLists, MatchListKind } from "@/lib/footystats/types";
import {
  mapDailyListsToQualifiedFixtures,
  type QualifiedFixture,
} from "@/lib/research/qualifiedFixture";
import {
  OPTIMIZER_MAX_CANDIDATES,
  OPTIMIZER_MAX_CANDIDATES_PER_MARKET,
  resolveMarketPreferences,
  slugifyTeam,
} from "./config";
import { evidenceFromQualifiedFixture, classifyOddsFreshness } from "./qualification";
import { scoreCandidate, sortCandidates } from "./scoring";
import type {
  ComboCandidate,
  ComboMarketPreference,
  ComboRequest,
  EnabledMarketConfig,
} from "./types";
import { ENABLED_MARKETS } from "./config";

export type OddsLookup = {
  /** Key: `${matchId}:${oddsMarketKey}` */
  get: (matchId: number, oddsKey: string) => {
    decimal: number;
    fetchedAt?: string;
  } | null;
};

function preferenceForListKind(kind: MatchListKind): ComboMarketPreference {
  const row = ENABLED_MARKETS.find((m) => m.listKind === kind);
  return row?.preference ?? "over_1_5";
}

function marketConfigForKind(kind: MatchListKind): EnabledMarketConfig | undefined {
  return ENABLED_MARKETS.find((m) => m.listKind === kind);
}

function competitionIdFromLeague(league: string): string {
  return slugifyTeam(league) || "competition";
}

function isUpcoming(fixture: QualifiedFixture, now: number): boolean {
  const kickoff = Date.parse(fixture.kickoffDateTime);
  return Number.isFinite(kickoff) && kickoff > now;
}

function isNotStarted(fixture: QualifiedFixture): boolean {
  // Daily list rows mapped to QualifiedFixture are pre-kickoff research queue items.
  return Boolean(fixture.kickoffDateTime);
}

/** Build a candidate from a qualified daily-list fixture. */
export function candidateFromQualifiedFixture(
  fixture: QualifiedFixture,
  request: ComboRequest,
  oddsLookup?: OddsLookup,
  now = Date.now()
): ComboCandidate | null {
  const market = marketConfigForKind(fixture.marketKind);
  if (!market) return null;
  if (!isUpcoming(fixture, now) || !isNotStarted(fixture)) return null;

  const enabled = resolveMarketPreferences(request.marketPreferences);
  if (!enabled.some((m) => m.listKind === fixture.marketKind)) return null;

  const evidence = evidenceFromQualifiedFixture(fixture);
  const oddsRow = oddsLookup?.get(fixture.matchId, market.oddsKey) ?? null;
  const odds = oddsRow?.decimal ?? null;
  const oddsFetchedAt = oddsRow?.fetchedAt;
  const oddsFreshness =
    odds == null
      ? ("unavailable" as const)
      : classifyOddsFreshness(oddsFetchedAt, now);

  const homeSlug = slugifyTeam(fixture.home);
  const awaySlug = slugifyTeam(fixture.away);
  const fixtureSlug = `${homeSlug}-vs-${awaySlug}`;
  const competitionId = competitionIdFromLeague(fixture.league);

  const base = {
    id: `${fixture.matchId}:${market.preference}`,
    fixtureId: String(fixture.matchId),
    fixtureSlug,
    matchId: fixture.matchId,
    competitionId,
    competitionName: fixture.league,
    homeTeamId: homeSlug,
    awayTeamId: awaySlug,
    homeTeam: fixture.home,
    awayTeam: fixture.away,
    countryCode: undefined,
    kickoffAt: fixture.kickoffDateTime,
    marketId: market.preference,
    marketKind: fixture.marketKind,
    oddsMarketKey: market.oddsKey,
    marketLabel: market.label,
    odds,
    oddsFetchedAt,
    oddsFreshness,
    modelProbability: fixture.modelProbability,
    evidenceStrength: evidence.evidenceStrength,
    coverage: evidence.coverage,
    qualifiedSample: evidence.qualifiedSample,
    qualificationStatus: "passed" as const,
    rejectionReasons: [] as string[],
    reasoning: [
      ...evidence.reasoning,
      {
        code: "market_preference" as const,
        label: `Market ${market.label}`,
      },
    ],
    evidenceSource: "daily_list" as const,
  };

  const { score, scoreBreakdown } = scoreCandidate(base, request);
  return { ...base, score, scoreBreakdown };
}

export function buildCandidatesFromFixtures(
  fixtures: readonly QualifiedFixture[],
  request: ComboRequest,
  oddsLookup?: OddsLookup,
  now = Date.now()
): ComboCandidate[] {
  const out: ComboCandidate[] = [];
  const seen = new Set<string>();

  for (const fixture of fixtures) {
    const candidate = candidateFromQualifiedFixture(fixture, request, oddsLookup, now);
    if (!candidate || seen.has(candidate.id)) continue;
    seen.add(candidate.id);
    out.push(candidate);
  }

  return sortCandidates(out);
}

export function buildCandidatesFromDailyLists(
  lists: DailyMatchLists,
  request: ComboRequest,
  oddsLookup?: OddsLookup,
  now = Date.now()
): ComboCandidate[] {
  const fixtures = mapDailyListsToQualifiedFixtures(lists, request.locale);
  return buildCandidatesFromFixtures(fixtures, request, oddsLookup, now);
}

/** Bound pool for optimizer — per-market then global cap. */
export function boundCandidatePool(
  candidates: readonly ComboCandidate[]
): ComboCandidate[] {
  const byMarket = new Map<string, ComboCandidate[]>();
  for (const candidate of sortCandidates([...candidates])) {
    const key = candidate.marketId;
    const bucket = byMarket.get(key) ?? [];
    if (bucket.length >= OPTIMIZER_MAX_CANDIDATES_PER_MARKET) continue;
    bucket.push(candidate);
    byMarket.set(key, bucket);
  }
  const merged = sortCandidates([...byMarket.values()].flat());
  return merged.slice(0, OPTIMIZER_MAX_CANDIDATES);
}

export function attachOddsToCandidates(
  candidates: readonly ComboCandidate[],
  oddsLookup: OddsLookup,
  request: ComboRequest,
  now = Date.now()
): ComboCandidate[] {
  return sortCandidates(
    candidates.map((candidate) => {
      const row = oddsLookup.get(candidate.matchId, candidate.oddsMarketKey);
      if (!row) return candidate;
      const next = {
        ...candidate,
        odds: row.decimal,
        oddsFetchedAt: row.fetchedAt,
        oddsFreshness: classifyOddsFreshness(row.fetchedAt, now),
        reasoning: [
          ...candidate.reasoning.filter((r) => r.code !== "odds_available"),
          {
            code: "odds_available" as const,
            label: `Odds ${row.decimal.toFixed(2)}`,
            detail: row.fetchedAt ? `Fetched ${row.fetchedAt}` : undefined,
          },
        ],
      };
      const { score, scoreBreakdown } = scoreCandidate(next, request);
      return { ...next, score, scoreBreakdown };
    })
  );
}

export function createMapOddsLookup(
  entries: ReadonlyArray<{
    matchId: number;
    oddsKey: string;
    decimal: number;
    fetchedAt?: string;
  }>
): OddsLookup {
  const map = new Map<string, { decimal: number; fetchedAt?: string }>();
  for (const entry of entries) {
    map.set(`${entry.matchId}:${entry.oddsKey}`, {
      decimal: entry.decimal,
      fetchedAt: entry.fetchedAt,
    });
  }
  return {
    get(matchId, oddsKey) {
      return map.get(`${matchId}:${oddsKey}`) ?? null;
    },
  };
}

export function preferenceForKind(kind: MatchListKind): ComboMarketPreference {
  return preferenceForListKind(kind);
}

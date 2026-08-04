import { unstable_cache } from "next/cache";
import { z } from "zod";
import { apiFootballGet } from "./request";
import { appendFixtureOddsHistory } from "@/lib/odds-history/service";

export type OddsMarketKey = "fh" | "over15" | "over25" | "sh";
export type OddsCoverage = "full" | "partial" | "single-bookmaker" | "unavailable" | "ambiguous-fixture";

export type FixtureOdds = {
  fixtureId: number;
  fetchedAt: string;
  coverage: OddsCoverage;
  markets: Array<{
    key: OddsMarketKey;
    label: string;
    bookmakers: Array<{ id: number; name: string; decimal: number }>;
  }>;
  diagnostics?: OddsDiagnostics;
};

export type OddsDiagnostics = {
  fixtureMatch: { confidence: number; rejectionReasons: string[] };
  bookmakersReturned: number;
  marketsReturned: number;
  candidateOdds: number;
  acceptedOdds: number;
  rejectedOdds: Record<string, number>;
  pages: number;
};

const fixtureSchema = z.object({
  fixture: z.object({ id: z.number(), date: z.string() }),
  teams: z.object({
    home: z.object({ name: z.string() }),
    away: z.object({ name: z.string() }),
  }),
  league: z.object({ name: z.string().optional(), country: z.string().optional() }).optional(),
});

const oddsResponseSchema = z.object({
  paging: z.object({ current: z.number().optional(), total: z.number().optional() }).optional(),
  response: z.array(z.object({
    bookmakers: z.array(z.object({
      id: z.number(),
      name: z.string(),
      bets: z.array(z.object({
        name: z.string(),
        values: z.array(z.object({
          value: z.union([z.string(), z.number()]).transform(String),
          odd: z.union([z.string(), z.number()]),
          handicap: z.union([z.string(), z.number()]).optional(),
        })),
      })),
    })),
  })),
});

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(\d+)(st|nd|rd|th)\b/g, "$1")
    .replace(/\b(fc|fk|afc|cf|sc)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function nameScore(left: string, right: string): number {
  const a = normalize(left);
  const b = normalize(right);
  if (!a || !b) return 0;
  if (a === b) return 3;
  if (a.length >= 5 && b.length >= 5 && (a.includes(b) || b.includes(a))) return 2;
  return 0;
}

export function inspectApiFootballFixtureMatch(
  candidates: unknown[],
  target: { home: string; away: string; kickoffAt: string; competition?: string; country?: string }
): { fixtureId: number | null; confidence: number; rejectionReasons: string[] } {
  const targetKickoff = Date.parse(target.kickoffAt);
  if (!Number.isFinite(targetKickoff)) return { fixtureId: null, confidence: 0, rejectionReasons: ["invalid-kickoff"] };
  const matches = candidates.flatMap((candidate) => {
    const parsed = fixtureSchema.safeParse(candidate);
    if (!parsed.success) return [];
    const kickoff = Date.parse(parsed.data.fixture.date);
    const homeScore = nameScore(target.home, parsed.data.teams.home.name);
    const awayScore = nameScore(target.away, parsed.data.teams.away.name);
    const kickoffDelta = Math.abs(kickoff - targetKickoff);
    const competitionScore = target.competition ? nameScore(target.competition, parsed.data.league?.name ?? "") : 0;
    const countryScore = target.country ? nameScore(target.country, parsed.data.league?.country ?? "") : 0;
    if (homeScore < 2 || awayScore < 2 || kickoffDelta > 45 * 60 * 1000) return [];
    if (target.country && countryScore === 0) return [];
    return [{ id: parsed.data.fixture.id, score: homeScore + awayScore + competitionScore + countryScore - kickoffDelta / (60 * 60 * 1000) }];
  }).sort((a, b) => b.score - a.score);
  if (!matches.length) return { fixtureId: null, confidence: 0, rejectionReasons: ["no-fixture-with-strong-team-and-kickoff-match"] };
  if (matches.length > 1 && Math.abs(matches[0].score - matches[1].score) < 0.5) {
    return { fixtureId: null, confidence: 0, rejectionReasons: ["ambiguous-fixture-candidates"] };
  }
  return { fixtureId: matches[0].id, confidence: Math.round(Math.min(100, matches[0].score / 6 * 100)), rejectionReasons: [] };
}

export function matchApiFootballFixture(
  candidates: unknown[],
  target: { home: string; away: string; kickoffAt: string }
): number | null {
  return inspectApiFootballFixtureMatch(candidates, target).fixtureId;
}

const aliases: Record<OddsMarketKey, string[]> = {
  fh: ["goals overunder first half", "first half goals", "first half overunder", "overunder 1st half", "1st half total goals"],
  sh: ["goals overunder second half", "second half goals", "second half overunder", "overunder 2nd half", "2nd half total goals"],
  over15: ["goals overunder", "match goals", "overunder", "total goals", "goals over under"],
  over25: ["goals overunder", "match goals", "overunder", "total goals", "goals over under"],
};

function normalizedMarketName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function marketKey(betName: string, value: string, handicap?: string | number): OddsMarketKey | null {
  const bet = normalizedMarketName(betName);
  const line = `${value} ${handicap ?? ""}`.toLowerCase().replace(",", ".");
  const isOver = /\bover\b|(^|\s)o\s*0?\./.test(line);
  if (!isOver) return null;
  const aliasMatch = (key: OddsMarketKey) => aliases[key].some((alias) => bet === normalizedMarketName(alias));
  if (aliasMatch("fh") && /0\.5/.test(line)) return "fh";
  if (aliasMatch("sh") && /0\.5/.test(line)) return "sh";
  if (aliasMatch("over15") && /1\.5/.test(line)) return "over15";
  if (aliasMatch("over25") && /2\.5/.test(line)) return "over25";
  return null;
}

const marketLabels: Record<OddsMarketKey, string> = {
  fh: "1st Half Over 0.5",
  over15: "Over 1.5 Goals",
  over25: "Over 2.5 Goals",
  sh: "2nd Half Over 0.5",
};

export function parseFixtureOdds(raw: unknown, fixtureId: number, diagnostics?: OddsDiagnostics): FixtureOdds | null {
  const parsed = oddsResponseSchema.safeParse(raw);
  if (!parsed.success) return null;
  const grouped = new Map<OddsMarketKey, Map<number, { name: string; decimal: number }>>();
  const rawBookmakers = new Set<number>();
  const rawMarkets = new Set<string>();
  let candidateOdds = 0;
  let acceptedOdds = 0;
  const rejectedOdds: Record<string, number> = {};
  const reject = (reason: string) => { rejectedOdds[reason] = (rejectedOdds[reason] ?? 0) + 1; };
  for (const response of parsed.data.response) {
    for (const bookmaker of response.bookmakers) {
      rawBookmakers.add(bookmaker.id);
      for (const bet of bookmaker.bets) {
        rawMarkets.add(bet.name);
        for (const selection of bet.values) {
          candidateOdds += 1;
          const key = marketKey(bet.name, selection.value, selection.handicap);
          const decimal = Number(selection.odd);
          if (!key) { reject("unsupported-or-inexact-market"); continue; }
          if (!Number.isFinite(decimal) || decimal <= 1) { reject("invalid-decimal-odds"); continue; }
          const market = grouped.get(key) ?? new Map<number, { name: string; decimal: number }>();
          const existing = market.get(bookmaker.id);
          if (!existing || decimal > existing.decimal) market.set(bookmaker.id, { name: bookmaker.name, decimal });
          grouped.set(key, market);
          acceptedOdds += 1;
        }
      }
    }
  }
  const markets = [...grouped.entries()].map(([key, bookmakers]) => ({
    key,
    label: marketLabels[key],
    bookmakers: [...bookmakers.entries()]
      .map(([id, bookmaker]) => ({ id, ...bookmaker }))
      .sort((a, b) => b.decimal - a.decimal),
  })).filter((market) => market.bookmakers.length > 0);
  if (!markets.length) return null;
  const bookmakerCount = new Set(markets.flatMap((market) => market.bookmakers.map((bookmaker) => bookmaker.id))).size;
  const coverage: OddsCoverage = bookmakerCount === 1 ? "single-bookmaker" : markets.length < 4 ? "partial" : "full";
  return {
    fixtureId,
    fetchedAt: new Date().toISOString(),
    coverage,
    markets,
    ...(diagnostics ? {
      diagnostics: {
        ...diagnostics,
        bookmakersReturned: rawBookmakers.size,
        marketsReturned: rawMarkets.size,
        candidateOdds,
        acceptedOdds,
        rejectedOdds,
      },
    } : {}),
  };
}

async function fetchOddsPages(fixtureId: number): Promise<{ response: unknown[]; pages: number } | null> {
  const first = await apiFootballGet<unknown>(
    "odds",
    { fixture: String(fixtureId), page: "1" },
    { operation: "odds_fetch" }
  );
  const parsed = oddsResponseSchema.safeParse(first);
  if (!parsed.success) return null;
  const total = Math.max(1, parsed.data.paging?.total ?? 1);
  const response = [...parsed.data.response];
  for (let page = 2; page <= total; page += 1) {
    const next = await apiFootballGet<unknown>(
      "odds",
      { fixture: String(fixtureId), page: String(page) },
      { operation: "odds_fetch" }
    );
    const nextParsed = oddsResponseSchema.safeParse(next);
    if (nextParsed.success) response.push(...nextParsed.data.response);
  }
  return { response, pages: total };
}

async function fetchFixtureOdds(target: { home: string; away: string; kickoffAt: string; competition?: string; country?: string }): Promise<FixtureOdds | null> {
  const date = target.kickoffAt.slice(0, 10);
  const fixtures = await apiFootballGet<{ response?: unknown[] }>("fixtures", { date, timezone: "UTC" });
  const fixtureMatch = inspectApiFootballFixtureMatch(fixtures?.response ?? [], target);
  if (!fixtureMatch.fixtureId) return null;
  const odds = await fetchOddsPages(fixtureMatch.fixtureId);
  const diagnostics = process.env.NODE_ENV === "development" ? {
    fixtureMatch: { confidence: fixtureMatch.confidence, rejectionReasons: fixtureMatch.rejectionReasons },
    bookmakersReturned: 0,
    marketsReturned: 0,
    candidateOdds: 0,
    acceptedOdds: 0,
    rejectedOdds: {},
    pages: odds?.pages ?? 0,
  } : undefined;
  const parsedOdds = odds
    ? parseFixtureOdds({ response: odds.response }, fixtureMatch.fixtureId, diagnostics)
    : null;
  if (parsedOdds) await appendFixtureOddsHistory(parsedOdds);
  return parsedOdds;
}

export async function getFixtureOdds(target: { home: string; away: string; kickoffAt: string; competition?: string; country?: string }): Promise<FixtureOdds | null> {
  return unstable_cache(
    () => fetchFixtureOdds(target),
    /*
     * The disambiguation context belongs in the key because `fetchFixtureOdds` USES it to choose
     * which api-football fixture matches (`nameScore` on league name and country, and a hard
     * reject at line 93 when the country cannot be matched). A caller that supplies no context
     * gets a looser match, and without these components its looser result would be served to a
     * caller that supplied one. Both are attributes of the fixture, not of the visitor, so this
     * adds at most one extra entry per fixture — it does not reintroduce per-locale fragmentation.
     */
    [
      "api-football-fixture-odds",
      target.home,
      target.away,
      target.kickoffAt,
      target.competition ?? "",
      target.country ?? "",
    ],
    { revalidate: 120 }
  )();
}

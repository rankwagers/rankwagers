import { z } from "zod";
import type { DailyMatchLists, FootyMatchRow, MatchListKind } from "@/lib/footystats/types";
import {
  confidenceForListKind,
  formatFixtureKickoff,
  formatFixtureUpdate,
  marketForListKind,
} from "./fixturePresentation";

const footyRowSchema = z.object({
  matchId: z.number().int().positive(),
  homeTeam: z.string().trim().min(1),
  awayTeam: z.string().trim().min(1),
  competition: z.string().trim().min(1).catch("Competition unavailable"),
  country: z.string().trim().min(1).optional(),
  countryCode: z.string().optional(),
  homeImage: z.string().url().optional(),
  awayImage: z.string().url().optional(),
  kickoffTime: z.number().finite().positive(),
  over15Pct: z.number().finite().min(0).max(100),
  fhOver05Pct: z.number().finite().min(0).max(100),
  over25Pct: z.number().finite().min(0).max(100),
  shOver05Pct: z.number().finite().min(0).max(100),
});

export type QualifiedFixture = {
  id: string;
  matchId: number;
  marketKind: MatchListKind;
  league: string;
  country?: string;
  leagueCode: string;
  home: string;
  away: string;
  homeImage?: string;
  awayImage?: string;
  kickoff: string;
  kickoffDateTime: string;
  market: string;
  marketCode: string;
  /** Provider potential is a model probability; it is never presented as confidence. */
  modelProbability: number;
  updatedAt: string;
  updatedDateTime: string;
  venue: "Venue data pending";
  operatorStatus: "unavailable";
};

function leagueCode(row: Pick<FootyMatchRow, "competition" | "countryCode">): string {
  const words = row.competition.match(/[A-Za-z0-9]+/g) ?? [];
  const fromLeague = words.map((word) => word[0]).join("").slice(0, 4).toUpperCase();
  return fromLeague || row.countryCode?.slice(0, 3).toUpperCase() || "INT";
}

/** Validates external list data before it reaches any research interface component. */
export function mapApiFixtureToQualifiedFixture(
  rawFixture: FootyMatchRow,
  kind: MatchListKind,
  fetchedAt: string,
  locale = "en-GB",
  timeZone?: string
): QualifiedFixture | null {
  const parsed = footyRowSchema.safeParse(rawFixture);
  if (!parsed.success) return null;
  const row = parsed.data;
  const market = marketForListKind(kind);
  const modelProbability = Math.round(confidenceForListKind(row as FootyMatchRow, kind));
  return {
    id: `${row.matchId}-${kind}`,
    matchId: row.matchId,
    marketKind: kind,
    league: row.competition,
    country: row.country,
    leagueCode: leagueCode(row as FootyMatchRow),
    home: row.homeTeam,
    away: row.awayTeam,
    homeImage: row.homeImage,
    awayImage: row.awayImage,
    kickoff: formatFixtureKickoff(row.kickoffTime, locale, timeZone),
    kickoffDateTime: new Date(row.kickoffTime * 1000).toISOString(),
    market: market.label,
    marketCode: market.code,
    modelProbability,
    updatedAt: formatFixtureUpdate(fetchedAt),
    updatedDateTime: fetchedAt,
    venue: "Venue data pending",
    operatorStatus: "unavailable",
  };
}

export function mapDailyListsToQualifiedFixtures(
  lists: DailyMatchLists,
  locale = "en-GB",
  timeZone?: string
): QualifiedFixture[] {
  const result: QualifiedFixture[] = [];
  const groups: Array<[MatchListKind, FootyMatchRow[]]> = [
    ["fh", lists.fh],
    ["over15", lists.over15],
    ["over25", lists.over25],
    ["sh", lists.sh],
  ];
  for (const [kind, rows] of groups) {
    for (const row of rows) {
      const fixture = mapApiFixtureToQualifiedFixture(row, kind, lists.fetchedAt, locale, timeZone);
      if (fixture) result.push(fixture);
    }
  }
  return result;
}

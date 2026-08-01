import { NextRequest, NextResponse } from "next/server";
import { getDailyMatchListsSafe, emptyLists, todayMatchDateStr } from "@/lib/footystats/client";
import { searchHomepageFixtures } from "@/lib/search/homeFixtureSearch";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") ?? "";
  const result = await getDailyMatchListsSafe(todayMatchDateStr());
  const lists = "error" in result ? emptyLists() : result;
  const fixtures = [...lists.fh, ...lists.over15, ...lists.over25, ...lists.sh].map((row) => ({
    matchId: row.matchId,
    home: row.homeTeam,
    away: row.awayTeam,
    league: row.competition,
    competition: row.competition,
  }));
  const uniqueFixtures = [...new Map(fixtures.map((fixture) => [fixture.matchId, fixture])).values()];
  return NextResponse.json({ results: searchHomepageFixtures(uniqueFixtures, query).slice(0, 8) });
}

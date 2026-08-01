export type HomepageSearchableFixture = {
  matchId: number;
  home: string;
  away: string;
  league: string;
  competition?: string;
};

export type HomepageSearchResult = {
  fixtureId: number;
  label: string;
  resultType: "team" | "league" | "competition";
  resultId: string;
};

export function normalizeHomepageSearch(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

export function searchHomepageFixtures<T extends HomepageSearchableFixture>(
  fixtures: readonly T[],
  query: string
): HomepageSearchResult[] {
  const normalizedQuery = normalizeHomepageSearch(query);
  if (!normalizedQuery) return [];

  const results: HomepageSearchResult[] = [];
  const seen = new Set<number>();

  for (const fixture of fixtures) {
    if (seen.has(fixture.matchId)) continue;
    const teamMatches = [fixture.home, fixture.away]
      .some((team) => normalizeHomepageSearch(team).includes(normalizedQuery));
    const leagueMatches = normalizeHomepageSearch(fixture.league).includes(normalizedQuery);
    const competitionMatches = fixture.competition
      ? normalizeHomepageSearch(fixture.competition).includes(normalizedQuery)
      : false;
    const resultType = teamMatches ? "team" : leagueMatches ? "league" : competitionMatches ? "competition" : null;
    if (!resultType) continue;
    seen.add(fixture.matchId);
    results.push({
      fixtureId: fixture.matchId,
      label: `${fixture.home} vs ${fixture.away} · ${fixture.league}`,
      resultType,
      resultId: String(fixture.matchId),
    });
  }

  return results;
}

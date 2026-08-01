import { fixturesForCompetition } from "@/lib/competitions/stats";
import { getCompetition } from "@/lib/competitions/registry";
import { getMarket, marketSlugForListKind } from "@/lib/markets/registry";
import type { QualifiedFixture } from "@/lib/research/qualifiedFixture";
import { resolveRegisteredTeam } from "@/lib/teams/registry";
import type { TeamEntity } from "@/lib/teams/types";
import type { SeasonEntity, SeasonIntelligence, SeasonMarketRow } from "./types";

export function fixturesForSeason(
  season: SeasonEntity,
  fixtures: readonly QualifiedFixture[]
): QualifiedFixture[] {
  const competition = getCompetition(season.competitionSlug);
  if (!competition) return [];
  // Current architecture: daily qualified queue is the active season research sample.
  // Historical season archives are not fabricated when provider season IDs are absent.
  if (!season.active) return [];
  return fixturesForCompetition(competition, fixtures);
}

function sampleQuality(count: number): SeasonIntelligence["sampleQuality"] {
  if (count <= 0) return "none";
  if (count < 3) return "very-limited";
  if (count < 8) return "limited";
  return "adequate";
}

function sampleNote(quality: SeasonIntelligence["sampleQuality"], count: number): string {
  switch (quality) {
    case "none":
      return "No qualified fixture rows currently match this season in the research queue.";
    case "very-limited":
      return `Very limited sample (${count} qualified market rows). Frequencies are directional only.`;
    case "limited":
      return `Limited sample (${count} qualified market rows). Coverage may not represent the full season.`;
    case "adequate":
      return `${count} qualified market rows in the current research sample for this season.`;
  }
}

export function buildSeasonIntelligence(
  season: SeasonEntity,
  fixtures: readonly QualifiedFixture[]
): SeasonIntelligence {
  const matched = fixturesForSeason(season, fixtures);
  const now = Date.now();
  const unique = new Set(matched.map((fixture) => fixture.matchId));
  let upcomingCount = 0;
  let completedCount = 0;
  let homeRows = 0;
  let awayRows = 0;

  for (const fixture of matched) {
    const kickoff = Date.parse(fixture.kickoffDateTime);
    if (kickoff >= now) upcomingCount += 1;
    else completedCount += 1;
    homeRows += 1;
    awayRows += 1;
  }

  const byMarket = new Map<string, { count: number; sum: number }>();
  for (const fixture of matched) {
    const slug = marketSlugForListKind(fixture.marketKind);
    if (!slug) continue;
    const current = byMarket.get(slug) ?? { count: 0, sum: 0 };
    current.count += 1;
    current.sum += fixture.modelProbability;
    byMarket.set(slug, current);
  }

  const marketProfile: SeasonMarketRow[] = [...byMarket.entries()]
    .map(([marketSlug, row]) => {
      const market = getMarket(marketSlug);
      return {
        marketSlug,
        marketLabel: market?.name ?? marketSlug,
        qualifiedCount: row.count,
        averageModelProbability: row.count ? Math.round(row.sum / row.count) : null,
      };
    })
    .sort((left, right) => right.qualifiedCount - left.qualifiedCount);

  const teams = participatingTeams(season, matched);
  const avg =
    matched.length === 0
      ? null
      : Math.round(
          matched.reduce((sum, fixture) => sum + fixture.modelProbability, 0) / matched.length
        );
  const quality = sampleQuality(matched.length);

  return {
    qualifiedFixtureCount: matched.length,
    uniqueMatchCount: unique.size,
    upcomingCount,
    completedCount,
    participatingTeamCount: teams.length,
    homeRows,
    awayRows,
    averageModelProbability: avg,
    marketProfile,
    sampleQuality: quality,
    sampleNote: sampleNote(quality, matched.length),
    hasGoalEnrichment: false,
  };
}

export function participatingTeams(
  season: SeasonEntity,
  fixtures: readonly QualifiedFixture[]
): TeamEntity[] {
  const matched = fixturesForSeason(season, fixtures);
  const bySlug = new Map<string, TeamEntity>();
  for (const fixture of matched) {
    for (const name of [fixture.home, fixture.away]) {
      const resolved = resolveRegisteredTeam({
        name,
        competitionSlug: season.competitionSlug,
      });
      if (resolved.status === "matched") {
        bySlug.set(resolved.team.slug, resolved.team);
      }
    }
  }
  return [...bySlug.values()].sort((left, right) => left.name.localeCompare(right.name));
}

export function upcomingSeasonFixtures(
  season: SeasonEntity,
  fixtures: readonly QualifiedFixture[],
  limit = 8
): QualifiedFixture[] {
  const now = Date.now();
  return fixturesForSeason(season, fixtures)
    .filter((fixture) => Date.parse(fixture.kickoffDateTime) >= now)
    .sort(
      (left, right) =>
        Date.parse(left.kickoffDateTime) - Date.parse(right.kickoffDateTime)
    )
    .slice(0, limit);
}

export function recentSeasonFixtures(
  season: SeasonEntity,
  fixtures: readonly QualifiedFixture[],
  limit = 6
): QualifiedFixture[] {
  const now = Date.now();
  return fixturesForSeason(season, fixtures)
    .filter((fixture) => Date.parse(fixture.kickoffDateTime) < now)
    .sort(
      (left, right) =>
        Date.parse(right.kickoffDateTime) - Date.parse(left.kickoffDateTime)
    )
    .slice(0, limit);
}

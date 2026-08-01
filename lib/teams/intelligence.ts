import { getMarket, marketSlugForListKind } from "@/lib/markets/registry";
import type { QualifiedFixture } from "@/lib/research/qualifiedFixture";
import { normalizeTeamName, resolveTeam } from "./resolver";
import type { TeamEntity, TeamIntelligence, TeamMarketProfileRow } from "./types";

function sideMatchesTeam(team: TeamEntity, sideName: string): boolean {
  const result = resolveTeam([team], { name: sideName });
  if (result.status === "matched") return true;
  const normalized = normalizeTeamName(sideName);
  if (!normalized) return false;
  if (normalizeTeamName(team.name) === normalized) return true;
  if (team.shortName && normalizeTeamName(team.shortName) === normalized) return true;
  return (team.aliases ?? []).some((alias) => normalizeTeamName(alias) === normalized);
}

export function fixturesForTeam(
  team: TeamEntity,
  fixtures: readonly QualifiedFixture[]
): QualifiedFixture[] {
  return fixtures.filter(
    (fixture) =>
      sideMatchesTeam(team, fixture.home) || sideMatchesTeam(team, fixture.away)
  );
}

function sampleQuality(count: number): TeamIntelligence["sampleQuality"] {
  if (count <= 0) return "none";
  if (count < 3) return "very-limited";
  if (count < 8) return "limited";
  return "adequate";
}

function sampleNote(quality: TeamIntelligence["sampleQuality"], count: number): string {
  switch (quality) {
    case "none":
      return "No qualified fixture rows currently match this team in the research queue.";
    case "very-limited":
      return `Very limited sample (${count} qualified market rows). Treat frequencies as directional only.`;
    case "limited":
      return `Limited sample (${count} qualified market rows). Coverage may not represent a full season.`;
    case "adequate":
      return `${count} qualified market rows in the current research sample.`;
  }
}

/**
 * Factual team intelligence from the qualified fixture queue only.
 * Does not invent goals, xG, or tipster ratings.
 */
export function buildTeamIntelligence(
  team: TeamEntity,
  fixtures: readonly QualifiedFixture[]
): TeamIntelligence {
  const matched = fixturesForTeam(team, fixtures);
  const uniqueMatchIds = new Set(matched.map((fixture) => fixture.matchId));

  let homeAppearances = 0;
  let awayAppearances = 0;
  for (const fixture of matched) {
    if (sideMatchesTeam(team, fixture.home)) homeAppearances += 1;
    if (sideMatchesTeam(team, fixture.away)) awayAppearances += 1;
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

  const marketProfile: TeamMarketProfileRow[] = [...byMarket.entries()]
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

  const avg =
    matched.length === 0
      ? null
      : Math.round(
          matched.reduce((sum, fixture) => sum + fixture.modelProbability, 0) / matched.length
        );

  const quality = sampleQuality(matched.length);

  return {
    matchesInSample: matched.length,
    uniqueMatchCount: uniqueMatchIds.size,
    homeAppearances,
    awayAppearances,
    averageModelProbability: avg,
    marketProfile,
    sampleQuality: quality,
    sampleNote: sampleNote(quality, matched.length),
    hasGoalEnrichment: false,
  };
}

export function upcomingTeamFixtures(
  team: TeamEntity,
  fixtures: readonly QualifiedFixture[],
  limit = 8
): QualifiedFixture[] {
  const now = Date.now();
  return fixturesForTeam(team, fixtures)
    .filter((fixture) => Date.parse(fixture.kickoffDateTime) >= now)
    .sort(
      (left, right) =>
        Date.parse(left.kickoffDateTime) - Date.parse(right.kickoffDateTime)
    )
    .slice(0, limit);
}

export function recentTeamFixtures(
  team: TeamEntity,
  fixtures: readonly QualifiedFixture[],
  limit = 6
): QualifiedFixture[] {
  const now = Date.now();
  return fixturesForTeam(team, fixtures)
    .filter((fixture) => Date.parse(fixture.kickoffDateTime) < now)
    .sort(
      (left, right) =>
        Date.parse(right.kickoffDateTime) - Date.parse(left.kickoffDateTime)
    )
    .slice(0, limit);
}

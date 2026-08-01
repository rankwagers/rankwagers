import { listCompetitions } from "@/lib/competitions/registry";
import type { SeasonEntity } from "./types";
import {
  resolveSeason,
  seasonDateBounds,
  seasonEntityId,
  yearLabelToSlug,
} from "./resolver";

function buildSeasons(): SeasonEntity[] {
  const seasons: SeasonEntity[] = [];
  const seen = new Set<string>();

  for (const competition of listCompetitions()) {
    const slug = yearLabelToSlug(competition.season);
    const id = seasonEntityId(competition.slug, slug);
    if (seen.has(id)) continue;
    seen.add(id);
    const bounds = seasonDateBounds(competition.season);
    seasons.push({
      id,
      slug,
      competitionSlug: competition.slug,
      displayName: `${competition.name} ${competition.season}`,
      startDate: bounds.startDate,
      endDate: bounds.endDate,
      active: true,
      countryCode: competition.country ?? undefined,
      yearLabel: competition.season,
    });
  }

  return seasons;
}

const SEASONS: SeasonEntity[] = buildSeasons();

export function listSeasons(): SeasonEntity[] {
  return SEASONS.filter((season) => season.active);
}

export function listAllSeasons(): SeasonEntity[] {
  return [...SEASONS];
}

export function getSeason(
  competitionSlug: string,
  seasonSlug: string
): SeasonEntity | undefined {
  const slug = yearLabelToSlug(seasonSlug);
  return SEASONS.find(
    (season) =>
      season.active &&
      season.competitionSlug === competitionSlug &&
      season.slug === slug
  );
}

export function getSeasonById(id: string): SeasonEntity | undefined {
  return SEASONS.find((season) => season.id === id && season.active);
}

export function seasonsForCompetition(competitionSlug: string): SeasonEntity[] {
  return listSeasons().filter((season) => season.competitionSlug === competitionSlug);
}

export function getActiveSeason(competitionSlug: string): SeasonEntity | undefined {
  const result = resolveSeason(listSeasons(), {
    competitionSlug,
    activeOnly: true,
  });
  return result.status === "matched" ? result.season : undefined;
}

export function seasonSlugs(): Array<{ competition: string; season: string }> {
  return listSeasons().map((season) => ({
    competition: season.competitionSlug,
    season: season.slug,
  }));
}

export function resolveRegisteredSeason(input: {
  providerSeasonId?: string | number | null;
  competitionSlug?: string | null;
  seasonSlug?: string | null;
  yearLabel?: string | null;
  activeOnly?: boolean;
}) {
  return resolveSeason(listAllSeasons(), input);
}

export function ensureUniqueSeasonIds(): string[] {
  const seen = new Set<string>();
  const dupes: string[] = [];
  for (const season of SEASONS) {
    if (seen.has(season.id)) dupes.push(season.id);
    seen.add(season.id);
  }
  return dupes;
}

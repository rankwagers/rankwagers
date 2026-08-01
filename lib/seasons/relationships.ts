import { getCompetition } from "@/lib/competitions/registry";
import { getMarket } from "@/lib/markets/registry";
import { getOperator } from "@/lib/operators/registry";
import { teamsForCompetition } from "@/lib/teams/registry";
import { getSeason } from "./registry";
import type { SeasonEntity } from "./types";

export type SeasonRelationshipBundle = {
  competition: { slug: string; name: string } | null;
  teams: Array<{ slug: string; name: string }>;
  markets: Array<{ slug: string; name: string }>;
  operators: Array<{ slug: string; name: string }>;
  countryCode: string | null;
};

export function relationshipsForSeason(
  competitionSlug: string,
  seasonSlug: string
): SeasonRelationshipBundle | null {
  const season = getSeason(competitionSlug, seasonSlug);
  if (!season) return null;
  return relationshipsForSeasonEntity(season);
}

export function relationshipsForSeasonEntity(season: SeasonEntity): SeasonRelationshipBundle {
  const competition = getCompetition(season.competitionSlug);
  const teams = teamsForCompetition(season.competitionSlug).slice(0, 12);
  const markets = (competition?.relatedMarketSlugs ?? []).map((slug) => getMarket(slug));
  const operators = (competition?.relatedOperatorSlugs ?? []).map((slug) => getOperator(slug));

  return {
    competition: competition
      ? { slug: competition.slug, name: competition.name }
      : null,
    teams: teams.map((team) => ({ slug: team.slug, name: team.name })),
    markets: markets
      .filter((market): market is NonNullable<typeof market> => Boolean(market))
      .map((market) => ({ slug: market.slug, name: market.name })),
    operators: operators
      .filter((operator): operator is NonNullable<typeof operator> => Boolean(operator))
      .map((operator) => ({ slug: operator.slug, name: operator.name })),
    countryCode: season.countryCode ?? null,
  };
}

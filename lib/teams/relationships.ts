import { getCompetition } from "@/lib/competitions/registry";
import { getMarket } from "@/lib/markets/registry";
import { getOperator } from "@/lib/operators/registry";
import { getRelatedTeams, getTeam } from "./registry";
import type { TeamEntity } from "./types";

export type TeamRelationshipBundle = {
  competitions: Array<{ slug: string; name: string }>;
  markets: Array<{ slug: string; name: string }>;
  operators: Array<{ slug: string; name: string }>;
  relatedTeams: TeamEntity[];
  countryCode: string | null;
};

/** Factual relationship projection used by pages and graph seeding. */
export function relationshipsForTeam(slug: string): TeamRelationshipBundle | null {
  const team = getTeam(slug);
  if (!team) return null;

  return {
    competitions: team.competitionSlugs
      .map((competitionSlug) => getCompetition(competitionSlug))
      .filter((competition): competition is NonNullable<typeof competition> => Boolean(competition))
      .map((competition) => ({ slug: competition.slug, name: competition.name })),
    markets: team.relatedMarketSlugs
      .map((marketSlug) => getMarket(marketSlug))
      .filter((market): market is NonNullable<typeof market> => Boolean(market))
      .map((market) => ({ slug: market.slug, name: market.name })),
    operators: team.relatedOperatorSlugs
      .map((operatorSlug) => getOperator(operatorSlug))
      .filter((operator): operator is NonNullable<typeof operator> => Boolean(operator))
      .map((operator) => ({ slug: operator.slug, name: operator.name })),
    relatedTeams: getRelatedTeams(slug, 6),
    countryCode: team.countryCode ?? null,
  };
}

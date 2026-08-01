import { getCompetition } from "@/lib/competitions/registry";
import { operatorsForCompetition } from "@/lib/competitions/operators";
import type { CompetitionOperatorRow } from "@/lib/competitions/operators";
import type { SeasonEntity } from "./types";

export type SeasonOperatorRow = CompetitionOperatorRow;

export function operatorsForSeason(
  season: SeasonEntity,
  visitorCountry: string | null | undefined
): SeasonOperatorRow[] {
  const competition = getCompetition(season.competitionSlug);
  if (!competition) return [];
  return operatorsForCompetition(competition, visitorCountry).filter(
    (row) => row.availability.available
  );
}

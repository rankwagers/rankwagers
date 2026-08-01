import { getCompetition } from "@/lib/competitions/registry";
import type { Locale } from "@/lib/i18n";
import { pageMetadata } from "@/lib/seo";
import type { SeasonEntity } from "./types";

export function seasonPageTitle(season: SeasonEntity): string {
  const competition = getCompetition(season.competitionSlug);
  const name = competition?.name ?? season.competitionSlug;
  return `${name} ${season.yearLabel} Statistics & Research | RankWagers`;
}

export function seasonPageDescription(season: SeasonEntity): string {
  const competition = getCompetition(season.competitionSlug);
  const name = competition?.name ?? season.competitionSlug;
  return `Explore the ${name} ${season.yearLabel} season through evidence-backed fixtures, markets, participating teams and operator availability.`;
}

export function seasonMetadata(locale: Locale, season: SeasonEntity) {
  return pageMetadata({
    locale,
    path: `/competitions/${season.competitionSlug}/seasons/${season.slug}`,
    title: seasonPageTitle(season),
    description: seasonPageDescription(season),
  });
}

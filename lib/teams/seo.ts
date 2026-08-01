import type { Locale } from "@/lib/i18n";
import { pageMetadata } from "@/lib/seo";
import type { TeamEntity } from "./types";

export function teamPageTitle(team: TeamEntity): string {
  return `${team.name} Statistics, Fixtures & Market Evidence | RankWagers`;
}

export function teamPageDescription(team: TeamEntity): string {
  return `Explore ${team.name} fixtures, goal trends, home-away evidence, market statistics and available operators using factual football data.`;
}

export function teamMetadata(locale: Locale, team: TeamEntity) {
  return pageMetadata({
    locale,
    path: `/teams/${team.slug}`,
    title: teamPageTitle(team),
    description: teamPageDescription(team),
  });
}

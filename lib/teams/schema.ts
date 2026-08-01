import { SITE_NAME } from "@/lib/brand";
import type { Locale } from "@/lib/i18n";
import { siteUrl } from "@/lib/seo";
import { teamPath, teamsIndexPath } from "./links";
import type { TeamEntity } from "./types";

export function teamSportsTeamLd(team: TeamEntity): Record<string, unknown> {
  return {
    "@type": "SportsTeam",
    name: team.name,
    ...(team.shortName ? { alternateName: team.shortName } : {}),
    sport: "Soccer",
    ...(team.countryCode ? { addressCountry: team.countryCode } : {}),
    ...(team.logoUrl ? { logo: team.logoUrl } : {}),
  };
}

export function teamWebPageLd(input: {
  team: TeamEntity;
  locale: Locale;
}): Record<string, unknown> {
  const url = `${siteUrl()}${teamPath(input.locale, input.team.slug)}`;
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: `${input.team.name} team intelligence`,
    description: `Factual research surface for ${input.team.name}: fixtures, markets, and operator availability.`,
    url,
    isPartOf: {
      "@type": "WebSite",
      name: SITE_NAME,
      url: siteUrl(),
    },
    about: teamSportsTeamLd(input.team),
  };
}

export function teamBreadcrumbLd(input: {
  team: TeamEntity;
  locale: Locale;
}): Record<string, unknown> {
  const base = siteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: `${base}/${input.locale}`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Teams",
        item: `${base}${teamsIndexPath(input.locale)}`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: input.team.name,
        item: `${base}${teamPath(input.locale, input.team.slug)}`,
      },
    ],
  };
}

export function teamsIndexLd(input: {
  locale: Locale;
  teams: readonly TeamEntity[];
}): Record<string, unknown> {
  const base = siteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Football teams",
    itemListElement: input.teams.map((team, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: team.name,
      url: `${base}${teamPath(input.locale, team.slug)}`,
    })),
  };
}

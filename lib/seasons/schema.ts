import { SITE_NAME } from "@/lib/brand";
import { getCompetition } from "@/lib/competitions/registry";
import { competitionSportsOrganizationLd } from "@/lib/competitions/schema";
import type { Locale } from "@/lib/i18n";
import { siteUrl } from "@/lib/seo";
import { seasonPath, seasonsIndexPath } from "./links";
import type { SeasonEntity } from "./types";

export function seasonCollectionPageLd(input: {
  season: SeasonEntity;
  locale: Locale;
}): Record<string, unknown> {
  const competition = getCompetition(input.season.competitionSlug);
  const url = `${siteUrl()}${seasonPath(
    input.locale,
    input.season.competitionSlug,
    input.season.slug
  )}`;
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${input.season.displayName} research`,
    description: `Evidence-first research surface for ${input.season.displayName}.`,
    url,
    isPartOf: {
      "@type": "WebSite",
      name: SITE_NAME,
      url: siteUrl(),
    },
    ...(competition
      ? { about: competitionSportsOrganizationLd(competition) }
      : {}),
  };
}

export function seasonBreadcrumbLd(input: {
  season: SeasonEntity;
  locale: Locale;
}): Record<string, unknown> {
  const base = siteUrl();
  const competition = getCompetition(input.season.competitionSlug);
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
        name: "Competitions",
        item: `${base}/${input.locale}/competitions`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: competition?.name ?? input.season.competitionSlug,
        item: `${base}/${input.locale}/competitions/${input.season.competitionSlug}`,
      },
      {
        "@type": "ListItem",
        position: 4,
        name: input.season.yearLabel,
        item: `${base}${seasonPath(
          input.locale,
          input.season.competitionSlug,
          input.season.slug
        )}`,
      },
    ],
  };
}

export function seasonsIndexLd(input: {
  locale: Locale;
  seasons: readonly SeasonEntity[];
}): Record<string, unknown> {
  const base = siteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Football seasons",
    url: `${base}${seasonsIndexPath(input.locale)}`,
    itemListElement: input.seasons.map((season, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: season.displayName,
      url: `${base}${seasonPath(input.locale, season.competitionSlug, season.slug)}`,
    })),
  };
}

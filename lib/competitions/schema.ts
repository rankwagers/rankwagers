import { SITE_NAME } from "@/lib/brand";
import type { Locale } from "@/lib/i18n";
import { siteUrl } from "@/lib/seo";
import { competitionPath, competitionsIndexPath } from "./links";
import type { CompetitionDefinition } from "./types";

export function competitionSportsOrganizationLd(
  competition: CompetitionDefinition
): Record<string, unknown> {
  return {
    "@type": "SportsOrganization",
    name: competition.name,
    ...(competition.country ? { areaServed: competition.country } : {}),
    sport: "Soccer",
  };
}

export function competitionCollectionPageLd(input: {
  competition: CompetitionDefinition;
  locale: Locale;
}): Record<string, unknown> {
  const url = `${siteUrl()}${competitionPath(input.locale, input.competition.slug)}`;
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${input.competition.name} competition intelligence`,
    description: input.competition.description,
    url,
    isPartOf: {
      "@type": "WebSite",
      name: SITE_NAME,
      url: siteUrl(),
    },
    about: competitionSportsOrganizationLd(input.competition),
  };
}

export function competitionBreadcrumbLd(input: {
  competition: CompetitionDefinition;
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
        name: "Competitions",
        item: `${base}${competitionsIndexPath(input.locale)}`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: input.competition.name,
        item: `${base}${competitionPath(input.locale, input.competition.slug)}`,
      },
    ],
  };
}

export function competitionsIndexLd(input: {
  locale: Locale;
  competitions: readonly CompetitionDefinition[];
}): Record<string, unknown> {
  const base = siteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Football competitions",
    itemListElement: input.competitions.map((competition, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: competition.name,
      url: `${base}${competitionPath(input.locale, competition.slug)}`,
    })),
  };
}

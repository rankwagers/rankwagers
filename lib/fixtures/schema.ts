import type { Locale } from "@/lib/i18n";
import { siteUrl } from "@/lib/seo";
import { fixturePath } from "./paths";
import type { MatchPageHeader } from "./types";

export function matchBreadcrumbLd(input: {
  locale: Locale;
  header: MatchPageHeader;
}): Record<string, unknown> {
  const base = siteUrl();
  const items: Array<Record<string, unknown>> = [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: `${base}/${input.locale}`,
    },
  ];
  if (input.header.competitionSlug) {
    items.push({
      "@type": "ListItem",
      position: 2,
      name: input.header.competition,
      item: `${base}/${input.locale}/competitions/${input.header.competitionSlug}`,
    });
  } else {
    items.push({
      "@type": "ListItem",
      position: 2,
      name: "Fixtures",
      item: `${base}/${input.locale}#fixtures`,
    });
  }
  items.push({
    "@type": "ListItem",
    position: items.length + 1,
    name: `${input.header.homeTeam} vs ${input.header.awayTeam}`,
    item: `${base}${fixturePath(input.locale, input.header.matchId)}`,
  });
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items,
  };
}

/** SportsEvent only when kickoff + teams are known (valid minimum). */
export function matchSportsEventLd(input: {
  locale: Locale;
  header: MatchPageHeader;
  description: string;
}): Record<string, unknown> | null {
  if (!input.header.kickoffAt || !input.header.homeTeam || !input.header.awayTeam) {
    return null;
  }
  const url = `${siteUrl()}${fixturePath(input.locale, input.header.matchId)}`;
  const eventStatus =
    input.header.lifecycle === "cancelled"
      ? "https://schema.org/EventCancelled"
      : input.header.lifecycle === "postponed"
        ? "https://schema.org/EventPostponed"
        : input.header.lifecycle === "finished"
          ? "https://schema.org/EventScheduled"
          : "https://schema.org/EventScheduled";

  return {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: `${input.header.homeTeam} vs ${input.header.awayTeam}`,
    description: input.description,
    startDate: input.header.kickoffAt,
    eventStatus,
    url,
    homeTeam: {
      "@type": "SportsTeam",
      name: input.header.homeTeam,
    },
    awayTeam: {
      "@type": "SportsTeam",
      name: input.header.awayTeam,
    },
    ...(input.header.competition
      ? {
          location: {
            "@type": "Place",
            name: input.header.venue || input.header.competition,
          },
        }
      : {}),
  };
}

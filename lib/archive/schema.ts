import { siteUrl } from "@/lib/seo";
import { archiveDayPath, archiveIndexPath, methodologyPath } from "./links";

export function archiveHubWebPageLd(input: {
  locale: string;
  title: string;
  description: string;
}) {
  const url = `${siteUrl()}${archiveIndexPath(input.locale)}`;
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: input.title,
    description: input.description,
    url,
    isPartOf: { "@type": "WebSite", name: "RankWagers", url: siteUrl() },
  };
}

export function archiveHubBreadcrumbLd(locale: string) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: `${siteUrl()}/${locale}`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Prediction archive",
        item: `${siteUrl()}${archiveIndexPath(locale)}`,
      },
    ],
  };
}

export function archiveDayBreadcrumbLd(locale: string, date: string) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: `${siteUrl()}/${locale}`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Prediction archive",
        item: `${siteUrl()}${archiveIndexPath(locale)}`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: date,
        item: `${siteUrl()}${archiveDayPath(locale, date)}`,
      },
    ],
  };
}

export function archiveDayWebPageLd(input: {
  locale: string;
  date: string;
  title: string;
  description: string;
  /** Optional SportsEvent stubs for archived matches (max ~12). */
  events?: Array<{
    name: string;
    startDate: string | null;
    url: string;
  }>;
}) {
  const events = (input.events ?? []).slice(0, 12).map((event) => ({
    "@type": "SportsEvent",
    name: event.name,
    startDate: event.startDate ?? undefined,
    url: `${siteUrl()}${event.url.startsWith("/") ? event.url : `/${event.url}`}`,
    sport: "Soccer",
  }));
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: input.title,
    description: input.description,
    url: `${siteUrl()}${archiveDayPath(input.locale, input.date)}`,
    datePublished: input.date,
    ...(events.length
      ? {
          mainEntity: {
            "@type": "ItemList",
            numberOfItems: events.length,
            itemListElement: events.map((event, index) => ({
              "@type": "ListItem",
              position: index + 1,
              item: event,
            })),
          },
        }
      : {}),
  };
}

export function methodologyWebPageLd(input: {
  locale: string;
  title: string;
  description: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: input.title,
    description: input.description,
    url: `${siteUrl()}${methodologyPath(input.locale)}`,
  };
}

export function methodologyBreadcrumbLd(locale: string) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: `${siteUrl()}/${locale}`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Methodology",
        item: `${siteUrl()}${methodologyPath(locale)}`,
      },
    ],
  };
}

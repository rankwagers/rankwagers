import { publicAccaCanonicalUrl, publicAccaIndexPath } from "./paths";
import type { PublicAccaView } from "./publicView";
import { siteUrl } from "@/lib/seo";

/**
 * Structured data for public Acca pages (Sprint 20B-B stage B5; extended in Sprint 24).
 *
 * DELIBERATE CHOICE OF TYPE.
 * These are modelled as `Article` inside a `CollectionPage`, NOT as `Product`, `Offer`,
 * `Review` or any rating type. An Acca is a record of evidence, not a thing for sale and not a
 * rated recommendation — and `Offer`/`aggregateRating` markup would ask Google to present it as
 * one. Marking research up as commerce would be the schema-level version of the hype this
 * product exists to avoid, and it would also be inaccurate: nothing here is purchasable and
 * nothing is rated.
 *
 * NO `ItemList` FOR THE LEGS. A list of selections is already described, more precisely, by
 * `about`: each entry is a real `SportsEvent` with a name, a start date and a competition. Adding
 * an `ItemList` beside it would describe the same eight things twice in a weaker vocabulary, and
 * `ItemList` carries an ordering claim ("position 1") that this page does not make — the legs are
 * in publication order, not in any order of merit.
 *
 * NO FABRICATED SIGNALS. No `aggregateRating`, no `reviewCount`, no `priceValidUntil`, no author
 * persona. Every emitted value comes from the public projection, which itself carries only what
 * the immutable stored record held.
 *
 * INPUT IS THE PUBLIC VIEW, NOT THE RECORD. Structured data is published to third parties, so it
 * is built from the same redacted projection the page renders. A field that must not appear on
 * the page cannot appear in the markup either, because this module is never handed one.
 */

function absolute(path: string): string {
  return `${siteUrl()}${path}`;
}

/**
 * Author/publisher attribution.
 *
 * The organisation, never an invented individual. Admin access is a single shared secret, so
 * naming a person would be a fabrication — the same reason the admin UI says "an administrator".
 */
function publisher(): Record<string, unknown> {
  return {
    "@type": "Organization",
    name: "RankWagers",
    url: siteUrl(),
  };
}

export function accaDetailLd(view: PublicAccaView): Record<string, unknown> {
  const url = publicAccaCanonicalUrl(view.locale, view.publicId);
  const published = view.publishedAt.machine ?? view.generatedAt.machine;
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: view.title,
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    inLanguage: view.locale,
    isAccessibleForFree: true,
    publisher: publisher(),
    author: publisher(),
    // The publication timestamp is real, recorded by the guarded lifecycle transition.
    ...(published ? { datePublished: published, dateModified: published } : {}),
    // `about` describes what the article covers: the fixtures it examines. No claim is made
    // about outcomes.
    about: view.legs.map((leg) => ({
      "@type": "SportsEvent",
      name: `${leg.homeTeam} v ${leg.awayTeam}`,
      ...(leg.kickoffAt.machine ? { startDate: leg.kickoffAt.machine } : {}),
      sport: "Association Football",
      ...(leg.competition ? { superEvent: { "@type": "SportsEvent", name: leg.competition } } : {}),
    })),
  };
  if (view.summary) data.description = view.summary;
  return data;
}

export function accaIndexLd(input: {
  locale: string;
  views: PublicAccaView[];
}): Record<string, unknown> {
  const url = absolute(publicAccaIndexPath(input.locale));
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    url,
    inLanguage: input.locale,
    name: "Published Accas",
    isPartOf: { "@type": "WebSite", url: siteUrl(), name: "RankWagers" },
    publisher: publisher(),
    // Only what is actually on the page. No total-inventory inflation.
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: input.views.length,
      itemListElement: input.views.map((view, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: publicAccaCanonicalUrl(view.locale, view.publicId),
        name: view.title,
      })),
    },
  };
}

export function accaBreadcrumbLd(input: {
  locale: string;
  view?: PublicAccaView;
}): Record<string, unknown> {
  const items: Array<Record<string, unknown>> = [
    { "@type": "ListItem", position: 1, name: "Home", item: absolute(`/${input.locale}`) },
    {
      "@type": "ListItem",
      position: 2,
      name: "Accas",
      item: absolute(publicAccaIndexPath(input.locale)),
    },
  ];
  if (input.view) {
    items.push({
      "@type": "ListItem",
      position: 3,
      name: input.view.title,
      item: publicAccaCanonicalUrl(input.view.locale, input.view.publicId),
    });
  }
  return { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items };
}

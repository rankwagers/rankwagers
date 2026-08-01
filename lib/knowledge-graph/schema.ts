import type { Locale } from "@/lib/i18n";
import type { GraphEntityType } from "./entity";
import { graphRelatedLinkList } from "./seo";

/** ItemList of related entities for crawl / internal linking surfaces. */
export function graphRelatedItemListLd(input: {
  type: GraphEntityType;
  slug: string;
  locale: Locale;
  siteUrl: string;
}): Record<string, unknown> | null {
  const links = graphRelatedLinkList(input.type, input.slug, input.locale);
  if (!links.length) return null;

  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Related entities for ${input.type}:${input.slug}`,
    itemListElement: links.map((link, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: link.name,
      url: link.url.startsWith("http")
        ? link.url
        : `${input.siteUrl.replace(/\/$/, "")}${link.url}`,
    })),
  };
}

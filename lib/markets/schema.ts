import { SITE_NAME } from "@/lib/brand";
import type { Locale } from "@/lib/i18n";
import { siteUrl } from "@/lib/seo";
import { marketPath, marketsIndexPath } from "./links";
import type { MarketDefinition } from "./types";

export function marketWebPageLd(input: {
  market: MarketDefinition;
  locale: Locale;
}): Record<string, unknown> {
  const url = `${siteUrl()}${marketPath(input.locale, input.market.slug)}`;
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: input.market.seo.titleTemplate,
    description: input.market.seo.description,
    url,
    isPartOf: {
      "@type": "WebSite",
      name: SITE_NAME,
      url: siteUrl(),
    },
    about: {
      "@type": "Thing",
      name: input.market.name,
      description: input.market.shortDescription,
    },
  };
}

export function marketBreadcrumbLd(input: {
  market: MarketDefinition;
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
        name: "Markets",
        item: `${base}${marketsIndexPath(input.locale)}`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: input.market.name,
        item: `${base}${marketPath(input.locale, input.market.slug)}`,
      },
    ],
  };
}

export function marketFaqLd(market: MarketDefinition): Record<string, unknown> | null {
  if (!market.seo.faqs.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: market.seo.faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}

export function marketsIndexLd(input: {
  locale: Locale;
  markets: readonly MarketDefinition[];
}): Record<string, unknown> {
  const base = siteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Football betting markets",
    itemListElement: input.markets.map((market, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: market.name,
      url: `${base}${marketPath(input.locale, market.slug)}`,
    })),
  };
}

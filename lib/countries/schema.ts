import type { Locale } from "@/lib/i18n";
import { siteUrl } from "@/lib/seo";
import { countryPath, countriesIndexPath } from "./links";
import type { CountryLandingModel } from "./landing";

export function countryLandingWebPageLd(input: {
  locale: Locale;
  model: CountryLandingModel;
}): Record<string, unknown> {
  const url = `${siteUrl()}${input.model.path}`;
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: input.model.title,
    description: input.model.summary,
    url,
    isPartOf: {
      "@type": "WebSite",
      name: "RankWagers",
      url: siteUrl(),
    },
  };
}

export function countryLandingBreadcrumbLd(input: {
  locale: Locale;
  model: CountryLandingModel;
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
        name: "Countries",
        item: `${base}${countriesIndexPath(input.locale)}`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: input.model.code,
        item: `${base}${countryPath(input.locale, input.model.code)}`,
      },
    ],
  };
}

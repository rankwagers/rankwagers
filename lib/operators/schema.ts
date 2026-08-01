import { SITE_NAME } from "@/lib/brand";
import type { Locale } from "@/lib/i18n";
import { siteUrl } from "@/lib/seo";
import type { Operator } from "./types";
import { operatorPath, operatorsIndexPath } from "./links";

export function operatorOrganizationLd(operator: Operator): Record<string, unknown> {
  return {
    "@type": "Organization",
    name: operator.name,
    ...(operator.logo
      ? { logo: `${siteUrl()}${operator.logo.startsWith("/") ? operator.logo : `/${operator.logo}`}` }
      : {}),
    ...(operator.website ? { url: operator.website } : {}),
    ...(operator.foundedYear ? { foundingDate: String(operator.foundedYear) } : {}),
  };
}

export function operatorWebPageLd(input: {
  operator: Operator;
  locale: Locale;
  description: string;
}): Record<string, unknown> {
  const url = `${siteUrl()}${operatorPath(input.locale, input.operator.slug)}`;
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: `${input.operator.name} operator intelligence`,
    description: input.description,
    url,
    isPartOf: {
      "@type": "WebSite",
      name: SITE_NAME,
      url: siteUrl(),
    },
    about: operatorOrganizationLd(input.operator),
  };
}

export function operatorBreadcrumbLd(input: {
  operator: Operator;
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
        name: "Operators",
        item: `${base}${operatorsIndexPath(input.locale)}`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: input.operator.name,
        item: `${base}${operatorPath(input.locale, input.operator.slug)}`,
      },
    ],
  };
}

export function operatorsIndexLd(input: {
  locale: Locale;
  operators: readonly Operator[];
}): Record<string, unknown> {
  const base = siteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Operators",
    itemListElement: input.operators.map((operator, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: `${base}${operatorPath(input.locale, operator.slug)}`,
      name: operator.name,
    })),
  };
}

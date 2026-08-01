import { SITE_NAME } from "@/lib/brand";
import type { Locale } from "@/lib/i18n";
import { siteUrl } from "@/lib/seo";

export function comboWebPageLd(input: {
  locale: Locale;
  title: string;
  description: string;
}): Record<string, unknown> {
  const url = `${siteUrl()}/${input.locale}/combo`;
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: input.title,
    description: input.description,
    url,
    isPartOf: {
      "@type": "WebSite",
      name: SITE_NAME,
      url: siteUrl(),
    },
  };
}

export function comboBreadcrumbLd(locale: Locale): Record<string, unknown> {
  const base = siteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: `${base}/${locale}`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Evidence Combo Studio",
        item: `${base}/${locale}/combo`,
      },
    ],
  };
}

export function comboFaqLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Does Evidence Combo Studio guarantee winning bets?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "No. Combinations are built from qualified research evidence and provider-backed odds. Outcomes are uncertain and odds may change.",
        },
      },
      {
        "@type": "Question",
        name: "Which markets are supported?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Over 1.5 Goals, Over 2.5 Goals, First Half Over 0.5, and Second Half Over 0.5 — markets with qualification lists and odds mapping.",
        },
      },
      {
        "@type": "Question",
        name: "What does unknown operator availability mean?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "RankWagers could not verify that every selection is available as a single bet slip at that operator. You can still open the operator and search markets manually.",
        },
      },
    ],
  };
}

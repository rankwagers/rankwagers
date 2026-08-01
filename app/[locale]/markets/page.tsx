import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { locales, type Locale } from "@/lib/i18n";
import { marketPath } from "@/lib/markets/links";
import { listMarkets } from "@/lib/markets/registry";
import { marketsIndexLd } from "@/lib/markets/schema";
import { pageMetadata } from "@/lib/seo";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export function generateMetadata({
  params,
}: {
  params: { locale: Locale };
}): Metadata {
  return pageMetadata({
    locale: params.locale,
    path: "/markets",
    title: "Betting markets — definitions, qualification and coverage",
    description:
      "Explore RankWagers market intelligence pages: explanations, qualified fixtures, operators, and observed odds without tips.",
  });
}

export default function MarketsIndexPage({
  params,
}: {
  params: { locale: Locale };
}) {
  const markets = listMarkets();
  return (
    <>
      <JsonLd data={marketsIndexLd({ locale: params.locale, markets })} />
      <div className="container-wide pb-16 pt-5">
        <section className="border-b border-[var(--border-subtle)] pb-8">
          <p className="text-metadata font-medium uppercase tracking-label text-brand">
            Market intelligence
          </p>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-display text-foreground md:text-4xl">
            Markets
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--ink-secondary)] md:text-base">
            Educational market references that connect fixtures, evidence, operators, and odds.
            No tips — only research structure.
          </p>
        </section>

        <ul className="mt-8 divide-y divide-[var(--border-subtle)] border-y border-[var(--border-subtle)]">
          {markets.map((market) => (
            <li key={market.slug}>
              <Link
                href={marketPath(params.locale, market.slug)}
                className="block py-4 transition-colors hover:bg-[var(--canvas-secondary)]"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold text-foreground">{market.name}</p>
                  <span className="text-metadata uppercase tracking-label text-muted-foreground">
                    {market.category}
                    {market.listKind ? " · tracked" : " · educational"}
                  </span>
                </div>
                <p className="mt-1 max-w-3xl text-sm text-[var(--ink-secondary)]">
                  {market.shortDescription}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

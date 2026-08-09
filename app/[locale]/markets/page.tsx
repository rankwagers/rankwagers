import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { locales, type Locale } from "@/lib/i18n";
import { marketPath } from "@/lib/markets/links";
import { listMarkets } from "@/lib/markets/registry";
import { marketsIndexLd } from "@/lib/markets/schema";
import { pageMetadata } from "@/lib/seo";
import { getDictionary } from "@/lib/dictionaries";

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
  const p = getDictionary(params.locale).predictions;
  return (
    <>
      <JsonLd data={marketsIndexLd({ locale: params.locale, markets })} />
      <div className="rw-hero container-wide bg-[var(--hero-canvas)] pb-24 pt-5">
        <header className="border-b border-[var(--hero-line)] pb-10">
          <span aria-hidden className="block h-[2px] w-10 bg-[var(--hero-ink)]" />
          <p className="rw-m mt-3.5 text-[var(--hero-ink-2)]">{p.mktIndexEyebrow}</p>
          <h1 className="rw-h mt-1.5 text-[clamp(2.125rem,4.4vw,2.875rem)] text-[var(--hero-ink)]">
            Markets
          </h1>
          <p className="mt-2.5 max-w-[62ch] text-[15px] leading-[1.55] text-[var(--hero-ink-2)]">
            {p.mktIndexLede}
          </p>
        </header>

        <ul className="mt-10 border-t-[1.5px] border-[var(--hero-ink)]">
          {markets.map((market) => (
            <li key={market.slug}>
              <Link
                href={marketPath(params.locale, market.slug)}
                className="rw-row block border-b border-[var(--hero-line)] py-3.5 pl-3.5"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                  <p className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--hero-ink)]">
                    {market.name}
                  </p>
                  <span className="rw-m text-[var(--hero-ink-2)]">{market.category}</span>
                </div>
                <p className="mt-1 max-w-[62ch] text-[13px] leading-relaxed text-[var(--hero-ink-2)]">
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

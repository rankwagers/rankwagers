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
      <header style={{ padding: "14px 20px", borderBottom: "1px solid var(--line)" }}>
        <p className="rw3-label" style={{ margin: 0 }}>
          {p.mktIndexEyebrow}
        </p>
        <h1 className="rw3-title" style={{ margin: "2px 0 0" }}>
          Markets
        </h1>
        <p className="rw3-meta" style={{ margin: "2px 0 0", maxWidth: "62ch" }}>
          {p.mktIndexLede}
        </p>
      </header>

      <ul style={{ margin: 0, padding: 0 }}>
        {markets.map((market) => (
          <li key={market.slug} style={{ listStyle: "none" }}>
            <Link
              href={marketPath(params.locale, market.slug)}
              className="rw3-hoverable"
              style={{
                display: "block",
                padding: "10px 20px",
                borderBottom: "1px solid var(--line)",
              }}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                <p className="text-[14px] font-semibold" style={{ margin: 0 }}>
                  {market.name}
                </p>
                <span className="rw3-label">{market.category}</span>
              </div>
              <p className="rw3-meta" style={{ margin: "2px 0 0", maxWidth: "62ch" }}>
                {market.shortDescription}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

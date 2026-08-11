import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MarketDetailView } from "@/components/markets/MarketDetailView";
import { emptyLists, getDailyMatchListsSafe, todayMatchDateStr } from "@/lib/footystats/client";
import { locales, type Locale } from "@/lib/i18n";
import { buildMarketHistoricalStats, fixturesForMarket } from "@/lib/markets/stats";
import { getMarketOddsSummary } from "@/lib/markets/odds";
import { operatorsForMarket } from "@/lib/markets/operators";
import { getMarket, marketSlugs } from "@/lib/markets/registry";
import { getRequestCountryContext } from "@/lib/personalization/server";
import { mapDailyListsToQualifiedFixtures } from "@/lib/research/qualifiedFixture";
import { pageMetadata } from "@/lib/seo";
import { getDictionary } from "@/lib/dictionaries";
import {
  buildPricePanelData,
  type PricePanelRow,
} from "@/lib/operators/pricePanel.server";

export function generateStaticParams() {
  return locales.flatMap((locale) =>
    marketSlugs().map((slug) => ({ locale, slug }))
  );
}

export function generateMetadata({
  params,
}: {
  params: { locale: Locale; slug: string };
}): Metadata {
  const market = getMarket(params.slug);
  if (!market) return {};
  return pageMetadata({
    locale: params.locale,
    path: `/markets/${market.slug}`,
    title: `${market.seo.titleTemplate} — RankWagers`,
    description: market.seo.description,
  });
}

export default async function MarketDetailPage({
  params,
  searchParams,
}: {
  params: { locale: Locale; slug: string };
  searchParams?: { country?: string; date?: string };
}) {
  const market = getMarket(params.slug);
  if (!market) notFound();

  const countryContext = getRequestCountryContext(searchParams?.country);
  const today = todayMatchDateStr();
  const rawDate = searchParams?.date?.trim();
  const selectedDate =
    rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : today;
  const result = await getDailyMatchListsSafe(selectedDate);
  const lists = "error" in result ? emptyLists() : result;
  const fixtures = mapDailyListsToQualifiedFixtures(lists);
  const stats = buildMarketHistoricalStats(market, fixtures);
  const upcoming = fixturesForMarket(market, fixtures, 8);
  const odds = await getMarketOddsSummary(market);
  const operators = operatorsForMarket(market, countryContext.country);

  /* Phase C — the page's market, priced per listed fixture from the frozen
     history. Slugs outside the observed market set simply produce no chips. */
  const HISTORY_KEY_BY_MARKET_SLUG: Record<string, string> = {
    "over-1-5": "over15",
    "over-2-5": "over25",
    "first-half-goals": "fh",
    "second-half-goals": "sh",
  };
  const historyKey = HISTORY_KEY_BY_MARKET_SLUG[market.slug];
  const pricesByFixture: Record<number, PricePanelRow[]> = {};
  if (historyKey) {
    for (const fixture of upcoming) {
      const panel = await buildPricePanelData({
        fixtureId: fixture.matchId,
        kickoffIso: fixture.kickoffDateTime,
        locale: params.locale,
        country: countryContext.country,
      });
      const rows = panel[historyKey];
      if (rows?.length) pricesByFixture[fixture.matchId] = rows;
    }
  }

  return (
    <MarketDetailView
      market={market}
      locale={params.locale}
      stats={stats}
      fixtures={upcoming}
      odds={odds}
      operators={operators}
      visitorCountry={countryContext.country}
        p={getDictionary(params.locale).predictions}
      pricesByFixture={pricesByFixture}
    />
  );
}

import type { Metadata } from "next";
import { getDictionary } from "@/lib/dictionaries";
import { type Locale } from "@/lib/i18n";
import { pageMetadata } from "@/lib/seo";
import type { MatchListKind } from "@/lib/footystats/types";
import { getRequestCountryContext } from "@/lib/personalization/server";
import { PredictionsPageJsonLd } from "@/components/predictions/PredictionsPageJsonLd";
import { HomepagePublishedAccas } from "@/components/homepage/HomepagePublishedAccas";
import { HomeV3, type HomeV3Strings } from "@/components/v3/home/HomeV3";
import {
  buildLiveStrip,
  buildTableRows,
  countDistinctMatches,
  loadListsForDay,
  parseDayParam,
  type DayKey,
} from "@/lib/v3/homeTable.server";
import {
  buildHighPotentialToday,
  buildOfferOfTheDay,
  resolveFallbackOperator,
  buildPopularLeagues,
  buildRailSites,
} from "@/lib/v3/homeRails.server";
import { buildEditorBandPicks } from "@/lib/v3/editorPicks.server";
import { buildVerifiedRecordCard } from "@/lib/v3/verifiedRecord.server";
import { readEditorPicksDocument } from "@/lib/editor-picks/store";
import { formatDict } from "@/lib/formatDict";

export function generateMetadata({
  params,
}: {
  params: { locale: Locale };
}): Metadata {
  const dict = getDictionary(params.locale);
  const p = dict.predictions;
  return pageMetadata({
    locale: params.locale,
    path: "/",
    title: p.metaTitle,
    description: p.metaDescription,
  });
}

const VISIBLE_ROWS = 16;

function parseMarket(raw: string | undefined): MatchListKind | null {
  return raw === "fh" || raw === "over15" || raw === "over25" || raw === "sh" ? raw : null;
}

/* THE V3 HOMEPAGE (Bible V3, block C). One clock: the selected tab's lists
   are the page's only fixture source. The editor band and live strip always
   speak about TODAY — the band is today's editorial, the strip today's
   play — whichever tab the table shows. */
export default async function LocaleHomePage({
  params,
  searchParams,
}: {
  params: { locale: Locale };
  searchParams?: {
    day?: string;
    market?: string;
    sort?: string;
    all?: string;
    country?: string;
  };
}) {
  const locale = params.locale;
  const dict = getDictionary(locale);
  const p = dict.predictions as unknown as Record<string, string>;
  const countryContext = getRequestCountryContext(searchParams?.country);

  const day = parseDayParam(searchParams?.day);
  const market = parseMarket(searchParams?.market);
  const sort: "rate" | "time" = searchParams?.sort === "time" ? "time" : "rate";
  const showAll = searchParams?.all === "1";

  const [todayData, tomorrowData, weekendData] = await Promise.all([
    loadListsForDay("today"),
    loadListsForDay("tomorrow"),
    loadListsForDay("weekend"),
  ]);
  const byDay: Record<DayKey, typeof todayData> = {
    today: todayData,
    tomorrow: tomorrowData,
    weekend: weekendData,
  };
  const selected = byDay[day];
  const counts: Record<DayKey, number> = {
    today: countDistinctMatches(todayData.lists),
    tomorrow: countDistinctMatches(tomorrowData.lists),
    weekend: countDistinctMatches(weekendData.lists),
  };

  /* The admin pin (block F) selects the offer of the day AND the no-price
     fallback operator (polish group 4); the ranked default otherwise. */
  const { pinnedOperatorSlug } = await readEditorPicksDocument();
  const fallbackOperator = resolveFallbackOperator(countryContext, pinnedOperatorSlug);

  const [{ rows, totalRows }, picks, highPotential, verified] = await Promise.all([
    buildTableRows({
      lists: selected.lists,
      locale,
      country: countryContext.country ?? null,
      marketFilter: market,
      sort,
      limit: showAll ? Number.MAX_SAFE_INTEGER : VISIBLE_ROWS,
      fallbackOperator,
    }),
    buildEditorBandPicks({
      lists: todayData.lists,
      locale,
      country: countryContext.country ?? null,
      p: dict.predictions,
      fallbackOperator,
    }),
    buildHighPotentialToday(todayData.lists),
    /* GROUP 7 — the verified card IS the archive summary: same query, same
       window, same numbers /archive prints; probe-pinned equal. */
    buildVerifiedRecordCard(locale),
  ]);

  const { leagues, totalMatches } = buildPopularLeagues(selected.lists);
  const sites = buildRailSites(countryContext, locale);
  const offer = buildOfferOfTheDay(countryContext, locale, pinnedOperatorSlug);
  const live = buildLiveStrip(todayData.lists);

  /* When today is empty, tomorrow's real count and first kickoff make the
     one-line microcopy — real data or the generic line, never invented. */
  let emptyTomorrowLine: string | null = null;
  if (totalRows === 0 && day === "today" && counts.tomorrow > 0) {
    const tomorrowRows = [
      ...tomorrowData.lists.fh,
      ...tomorrowData.lists.over15,
      ...tomorrowData.lists.over25,
      ...tomorrowData.lists.sh,
    ];
    const firstKickoff = Math.min(...tomorrowRows.map((r) => r.kickoffTime));
    const time = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "UTC",
    }).format(new Date(firstKickoff * 1000));
    emptyTomorrowLine = formatDict(p.v3EmptyMatchesTomorrow, {
      n: String(counts.tomorrow),
      time,
    });
  }

  const marketLabels: Record<MatchListKind, string> = {
    fh: p.tabFh,
    over15: p.tabOver15,
    over25: p.tabOver25,
    sh: p.tabSh,
  };

  const strings: HomeV3Strings = {
    leftRail: {
      popularLeagues: p.v3PopularLeagues,
      allMatches: p.v3AllMatches,
      bettingSites: p.v3NavBettingSites,
      sponsored: p.v3Sponsored18,
      best: p.v3Best,
      continue: p.v3Continue,
      commission: p.v3CommissionLine,
    },
    rightRail: {
      verifiedHitRate: p.v3VerifiedHitRate,
      lockLine: p.v3LockLine,
      seeRecord: p.v3SeeRecord,
      highPotential: p.v3HighPotentialToday,
      nPredictions: p.v3NPredictions,
      offerOfTheDay: p.v3OfferOfTheDay,
      sponsored: p.v3Sponsored18,
      continue: p.v3Continue,
      terms: dict.footer.disclaimer,
      smallSample: p.v3SmallSample,
      nSettled: p.arcSettledLine,
    },
    band: {
      editorPick: p.v3EditorPick,
      more: p.v3More,
      sponsored: p.v3Sponsored18,
      strongestSignals: p.v3StrongestSignals,
    },
    tabs: {
      today: p.v3Today,
      tomorrow: p.v3Tomorrow,
      weekend: p.v3Weekend,
      allMarkets: p.v3AllMarkets,
      sortByRate: p.v3SortByRate,
      colTime: p.v3ColTime,
      marketLabels,
    },
    table: {
      colTime: p.v3ColTime,
      colMatch: p.v3ColMatch,
      colLeague: p.v3ColLeague,
      colMarket: p.v3ColMarket,
      colRate: p.v3ColRate,
      colSample: p.v3ColSample,
      colForm: p.v3ColForm,
      colBestOdds: p.v3ColBestOdds,
      nMoreMatches: p.v3NMoreMatches,
      sponsoredLinks: p.v3SponsoredLinks,
      sponsored: p.v3Sponsored18,
      smallSample: p.v3SmallSample,
    },
    live: p.v3Live,
    seeRecord: p.v3SeeRecord,
    verifiedShort: p.v3VerifiedHitRate,
    emptyTitle: p.v3EmptyMatchesTitle,
    emptyLine: p.v3EmptyMatchesLine,
    emptyTomorrowLine,
  };

  const moreParams = new URLSearchParams();
  if (day !== "today") moreParams.set("day", day);
  if (market) moreParams.set("market", market);
  if (sort !== "rate") moreParams.set("sort", sort);
  moreParams.set("all", "1");

  return (
    <>
      <PredictionsPageJsonLd
        locale={locale}
        title={dict.predictions.metaTitle}
        description={dict.predictions.metaDescription}
      />
      {selected.error ? (
        <div
          role="alert"
          style={{
            margin: "12px 20px 0",
            padding: "10px 12px",
            border: "1px solid var(--line)",
            borderRadius: 6,
            fontSize: 12,
            color: "var(--muted)",
          }}
        >
          {dict.predictions.apiError}
        </div>
      ) : null}
      <HomeV3
        locale={locale}
        strings={strings}
        live={live}
        picks={picks}
        day={day}
        counts={counts}
        market={market}
        sort={sort}
        rows={rows}
        totalRows={totalRows}
        moreHref={showAll ? null : `/${locale}?${moreParams.toString()}`}
        leagues={leagues}
        totalMatches={totalMatches}
        sites={sites}
        verified={verified}
        highPotential={highPotential}
        offer={offer}
      />
      <HomepagePublishedAccas locale={locale} />
    </>
  );
}

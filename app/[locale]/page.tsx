import type { Metadata } from "next";
import { getDictionary } from "@/lib/dictionaries";
import { type Locale } from "@/lib/i18n";
import { pageMetadata } from "@/lib/seo";
import { getDailyMatchListsSafe, emptyLists, todayMatchDateStr } from "@/lib/footystats/client";
import { formatKickoff } from "@/lib/dates";
import { PredictionsPageJsonLd } from "@/components/predictions/PredictionsPageJsonLd";
import { RankWagersHome } from "@/components/bible/RankWagersHome";
import { getRequestCountryContext } from "@/lib/personalization/server";
import { buildHomepageTrustModel } from "@/lib/homepage/trustPerformance";
import { HomepagePublishedAccas } from "@/components/homepage/HomepagePublishedAccas";

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

export default async function LocaleHomePage({
  params,
  searchParams,
}: {
  params: { locale: Locale };
  searchParams?: {
    date?: string;
    country?: string;
    fixture?: string;
    market?: string;
  };
}) {
  const dict = getDictionary(params.locale);
  const countryContext = getRequestCountryContext(searchParams?.country);
  const today = todayMatchDateStr();
  const rawDate = searchParams?.date?.trim();
  const selectedDate =
    rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : today;
  const result = await getDailyMatchListsSafe(selectedDate);
  const lists = "error" in result ? emptyLists() : result;
  const apiError = "error" in result ? result.error : null;
  const allRows = [...lists.fh, ...lists.over15, ...lists.over25, ...lists.sh];
  const matchCount = new Set(allRows.map((row) => row.matchId)).size;
  const fetchedAt = new Date(lists.fetchedAt);
  const updateTime = Number.isNaN(fetchedAt.getTime())
    ? "Update time pending"
    : new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "UTC",
      }).format(fetchedAt);
  const displayDate = formatKickoff(`${selectedDate}T12:00:00.000Z`, {
    locale: "en-GB",
    timeZone: "UTC",
  }).replace(/ · \d{2}:\d{2}$/, "");
  // Fixture count and freshness only. The model-version string and the detected country code were
  // engineering facts occupying reader-facing space; neither is something a reader can act on or
  // check, and the version was a claim the page could not evidence.
  const modelMeta = `${displayDate} · ${matchCount} qualified fixtures · Updated ${updateTime} UTC`;
  const trust = await buildHomepageTrustModel({
    locale: params.locale,
    today,
    selectedDate,
    lists,
    countryContext,
  });

  return (
    <>
      <PredictionsPageJsonLd
        locale={params.locale}
        title={dict.predictions.metaTitle}
        description={dict.predictions.metaDescription}
      />
      {apiError && (
        <div className="container-wide pt-5">
          <div
            className="rounded-lg border border-[var(--amber-border)] bg-[var(--amber-surface)] px-4 py-3 text-sm text-[var(--amber-primary)]"
            role="alert"
          >
            <p className="font-semibold">{dict.predictions.apiError}</p>
            <p className="mt-1 text-xs opacity-90">
              Qualified fixtures may be incomplete. Try refreshing in a moment.
            </p>
            {process.env.NODE_ENV === "development" && (
              <span className="mt-1 block font-mono text-metadata opacity-70">{apiError}</span>
            )}
          </div>
        </div>
      )}
      <RankWagersHome
        lists={lists}
        dict={dict}
        locale={params.locale}
        displayDate={displayDate}
        modelMeta={modelMeta}
        countryContext={countryContext}
        selectedDate={selectedDate}
        today={today}
        trust={trust}
      />
      {/*
        Sprint 20B-B stage B5. Placed AFTER the research surfaces, deliberately: the journey is
        research first, combinations second. The component renders nothing when no Acca is
        published, so the homepage is byte-identical to its previous output in that state.
      */}
      <HomepagePublishedAccas locale={params.locale} />
    </>
  );
}

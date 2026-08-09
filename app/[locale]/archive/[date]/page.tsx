import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { ArchiveFilters } from "@/components/archive/ArchiveFilters";
import { ArchivePagination } from "@/components/archive/ArchivePagination";
import { ArchiveTable } from "@/components/archive/ArchiveTable";
import { ArchiveViewTracker } from "@/components/archive/ArchiveViewTracker";
import { TransparencyDashboard } from "@/components/archive/TransparencyDashboard";
import { isArchiveDate, listArchiveDates } from "@/lib/archive/dates";
import {
  archiveDayPath,
  archiveIndexPath,
} from "@/lib/archive/links";
import { queryArchive } from "@/lib/archive/load";
import {
  archiveDayBreadcrumbLd,
  archiveDayWebPageLd,
} from "@/lib/archive/schema";
import { locales, type Locale } from "@/lib/i18n";
import { getDictionary } from "@/lib/dictionaries";
import { formatDict } from "@/lib/dictionaryExtras";
import { pageMetadata } from "@/lib/seo";

/* ============================================================================
   THE ARCHIVE DAY — same hierarchy as the hub, scoped to one research day:
   day lead (the day's settled record) → record signals → the day's rows →
   filters. No commercial block — the archive is the verification surface.
   ========================================================================== */

export async function generateStaticParams() {
  const dates = await listArchiveDates();
  const params: Array<{ locale: string; date: string }> = [];
  for (const locale of locales) {
    for (const date of dates) {
      params.push({ locale, date });
    }
  }
  return params;
}

export async function generateMetadata({
  params,
}: {
  params: { locale: Locale; date: string };
}): Promise<Metadata> {
  if (!locales.includes(params.locale) || !isArchiveDate(params.date)) {
    return {};
  }
  const { metrics, page } = await queryArchive(params.locale, {}, { date: params.date });
  const title = `Archive ${params.date} — RankWagers predictions`;
  const description = `Settled and pending qualified-list predictions for ${params.date}. Wins and losses included. Sample size ${page.total}.`;
  return pageMetadata({
    locale: params.locale,
    path: `/archive/${params.date}`,
    title,
    description,
    index: metrics.settledPredictions >= 1 || page.total >= 3,
  });
}

export default async function ArchiveDayPage({
  params,
  searchParams,
}: {
  params: { locale: Locale; date: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  if (!locales.includes(params.locale) || !isArchiveDate(params.date)) {
    notFound();
  }

  const { metrics, page, competitions } = await queryArchive(
    params.locale,
    searchParams,
    { date: params.date }
  );

  if (!page.total && metrics.availability === "unavailable") {
    // Distinguish missing file vs empty filters
    const bare = await queryArchive(params.locale, {}, { date: params.date });
    if (!bare.page.total) notFound();
  }

  const p = getDictionary(params.locale).predictions;
  const title = `Archive ${params.date}`;
  const description = `Qualified-list prediction archive for ${params.date}.`;
  const filterQuery = {
    market: page.filters.market === "all" ? undefined : page.filters.market,
    status: page.filters.status === "all" ? undefined : page.filters.status,
    competition: page.filters.competition,
    team: page.filters.team,
    q: page.filters.q,
  };

  return (
    <div className="rw-hero container-wide bg-[var(--hero-canvas)] pb-24">
      <ArchiveViewTracker locale={params.locale} kind="day" date={params.date} />
      <JsonLd
        data={archiveDayWebPageLd({
          locale: params.locale,
          date: params.date,
          title,
          description,
          events: page.records.slice(0, 12).map((row) => ({
            name: `${row.homeTeam} vs ${row.awayTeam}`,
            startDate: row.kickoffAt,
            url: row.matchHref,
          })),
        })}
      />
      <JsonLd data={archiveDayBreadcrumbLd(params.locale, params.date)} />

      <nav aria-label="Breadcrumb" className="rw-m pt-5 text-[var(--hero-ink-2)]">
        <Link href={`/${params.locale}`} className="hover:text-[var(--hero-ink)]">
          Home
        </Link>
        <span className="mx-1.5" aria-hidden>
          /
        </span>
        <Link href={archiveIndexPath(params.locale)} className="hover:text-[var(--hero-ink)]">
          {p.arcIndexTitle}
        </Link>
        <span className="mx-1.5" aria-hidden>
          /
        </span>
        <span className="text-[var(--hero-ink)]">{params.date}</span>
      </nav>

      <header className="mt-6 border-b border-[var(--hero-line)] pb-10">
        <span aria-hidden className="block h-[2px] w-10 bg-[var(--hero-ink)]" />
        <p className="rw-m mt-3.5 text-[var(--hero-ink-2)]">{p.arcDayEyebrow}</p>
        <h1 className="rw-h mt-1.5 text-[clamp(2.125rem,4.4vw,2.875rem)] text-[var(--hero-ink)]">
          {title}
        </h1>
        <p className="mt-2.5 max-w-[62ch] text-[15px] leading-[1.55] text-[var(--hero-ink-2)]">
          {p.arcDayLede}
        </p>
      </header>

      {/* LEAD + SUPPORTS — the day's verified record, rates paired by construction. */}
      <div className="mt-14">
        <TransparencyDashboard metrics={metrics} locale={params.locale} p={p} />
      </div>

      {/* ROWS — the day's predictions. */}
      <section
        className="mt-16 border-t border-[var(--hero-line)] pt-12"
        aria-labelledby="day-results-heading"
      >
        <h2 id="day-results-heading" className="rw-m text-[var(--hero-ink-2)]">
          {formatDict(p.arcDayPredictionsTitle, { date: params.date })}
        </h2>
        <div className="mt-5">
          <ArchiveFilters
            locale={params.locale}
            filters={page.filters}
            competitions={competitions}
            p={p}
            actionPath={archiveDayPath(params.locale, params.date)}
          />
        </div>
        <div className="mt-4">
          <ArchiveTable records={page.records} locale={params.locale} p={p} />
        </div>
        <ArchivePagination
          basePath={archiveDayPath(params.locale, params.date)}
          page={page.page}
          pageCount={page.pageCount}
          query={filterQuery}
          p={p}
        />
      </section>
    </div>
  );
}

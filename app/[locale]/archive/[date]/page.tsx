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
    <div style={{ paddingBottom: 48 }}>
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

      <nav aria-label="Breadcrumb" className="rw3-meta" style={{ padding: "12px 20px 0" }}>
        <Link href={`/${params.locale}`} className="hover:text-[var(--text)]">
          {p.nvHome}
        </Link>
        <span className="mx-1.5" aria-hidden>
          /
        </span>
        <Link href={archiveIndexPath(params.locale)} className="hover:text-[var(--text)]">
          {p.arcIndexTitle}
        </Link>
        <span className="mx-1.5" aria-hidden>
          /
        </span>
        <span style={{ color: "var(--text)" }}>{params.date}</span>
      </nav>

      <header style={{ padding: "14px 20px", borderBottom: "1px solid var(--line)" }}>
        <p className="rw3-label">{p.arcDayEyebrow}</p>
        <h1 className="rw3-title" style={{ margin: "2px 0 0" }}>
          {title}
        </h1>
        <p className="rw3-meta" style={{ margin: "2px 0 0", maxWidth: "62ch" }}>
          {p.arcDayLede}
        </p>
      </header>

      {/* LEAD + SUPPORTS — the day's verified record, rates paired by construction. */}
      <div style={{ padding: "20px 20px 0" }}>
        <TransparencyDashboard metrics={metrics} locale={params.locale} p={p} />
      </div>

      {/* ROWS — the day's predictions. */}
      <section
        aria-labelledby="day-results-heading"
        style={{ margin: "32px 0 0", borderTop: "1px solid var(--line)", padding: "20px 20px 0" }}
      >
        <h2 id="day-results-heading" className="rw3-label">
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

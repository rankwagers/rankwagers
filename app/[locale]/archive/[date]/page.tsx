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
  methodologyPath,
} from "@/lib/archive/links";
import { queryArchive } from "@/lib/archive/load";
import {
  archiveDayBreadcrumbLd,
  archiveDayWebPageLd,
} from "@/lib/archive/schema";
import { locales, type Locale } from "@/lib/i18n";
import { pageMetadata } from "@/lib/seo";

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
    <div className="container-wide pb-20">
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

      <nav aria-label="Breadcrumb" className="mb-6 text-xs text-muted-foreground">
        <ol className="flex flex-wrap gap-1">
          <li>
            <Link href={`/${params.locale}`} className="hover:text-brand">
              Home
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link href={archiveIndexPath(params.locale)} className="hover:text-brand">
              Archive
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li className="text-foreground" aria-current="page">
            {params.date}
          </li>
        </ol>
      </nav>

      <header className="max-w-3xl">
        <p className="text-metadata font-medium uppercase tracking-label text-brand">
          Daily archive
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold">{title}</h1>
        <p className="mt-3 text-sm text-[var(--ink-secondary)]">
          Historical snapshot for this research day. Outcomes are not rewritten after
          settlement.{" "}
          <Link
            href={methodologyPath(params.locale)}
            className="font-semibold text-brand hover:underline"
          >
            How settlement works
          </Link>
        </p>
      </header>

      <div className="mt-8">
        <TransparencyDashboard metrics={metrics} locale={params.locale} />
      </div>

      <section className="mt-10 space-y-4" aria-labelledby="day-results-heading">
        <h2 id="day-results-heading" className="font-display text-xl font-semibold">
          Predictions on {params.date}
        </h2>
        <ArchiveFilters
          locale={params.locale}
          filters={page.filters}
          competitions={competitions}
          actionPath={archiveDayPath(params.locale, params.date)}
        />
        <ArchiveTable records={page.records} locale={params.locale} />
        <ArchivePagination
          basePath={archiveDayPath(params.locale, params.date)}
          page={page.page}
          pageCount={page.pageCount}
          query={filterQuery}
        />
      </section>
    </div>
  );
}

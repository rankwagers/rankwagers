import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { ArchiveFilters } from "@/components/archive/ArchiveFilters";
import { ArchivePagination } from "@/components/archive/ArchivePagination";
import { ArchiveTable } from "@/components/archive/ArchiveTable";
import { ArchiveViewTracker } from "@/components/archive/ArchiveViewTracker";
import { TransparencyDashboard } from "@/components/archive/TransparencyDashboard";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  archiveDayPath,
  archiveIndexPath,
  methodologyPath,
} from "@/lib/archive/links";
import { queryArchive } from "@/lib/archive/load";
import {
  archiveHubBreadcrumbLd,
  archiveHubWebPageLd,
} from "@/lib/archive/schema";
import { locales, type Locale } from "@/lib/i18n";
import { pageMetadata } from "@/lib/seo";

const TITLE = "Prediction archive — every published prediction and its settled result";
const DESCRIPTION =
  "Settled prediction history, wins and losses included. Filter by market, competition, team and settlement status.";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: { locale: Locale };
}): Promise<Metadata> {
  const { metrics } = await queryArchive(params.locale, {}, { dateLimit: 60 });
  return pageMetadata({
    locale: params.locale,
    path: "/archive",
    title: TITLE,
    description: DESCRIPTION,
    index: metrics.settledPredictions >= 3,
  });
}

export default async function ArchiveHubPage({
  params,
  searchParams,
}: {
  params: { locale: Locale };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const { metrics, page, dates, competitions } = await queryArchive(
    params.locale,
    searchParams,
    { dateLimit: 60 }
  );

  const filterQuery = {
    market: page.filters.market === "all" ? undefined : page.filters.market,
    status: page.filters.status === "all" ? undefined : page.filters.status,
    competition: page.filters.competition,
    team: page.filters.team,
    q: page.filters.q,
  };

  return (
    <div className="container-wide pb-20">
      <ArchiveViewTracker locale={params.locale} kind="hub" />
      <JsonLd
        data={archiveHubWebPageLd({
          locale: params.locale,
          title: TITLE,
          description: DESCRIPTION,
        })}
      />
      <JsonLd data={archiveHubBreadcrumbLd(params.locale)} />

      <nav aria-label="Breadcrumb" className="mb-6 text-xs text-muted-foreground">
        <ol className="flex flex-wrap gap-1">
          <li>
            <Link href={`/${params.locale}`} className="hover:text-brand">
              Home
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li className="text-foreground" aria-current="page">
            Prediction archive
          </li>
        </ol>
      </nav>

      <header className="max-w-3xl">
        <p className="text-metadata font-medium uppercase tracking-label text-brand">
          Verification
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-foreground">
          Prediction archive
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--ink-secondary)]">
          Historical qualified-list predictions from RankWagers daily archives. Settled
          wins and losses are both shown. Average odds and ROI stay unavailable until
          publication odds are durably stored.{" "}
          <Link
            href={methodologyPath(params.locale)}
            className="font-semibold text-brand hover:underline"
          >
            Methodology
          </Link>
        </p>
      </header>

      <div className="mt-8">
        <TransparencyDashboard metrics={metrics} locale={params.locale} />
      </div>

      <nav
        className="mt-8 flex flex-wrap gap-3 text-sm"
        aria-label="Related research destinations"
      >
        <Link href={`/${params.locale}#fixtures`} className="text-brand hover:underline">
          Fixtures
        </Link>
        <Link href={`/${params.locale}/competitions`} className="text-brand hover:underline">
          Competitions
        </Link>
        <Link href={`/${params.locale}/teams`} className="text-brand hover:underline">
          Teams
        </Link>
        <Link href={`/${params.locale}/markets`} className="text-brand hover:underline">
          Markets
        </Link>
        <Link href={`/${params.locale}/countries`} className="text-brand hover:underline">
          Countries
        </Link>
        <Link href={`/${params.locale}/operators`} className="text-brand hover:underline">
          Bookmakers
        </Link>
        <Link href={methodologyPath(params.locale)} className="text-brand hover:underline">
          Methodology
        </Link>
      </nav>

      <section className="mt-10" aria-labelledby="archive-days-heading">
        <h2 id="archive-days-heading" className="font-display text-xl font-semibold">
          Archive days
        </h2>
        {dates.length ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {dates.slice(0, 24).map((date) => (
              <li key={date}>
                <Link
                  href={archiveDayPath(params.locale, date)}
                  className="inline-flex min-h-9 items-center rounded-md border border-border px-3 text-sm hover:border-brand/35"
                >
                  {date}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-3">
            <EmptyState
              title="No archive days yet"
              description="No daily prediction archives are available yet. Settled fixtures are archived permanently and appear here."
            />
          </div>
        )}
      </section>

      <section className="mt-10 space-y-4" aria-labelledby="archive-results-heading">
        <h2 id="archive-results-heading" className="font-display text-xl font-semibold">
          Browse predictions
        </h2>
        <ArchiveFilters
          locale={params.locale}
          filters={page.filters}
          competitions={competitions}
        />
        <p className="text-xs text-muted-foreground" role="status">
          Showing {page.records.length} of {page.total} matching rows
          {page.pageCount > 1 ? ` · page ${page.page} of ${page.pageCount}` : ""}
        </p>
        <ArchiveTable records={page.records} locale={params.locale} />
        <ArchivePagination
          basePath={archiveIndexPath(params.locale)}
          page={page.page}
          pageCount={page.pageCount}
          query={filterQuery}
        />
      </section>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { ArchiveFilters } from "@/components/archive/ArchiveFilters";
import { ArchivePagination } from "@/components/archive/ArchivePagination";
import { ArchiveTable } from "@/components/archive/ArchiveTable";
import { ArchiveViewTracker } from "@/components/archive/ArchiveViewTracker";
import { TransparencyDashboard } from "@/components/archive/TransparencyDashboard";
import {
  archiveDayPath,
  archiveIndexPath,
} from "@/lib/archive/links";
import { queryArchive } from "@/lib/archive/load";
import {
  archiveHubBreadcrumbLd,
  archiveHubWebPageLd,
} from "@/lib/archive/schema";
import { locales, type Locale } from "@/lib/i18n";
import { getDictionary } from "@/lib/dictionaries";
import { formatDict } from "@/lib/dictionaryExtras";
import { pageMetadata } from "@/lib/seo";

/* ============================================================================
   THE ARCHIVE HUB — form-guide conversion, fixture-style hierarchy
   ----------------------------------------------------------------------------
   LEAD      the verified record itself — of the settled predictions, how many
             won and lost, the percentage computed from that printed fraction.
             Omitted whole when nothing is settled.
   SUPPORTS  the record's shape: totals, splits, per-market and per-competition
             rows, every rate paired with its sample.
   ROWS      the predictions — the ruled table, wins and losses alike.
   DETAIL    day chips and filters for the reader who digs.
   LAST      nothing. The archive is the verification surface; it carries no
             commercial block by design.
   ========================================================================== */

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
  const p = getDictionary(params.locale).predictions;

  const filterQuery = {
    market: page.filters.market === "all" ? undefined : page.filters.market,
    status: page.filters.status === "all" ? undefined : page.filters.status,
    competition: page.filters.competition,
    team: page.filters.team,
    q: page.filters.q,
  };

  return (
    <div className="rw-hero container-wide bg-[var(--hero-canvas)] pb-24">
      <ArchiveViewTracker locale={params.locale} kind="hub" />
      <JsonLd
        data={archiveHubWebPageLd({
          locale: params.locale,
          title: TITLE,
          description: DESCRIPTION,
        })}
      />
      <JsonLd data={archiveHubBreadcrumbLd(params.locale)} />

      <nav aria-label="Breadcrumb" className="rw-m pt-5 text-[var(--hero-ink-2)]">
        <Link href={`/${params.locale}`} className="hover:text-[var(--hero-ink)]">
          {p.nvHome}
        </Link>
        <span className="mx-1.5" aria-hidden>
          /
        </span>
        <span className="text-[var(--hero-ink)]">{p.arcIndexTitle}</span>
      </nav>

      <header className="mt-6 border-b border-[var(--hero-line)] pb-10">
        <span aria-hidden className="block h-[2px] w-10 bg-[var(--hero-ink)]" />
        <p className="rw-m mt-3.5 text-[var(--hero-ink-2)]">{p.arcIndexEyebrow}</p>
        <h1 className="rw-h mt-1.5 text-[clamp(2.125rem,4.4vw,2.875rem)] text-[var(--hero-ink)]">
          {p.arcIndexTitle}
        </h1>
        <p className="mt-2.5 max-w-[62ch] text-[15px] leading-[1.55] text-[var(--hero-ink-2)]">
          {p.arcIndexLede}
        </p>
      </header>

      {/* LEAD + SUPPORTS — the verified record, rates paired by construction. */}
      <div className="mt-14">
        <TransparencyDashboard metrics={metrics} locale={params.locale} p={p} />
      </div>

      {/* ROWS — the predictions themselves. */}
      <section
        className="mt-16 border-t border-[var(--hero-line)] pt-12"
        aria-labelledby="archive-results-heading"
      >
        <h2 id="archive-results-heading" className="rw-m text-[var(--hero-ink-2)]">
          {p.arcBrowseTitle}
        </h2>
        <div className="mt-5">
          <ArchiveFilters
            locale={params.locale}
            filters={page.filters}
            competitions={competitions}
            p={p}
          />
        </div>
        <p className="rw-m mt-4 text-[var(--hero-ink-2)]" role="status">
          {formatDict(p.arcShowingLine, {
            shown: String(page.records.length),
            total: String(page.total),
          })}
          {page.pageCount > 1
            ? ` · ${formatDict(p.arcPageOf, {
                page: String(page.page),
                total: String(page.pageCount),
              })}`
            : ""}
        </p>
        <div className="mt-4">
          <ArchiveTable records={page.records} locale={params.locale} p={p} />
        </div>
        <ArchivePagination
          basePath={archiveIndexPath(params.locale)}
          page={page.page}
          pageCount={page.pageCount}
          query={filterQuery}
          p={p}
        />
      </section>

      {/* DETAIL — the day chips. */}
      <section
        className="mt-16 border-t border-[var(--hero-line)] pt-12"
        aria-labelledby="archive-days-heading"
      >
        <h2 id="archive-days-heading" className="rw-m text-[var(--hero-ink-2)]">
          {p.arcDaysTitle}
        </h2>
        {dates.length ? (
          <ul className="mt-4 flex flex-wrap gap-2">
            {dates.slice(0, 24).map((date) => (
              <li key={date}>
                <Link
                  href={archiveDayPath(params.locale, date)}
                  className="rw-m inline-flex min-h-9 items-center border border-[var(--hero-line)] px-3 text-[var(--hero-ink)] transition-colors hover:border-[var(--hero-ink)]"
                >
                  {date}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 max-w-[52ch] border-l-2 border-[var(--hero-line)] py-1 pl-5 text-[15px] text-[var(--hero-ink-2)]">
            {p.arcDaysEmpty}
          </p>
        )}
      </section>
    </div>
  );
}

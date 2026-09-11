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
   THE ARCHIVE HUB — rw3 conversion, fixture-style hierarchy
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
    <div style={{ paddingBottom: 48 }}>
      <ArchiveViewTracker locale={params.locale} kind="hub" />
      <JsonLd
        data={archiveHubWebPageLd({
          locale: params.locale,
          title: TITLE,
          description: DESCRIPTION,
        })}
      />
      <JsonLd data={archiveHubBreadcrumbLd(params.locale)} />

      <nav aria-label="Breadcrumb" className="rw3-meta" style={{ padding: "12px 20px 0" }}>
        <Link href={`/${params.locale}`} className="hover:text-[var(--text)]">
          {p.nvHome}
        </Link>
        <span className="mx-1.5" aria-hidden>
          /
        </span>
        <span style={{ color: "var(--text)" }}>{p.arcIndexTitle}</span>
      </nav>

      <header style={{ padding: "14px 20px", borderBottom: "1px solid var(--line)" }}>
        <p className="rw3-label">{p.arcIndexEyebrow}</p>
        <h1 className="rw3-title" style={{ margin: "2px 0 0" }}>
          {p.arcIndexTitle}
        </h1>
        <p className="rw3-meta" style={{ margin: "2px 0 0", maxWidth: "62ch" }}>
          {p.arcIndexLede}
        </p>
      </header>

      {/* LEAD + SUPPORTS — the verified record, rates paired by construction. */}
      <div style={{ padding: "20px 20px 0" }}>
        <TransparencyDashboard metrics={metrics} locale={params.locale} p={p} />
      </div>

      {/* ROWS — the predictions themselves. */}
      <section
        aria-labelledby="archive-results-heading"
        style={{ margin: "32px 0 0", borderTop: "1px solid var(--line)", padding: "20px 20px 0" }}
      >
        <h2 id="archive-results-heading" className="rw3-label">
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
        <p className="rw3-meta mt-4" role="status">
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
        aria-labelledby="archive-days-heading"
        style={{ margin: "32px 0 0", borderTop: "1px solid var(--line)", padding: "20px 20px 0" }}
      >
        <h2 id="archive-days-heading" className="rw3-label">
          {p.arcDaysTitle}
        </h2>
        {dates.length ? (
          <ul className="mt-4 flex flex-wrap gap-2">
            {dates.slice(0, 24).map((date) => (
              <li key={date}>
                <Link href={archiveDayPath(params.locale, date)} className="rw3-ghost">
                  {date}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p
            className="mt-4 max-w-[52ch] py-1 pl-5 text-[13px]"
            style={{ borderLeft: "2px solid var(--line)", color: "var(--muted)" }}
          >
            {p.arcDaysEmpty}
          </p>
        )}
      </section>
    </div>
  );
}

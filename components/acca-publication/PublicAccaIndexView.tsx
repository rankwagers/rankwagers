import Link from "next/link";
import { getDictionary } from "@/lib/dictionaries";
import { formatDict } from "@/lib/formatDict";
import type { Locale } from "@/lib/i18n";
import { AccaIndexAnalytics } from "@/components/acca-publication/AccaIndexAnalytics";
import { PublicAccaCard } from "@/components/acca-publication/PublicAccaCard";
import { PublicAccaFilters } from "@/components/acca-publication/PublicAccaFilters";
import { PublicAccaPagination } from "@/components/acca-publication/PublicAccaPagination";
import { ACCA_ODDS_STALE_AFTER_HOURS } from "@/lib/acca-publication/freshness";
import { CAPTURED_ODDS_NOTE, NOT_ADVICE_NOTE } from "@/lib/acca-publication/presentation";
import {
 EMPTY_INDEX_QUERY,
 PUBLIC_ACCA_MAX_SCAN,
 type PublicAccaFacets,
 type PublicAccaIndexPage,
 type PublicAccaIndexQuery,
} from "@/lib/acca-publication/publicIndex";
import type { PublicAccaView } from "@/lib/acca-publication/publicView";

/**
 * Public Acca index (Sprint 20B-B stage B5; extended in Sprint 24).
 *
 * SERVER-RENDERED CONTENT, END TO END. Every card, every filter link and every page link is in
 * the HTML the server returns. The only client code on this page is `AccaIndexAnalytics`, which
 * renders nothing and exists solely to measure. Disable JavaScript and the index still lists,
 * filters, paginates and links — that is a requirement of the surface, not an optimisation.
 *
 * The empty state is deliberate and is the common case at launch: rather than rendering a
 * skeleton page that exists only to hold a URL, it says plainly that nothing is published yet and
 * points at the research surfaces that DO have content. The page is also marked non-indexable in
 * that state by its route, so an empty listing never enters the index.
 *
 * TWO GROUPS, NOT A RANKING. Rows are split into what is still ahead and what has closed, in
 * publication order within each. They are never sorted by odds, confidence or apparent quality:
 * ordering research by how good it looks is the first step to a tipster feed.
 */

const AHEAD = new Set(["ACTIVE", "PARTIALLY_STARTED"]);

export function PublicAccaIndexView({
 locale,
 views,
 page,
 query,
 facets,
 builderEntryEnabled = true,
}: {
 locale: string;
 /** The rows on this page, already projected and already ordered. */
 views: PublicAccaView[];
 /** Paging model. Absent when a caller renders a single unpaginated list. */
 page?: PublicAccaIndexPage;
 query?: PublicAccaIndexQuery;
 facets?: PublicAccaFacets;
 /** Whether the Builder is being offered at all. Follows the existing combo route flag. */
 builderEntryEnabled?: boolean;
}) {
 // Server component: the dictionary read stays out of the client graph.
 const p = getDictionary(locale as Locale).predictions;
 const ahead = views.filter((view) => AHEAD.has(view.freshness.availability));
 const closed = views.filter((view) => !AHEAD.has(view.freshness.availability));
 const filtered = Boolean(query && (query.profile || query.competition || query.state));

 return (
 <div className="container-wide pb-20">
 <AccaIndexAnalytics
 locale={locale}
 page={page?.page ?? 1}
 resultCount={page?.total ?? views.length}
 filtered={filtered}
 />

 <header className="pt-8">
 <h1 className="text-2xl font-semibold">{p.nvAccasPublished}</h1>
 <p className="mt-2 max-w-2xl text-sm text-[var(--ink-secondary)]">
 {p.apxLede} {NOT_ADVICE_NOTE}
 </p>
 <p className="mt-2 max-w-2xl text-sm text-[var(--ink-secondary)]">
 {p.apxLede2}
 </p>
 </header>

 {facets && query ? (
 <PublicAccaFilters locale={locale} facets={facets} query={query} p={p} />
 ) : null}

 {views.length === 0 ? (
 <section className="mt-8 card p-6">
 <h2 className="text-base font-semibold">
 {filtered ? p.apxNothingFilter : p.apxNothingYet}
 </h2>
 <p className="mt-2 max-w-2xl text-sm text-[var(--ink-secondary)]">
 {filtered
 ? p.apxNothingFilterDesc
 : p.apxNothingYetDesc}
 </p>
 <ul className="mt-4 space-y-2 text-sm">
 <li>
 <Link
 href={`/${locale}`}
 className="text-[var(--hero-ink)] underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
 >
 {p.nvToday}
 </Link>{" "}
 {p.apxTodaysListsNote}
 </li>
 {builderEntryEnabled ? (
 <li data-acca-builder-entry="">
 <Link
 href={`/${locale}/acca/builder`}
 className="text-[var(--hero-ink)] underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
 >
 {p.acBuilderTitle}
 </Link>{" "}
 {p.apxBuilderNote}
 </li>
 ) : null}
 <li>
 <Link
 href={`/${locale}/archive`}
 className="text-[var(--hero-ink)] underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
 >
 {p.arcIndexTitle}
 </Link>{" "}
 {p.apxArchiveNote}
 </li>
 </ul>
 </section>
 ) : (
 <>
 {ahead.length > 0 ? (
 <section className="mt-8" aria-labelledby="accas-ahead">
 <h2 id="accas-ahead" className="text-lg font-semibold">
 {p.apxStillAhead}
 </h2>
 <p className="mt-1 text-sm text-[var(--ink-secondary)]">
 {p.apxStillAheadNote}
 </p>
 <div className="mt-4 grid gap-4 sm:grid-cols-2">
 {ahead.map((view, index) => (
 <PublicAccaCard key={view.publicId} view={view} position={index + 1} p={p} />
 ))}
 </div>
 </section>
 ) : null}

 {closed.length > 0 ? (
 <section className="mt-10" aria-labelledby="accas-closed">
 <h2 id="accas-closed" className="text-lg font-semibold">
 {p.apxClosed}
 </h2>
 <p className="mt-1 text-sm text-[var(--ink-secondary)]">
 {p.apxSettledNote}{" "}
 <Link
 href={`/${locale}/archive`}
 className="text-[var(--hero-ink)] underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
 >
 {p.nvArchive} →
 </Link>
 </p>
 <div className="mt-4 grid gap-4 sm:grid-cols-2">
 {closed.map((view, index) => (
 <PublicAccaCard
 key={view.publicId}
 view={view}
 position={ahead.length + index + 1}
 p={p}
 />
 ))}
 </div>
 </section>
 ) : null}

 {page ? (
 <PublicAccaPagination
 locale={locale}
 page={page}
 query={query ?? EMPTY_INDEX_QUERY}
 p={p}
 />
 ) : null}

 {page?.truncated ? (
 <p className="mt-4 max-w-2xl text-xs text-[var(--hero-ink-2)]">
 {formatDict(p.apxOlderNote, { n: String(PUBLIC_ACCA_MAX_SCAN) })}
 </p>
 ) : null}

 <p className="mt-6 max-w-2xl text-xs text-[var(--hero-ink-2)]">
 {CAPTURED_ODDS_NOTE} A page marks its prices as older once more than{""}
 {ACCA_ODDS_STALE_AFTER_HOURS} hours have passed since they were captured.
 </p>
 </>
 )}

 <p className="mt-6 text-sm">
 <Link
 href={`/${locale}/methodology`}
 className="text-[var(--hero-ink)] underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
 >
 {p.apxHowBuilt}
 </Link>
 </p>

 {views.length > 0 && builderEntryEnabled ? (
 <p className="mt-2 text-sm" data-acca-builder-entry="">
 <Link
 href={`/${locale}/acca/builder`}
 className="text-[var(--hero-ink)] underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
 >
 Build your own from the same qualified lists
 </Link>
 </p>
 ) : null}
 </div>
 );
}

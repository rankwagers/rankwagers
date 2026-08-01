import Link from "next/link";
import type { AccaAvailabilityState } from "@/lib/acca-publication/freshness";
import {
 publicAccaIndexHref,
 type PublicAccaFacetOption,
 type PublicAccaFacets,
 type PublicAccaIndexQuery,
} from "@/lib/acca-publication/publicIndex";

/**
 * Index filters for published Accas (Sprint 24).
 *
 * PLAIN LINKS. No form, no client component, no JavaScript. Each option is an `<a>` to a
 * different query string, which the server renders. Filtering therefore works with scripting
 * disabled, is back-button correct, and is shareable — and it needs no hydration.
 *
 * EVERY FILTER IS REAL. The options come from `publicAccaFacets`, which counts values present in
 * the published records themselves. A facet with fewer than two distinct values is not rendered
 * at all: a control offering one choice that changes nothing is decoration.
 *
 * NOT CRAWL SURFACE. Every filtered URL is `noindex, follow` and canonicalises to the bare index,
 * decided in `lib/acca-publication/seo.ts`, so these links let a reader narrow the list without
 * multiplying near-duplicate documents. `nofollow` is deliberately NOT used: the links out of a
 * filtered view lead to detail pages that should stay reachable.
 */

const LINK_CLASS = "rounded-full border px-3 py-1 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400";
const SELECTED_CLASS = "border-[var(--green-primary)] bg-[var(--green-surface)] text-brand";
const UNSELECTED_CLASS = "border-border text-[var(--ink-secondary)] hover:text-foreground";

function FacetRow({
 label,
 options,
 activeValue,
 hrefFor,
}: {
 label: string;
 options: PublicAccaFacetOption[];
 /** Currently selected option value, in the same form the options use. */
 activeValue: string | null;
 hrefFor: (value: string | null) => string;
}) {
 if (options.length === 0) return null;
 return (
 <div className="flex flex-wrap items-center gap-2">
 <span className="text-xs uppercase tracking-label text-muted-foreground">{label}</span>
 <Link
 href={hrefFor(null)}
 aria-current={activeValue === null ? "true" : undefined}
 className={`${LINK_CLASS} ${activeValue === null ? SELECTED_CLASS : UNSELECTED_CLASS}`}
 >
 All
 </Link>
 {options.map((option) => {
 const selected = activeValue === option.value;
 return (
 <Link
 key={option.value}
 href={hrefFor(option.value)}
 aria-current={selected ? "true" : undefined}
 className={`${LINK_CLASS} ${selected ? SELECTED_CLASS : UNSELECTED_CLASS}`}
 >
 {option.label} <span className="tabular-nums text-muted-foreground">({option.count})</span>
 </Link>
 );
 })}
 </div>
 );
}

export function PublicAccaFilters({
 locale,
 facets,
 query,
}: {
 locale: string;
 facets: PublicAccaFacets;
 query: PublicAccaIndexQuery;
}) {
 const anything =
 facets.profiles.length > 0 || facets.competitions.length > 0 || facets.states.length > 0;
 if (!anything) return null;

 // Every filter change resets to page 1: page 4 of an unfiltered list is rarely page 4 of a
 // filtered one, and landing on a clamped page after a click reads as the filter having failed.
 return (
 <nav aria-label="Filter published Accas" className="mt-6 space-y-2">
 <FacetRow
 label="State"
 options={facets.states}
 activeValue={query.state ? query.state.toLowerCase() : null}
 hrefFor={(value) =>
 publicAccaIndexHref(locale, {
 ...query,
 state: value ? (value.toUpperCase() as AccaAvailabilityState) : null,
 page: 1,
 })
 }
 />
 <FacetRow
 label="Profile"
 options={facets.profiles}
 activeValue={query.profile}
 hrefFor={(value) => publicAccaIndexHref(locale, { ...query, profile: value, page: 1 })}
 />
 <FacetRow
 label="Competition"
 options={facets.competitions}
 activeValue={query.competition}
 hrefFor={(value) => publicAccaIndexHref(locale, { ...query, competition: value, page: 1 })}
 />
 </nav>
 );
}

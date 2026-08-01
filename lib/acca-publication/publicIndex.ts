import { ACCA_AVAILABILITY_STATES, type AccaAvailabilityState } from "./freshness";
import { publicAccaIndexPath } from "./paths";
import { competitionsIn, type PublicAccaView } from "./publicView";

/**
 * Public Acca index: filtering, faceting and pagination (Sprint 24).
 *
 * PURE. Given a list of projected views it produces the page a reader sees. No storage, no
 * request object, no clock — the freshness state each view carries was already derived upstream.
 *
 * WHY FILTERING HAPPENS HERE RATHER THAN IN THE STORE
 *
 * Two of the three facets are DERIVED, not stored. `state` comes from comparing kick-off times
 * with the clock, and `competition` lives inside the legs JSON. Neither is a column, so pushing
 * them into `AccaListFilters` would mean either a schema change or a JSON predicate that the
 * memory and PostgreSQL adapters would implement differently — and adapter parity is a property
 * this domain already has and must keep.
 *
 * The cost is a bounded scan: the caller reads at most `PUBLIC_ACCA_MAX_SCAN` published rows for
 * the locale and filters in memory. That is honest for this data — Accas are published one at a
 * time by an operator, so a locale reaching 200 published records is a scale problem worth
 * solving properly rather than one to pre-empt with a speculative index. `truncated` is carried
 * through so the page can say so instead of silently showing a partial list.
 *
 * WHY NO DECORATIVE FACETS
 *
 * Only three filters exist, and every one is backed by a value the record actually carries. There
 * is no "confidence" filter, no "value" filter and no date range, because nothing in the stored
 * snapshot supports ranking or bucketing by them. Facet OPTIONS are computed from the data on
 * hand, so a filter is never offered for a value no published Acca has.
 */

/** Cards per page. Small enough to stay scannable, large enough to avoid pointless paging. */
export const PUBLIC_ACCA_PAGE_SIZE = 12;

/** Hard ceiling on how many published rows one index request examines. */
export const PUBLIC_ACCA_MAX_SCAN = 200;

export type PublicAccaFacet = "profile" | "competition" | "state";

export type PublicAccaIndexQuery = {
  page: number;
  profile: string | null;
  competition: string | null;
  state: AccaAvailabilityState | null;
};

export const EMPTY_INDEX_QUERY: PublicAccaIndexQuery = {
  page: 1,
  profile: null,
  competition: null,
  state: null,
};

/** True when the reader narrowed the list. Filtered views are never offered for indexing. */
export function isFiltered(query: PublicAccaIndexQuery): boolean {
  return query.profile !== null || query.competition !== null || query.state !== null;
}

/* ------------------------------------------------------------------ *
 * Query parsing
 * ------------------------------------------------------------------ */

type RawParams = Record<string, string | string[] | undefined>;

function single(raw: string | string[] | undefined): string | null {
  if (Array.isArray(raw)) return raw.length > 0 ? (raw[0] ?? null) : null;
  return typeof raw === "string" && raw.trim() !== "" ? raw.trim() : null;
}

/**
 * Bounded free-text facet value.
 *
 * Values are compared against the facet options derived from real data, so an unmatched value
 * simply yields an empty result rather than reaching anything. The length and character bounds
 * exist so a hostile query string cannot be reflected into a link or a heading at arbitrary size.
 */
function facetValue(raw: string | null): string | null {
  if (raw === null) return null;
  if (raw.length > 80) return null;
  // Printable, no control characters, no angle brackets.
  for (let i = 0; i < raw.length; i++) {
    const code = raw.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f || (code >= 0x80 && code <= 0x9f)) return null;
  }
  if (/[<>]/.test(raw)) return null;
  return raw;
}

export function parsePublicAccaIndexQuery(params: RawParams | undefined): PublicAccaIndexQuery {
  if (!params) return { ...EMPTY_INDEX_QUERY };
  const rawPage = single(params.page);
  const parsedPage = rawPage === null ? 1 : Number(rawPage);
  const page =
    Number.isInteger(parsedPage) && parsedPage >= 1 && parsedPage <= 1000 ? parsedPage : 1;

  const rawState = single(params.state);
  const state =
    rawState && (ACCA_AVAILABILITY_STATES as readonly string[]).includes(rawState.toUpperCase())
      ? (rawState.toUpperCase() as AccaAvailabilityState)
      : null;

  return {
    page,
    profile: facetValue(single(params.profile)),
    competition: facetValue(single(params.competition)),
    // WITHDRAWN and UNKNOWN are never publicly listable states, so they are not selectable.
    state: state === "WITHDRAWN" || state === "UNKNOWN" ? null : state,
  };
}

/* ------------------------------------------------------------------ *
 * Link building
 * ------------------------------------------------------------------ */

/**
 * Canonical href for a given index view.
 *
 * Parameter order is FIXED (profile, competition, state, page) so the same view always produces
 * byte-identical URLs. Two URLs differing only in parameter order would be two crawlable
 * addresses for one page.
 */
export function publicAccaIndexHref(
  locale: string,
  query: Partial<PublicAccaIndexQuery>,
): string {
  const parts: string[] = [];
  if (query.profile) parts.push(`profile=${encodeURIComponent(query.profile)}`);
  if (query.competition) parts.push(`competition=${encodeURIComponent(query.competition)}`);
  if (query.state) parts.push(`state=${encodeURIComponent(query.state.toLowerCase())}`);
  // Page 1 is never expressed in the URL: `?page=1` and the bare path are the same page.
  if (query.page && query.page > 1) parts.push(`page=${query.page}`);
  const base = publicAccaIndexPath(locale);
  return parts.length ? `${base}?${parts.join("&")}` : base;
}

/* ------------------------------------------------------------------ *
 * Facets
 * ------------------------------------------------------------------ */

export type PublicAccaFacetOption = {
  value: string;
  label: string;
  count: number;
};

export type PublicAccaFacets = {
  profiles: PublicAccaFacetOption[];
  competitions: PublicAccaFacetOption[];
  states: PublicAccaFacetOption[];
};

function tally(values: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
}

function sortOptions(options: PublicAccaFacetOption[]): PublicAccaFacetOption[] {
  return options.sort((a, b) => (b.count - a.count) || a.value.localeCompare(b.value));
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const STATE_LABELS: Record<string, string> = {
  ACTIVE: "Current",
  PARTIALLY_STARTED: "Partly under way",
  EXPIRED: "Closed",
};

/**
 * Facet options derived from the rows actually available.
 *
 * A facet with a single option is dropped: offering one choice that changes nothing is a control
 * that pretends to do something.
 */
export function publicAccaFacets(views: PublicAccaView[]): PublicAccaFacets {
  const profiles = sortOptions(
    [...tally(views.map((v) => v.profile).filter((p): p is string => !!p))].map(
      ([value, count]) => ({ value, label: titleCase(value), count }),
    ),
  );
  const competitions = sortOptions(
    [...tally(views.flatMap((v) => competitionsIn(v)))].map(([value, count]) => ({
      value,
      label: value,
      count,
    })),
  );
  const states = sortOptions(
    [...tally(views.map((v) => v.freshness.availability))]
      .filter(([value]) => value in STATE_LABELS)
      .map(([value, count]) => ({
        value: value.toLowerCase(),
        label: STATE_LABELS[value] ?? value,
        count,
      })),
  );
  return {
    profiles: profiles.length > 1 ? profiles : [],
    competitions: competitions.length > 1 ? competitions : [],
    states: states.length > 1 ? states : [],
  };
}

/* ------------------------------------------------------------------ *
 * Filtering and paging
 * ------------------------------------------------------------------ */

export function applyPublicAccaQuery(
  views: PublicAccaView[],
  query: PublicAccaIndexQuery,
): PublicAccaView[] {
  return views.filter((view) => {
    if (query.profile && view.profile !== query.profile) return false;
    if (query.state && view.freshness.availability !== query.state) return false;
    if (query.competition && !competitionsIn(view).includes(query.competition)) return false;
    return true;
  });
}

export type PublicAccaIndexPage = {
  rows: PublicAccaView[];
  /** The page actually served. Clamped, so an out-of-range request is not an error page. */
  page: number;
  totalPages: number;
  /** Rows matching the query, before paging. */
  total: number;
  pageSize: number;
  hasPrev: boolean;
  hasNext: boolean;
  /** True when the caller's bounded scan hit its ceiling and older rows were not examined. */
  truncated: boolean;
  /** True when the requested page number did not exist and was clamped. */
  clamped: boolean;
  /** Whether THIS view may be offered to a crawler. See `isIndexableIndexView`. */
  indexable: boolean;
};

export function buildPublicAccaIndexPage(input: {
  views: PublicAccaView[];
  query: PublicAccaIndexQuery;
  truncated: boolean;
  pageSize?: number;
}): PublicAccaIndexPage {
  const pageSize = input.pageSize ?? PUBLIC_ACCA_PAGE_SIZE;
  const matched = applyPublicAccaQuery(input.views, input.query);
  const totalPages = Math.max(1, Math.ceil(matched.length / pageSize));
  const page = Math.max(1, Math.min(input.query.page, totalPages));
  const start = (page - 1) * pageSize;
  const built: Omit<PublicAccaIndexPage, "indexable"> = {
    rows: matched.slice(start, start + pageSize),
    page,
    totalPages,
    total: matched.length,
    pageSize,
    hasPrev: page > 1,
    hasNext: page < totalPages,
    truncated: input.truncated,
    clamped: page !== input.query.page,
  };
  return {
    ...built,
    indexable: isIndexableIndexView({ page: built, query: input.query }),
  };
}

/**
 * Whether this exact index view may be offered to a crawler.
 *
 * Three conditions, all necessary:
 *
 *  1. There is content. An empty listing is a thin page whatever the URL says.
 *  2. The reader did not filter. A facet combination is a view of the same inventory, not a new
 *     document; indexing them multiplies near-duplicate URLs without adding a single fact.
 *  3. The page number was real. A clamped `?page=99` renders page 1's content at a different
 *     URL, which is a duplicate by definition.
 */
export function isIndexableIndexView(input: {
  page: Omit<PublicAccaIndexPage, "indexable">;
  query: PublicAccaIndexQuery;
}): boolean {
  if (input.page.total === 0) return false;
  if (isFiltered(input.query)) return false;
  if (input.page.clamped) return false;
  return true;
}

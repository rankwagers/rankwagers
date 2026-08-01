import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { PublicAccaIndexView } from "@/components/acca-publication/PublicAccaIndexView";
import { listPublicAccaViews, publicAccaPagesEnabled } from "@/lib/acca-publication/public";
import {
  buildPublicAccaIndexPage,
  parsePublicAccaIndexQuery,
  publicAccaFacets,
  type PublicAccaIndexPage,
  type PublicAccaIndexQuery,
} from "@/lib/acca-publication/publicIndex";
import type { PublicAccaView } from "@/lib/acca-publication/publicView";
import { accaBreadcrumbLd, accaIndexLd } from "@/lib/acca-publication/schema";
import { accaIndexMetadata } from "@/lib/acca-publication/seo";
import { getFeatureFlags } from "@/lib/config/featureFlags";
import { locales, type Locale } from "@/lib/i18n";

/**
 * Public Acca index (Sprint 20B-B stage B5; extended in Sprint 24).
 *
 * INDEXABILITY IS EARNED, NOT ASSUMED. `index` is gated on there being at least one published
 * Acca for this locale, following the existing `/archive` convention which gates on settled
 * prediction count. An empty listing is served with `noindex, follow` rather than being offered
 * to search engines as a real page. Filtered and out-of-range views are non-indexable for the
 * same reason — see `lib/acca-publication/publicIndex.ts`.
 *
 * `force-dynamic` because published Accas change on operator action, not on a build. Nothing here
 * is cached at the edge, so an archived Acca disappears from the listing immediately.
 *
 * ONE READ PER REQUEST. `generateMetadata` and the component both need the same page, and Next
 * invokes them separately, so the load is memoised for the duration of the request rather than
 * issued twice.
 */

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

type LoadedIndex = {
  page: PublicAccaIndexPage;
  query: PublicAccaIndexQuery;
  views: PublicAccaView[];
};

/**
 * Per-request memo.
 *
 * Keyed on the resolved locale and the raw query, so two different requests in flight cannot read
 * each other's page. `React.cache` is the framework-native tool for this, but it is scoped to a
 * render pass and does not span the `generateMetadata` call, which is exactly the duplication
 * being avoided here.
 */
const inFlight = new Map<string, Promise<LoadedIndex>>();

async function loadIndex(
  locale: Locale,
  searchParams: Record<string, string | string[] | undefined> | undefined,
): Promise<LoadedIndex> {
  const query = parsePublicAccaIndexQuery(searchParams);
  const key = JSON.stringify([locale, query]);
  const existing = inFlight.get(key);
  if (existing) return existing;

  const pending = (async () => {
    const now = new Date().toISOString();
    const scan = await listPublicAccaViews({ locale, now });
    return {
      query,
      views: scan.views,
      page: buildPublicAccaIndexPage({
        views: scan.views,
        query,
        truncated: scan.truncated,
      }),
    };
  })();

  inFlight.set(key, pending);
  try {
    return await pending;
  } finally {
    // Released immediately: this deduplicates the metadata/render pair of one request, and must
    // never become a cache that outlives it — a published Acca would then appear late.
    inFlight.delete(key);
  }
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: { locale: Locale };
  searchParams?: Record<string, string | string[] | undefined>;
}): Promise<Metadata> {
  if (!publicAccaPagesEnabled()) {
    return { title: "Not found", robots: { index: false, follow: false } };
  }
  const { page, query } = await loadIndex(params.locale, searchParams);
  return accaIndexMetadata({
    locale: params.locale,
    page,
    query,
    index: page.indexable,
  });
}

export default async function PublicAccasIndexPage({
  params,
  searchParams,
}: {
  params: { locale: Locale };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  // The public surface is closed as a whole, not per record: a disabled flag must be
  // indistinguishable from a route that does not exist.
  if (!publicAccaPagesEnabled()) notFound();

  const { page, query, views } = await loadIndex(params.locale, searchParams);
  const facets = publicAccaFacets(views);

  return (
    <>
      {/* Structured data only when there is something to describe, and only on the canonical
          unfiltered view — a facet combination is not a separate collection. */}
      {page.rows.length > 0 && page.indexable ? (
        <>
          <JsonLd data={accaIndexLd({ locale: params.locale, views: page.rows })} />
          <JsonLd data={accaBreadcrumbLd({ locale: params.locale })} />
        </>
      ) : null}
      <PublicAccaIndexView
        locale={params.locale}
        views={page.rows}
        page={page}
        query={query}
        facets={facets}
        builderEntryEnabled={getFeatureFlags().comboRouteEnabled}
      />
    </>
  );
}

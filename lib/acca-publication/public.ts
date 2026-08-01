import type { AccaRecord } from "./contracts";
import { isPubliclyVisible } from "./lifecycle";
import { publicAccaCanonicalUrl, publicAccaIndexPath, publicAccaPath } from "./paths";
import { PUBLIC_ACCA_MAX_SCAN } from "./publicIndex";
import { toPublicAccaView, type PublicAccaView } from "./publicView";
import { isValidAccaSlug } from "./slug";
import { getAccaService } from "@/lib/api/accaComposition";
import { getFeatureFlags } from "@/lib/config/featureFlags";

/**
 * Public Acca reads (Sprint 20B-B stage B5; extended in Sprint 24).
 *
 * THE SINGLE PUBLIC VISIBILITY BOUNDARY.
 *
 * B2 deliberately made the store status-agnostic — it returns DRAFT and ARCHIVED records because
 * trusted admin callers need them — and recorded that public filtering belongs to this stage.
 * This module is where that rule is applied, and it is applied EXACTLY ONCE, through
 * `isPubliclyVisible`, so no public surface can forget it. Public pages must never call the
 * service or the store directly; a test enforces that.
 *
 * LOCALE IS PART OF VISIBILITY.
 * An Acca carries the locale it was written for. It is published under THAT locale only. Echoing
 * one English Acca across 31 locale paths would manufacture 31 near-identical pages from one
 * piece of work — precisely the thin-duplicate problem the SEO backlog already flags. A reader on
 * `/tr/accas` sees Turkish Accas or an honest empty state, never English content at a Turkish URL.
 *
 * THE FEATURE FLAG IS PART OF VISIBILITY (Sprint 24).
 * `publicAccaPagesEnabled` is checked HERE rather than in each route, for the same reason the
 * status filter is: one closed door cannot be left open by a surface that forgot it. With the
 * flag off every read returns empty, so the routes 404, the homepage section hides itself and the
 * sitemap shard empties — from one check.
 */

/** Minimum published Accas before the index is worth indexing. */
export const PUBLIC_INDEX_MIN_ENTRIES = 1;

/** Hard ceiling on a public listing page. Public pages are not an admin console. */
export const PUBLIC_LIST_LIMIT = 24;

export type PublicAccaPage = {
  rows: AccaRecord[];
  total: number;
  /**
   * Whether this page carries enough substance to deserve indexing. Mirrors the existing
   * `/archive` convention, which gates `index` on settled-prediction count rather than
   * publishing an empty page and hoping.
   */
  indexable: boolean;
};

const EMPTY: PublicAccaPage = { rows: [], total: 0, indexable: false };

/** Whether the reader-facing Acca surface is open at all. */
export function publicAccaPagesEnabled(): boolean {
  return getFeatureFlags().publicAccaPagesEnabled;
}

/**
 * Published Accas for one locale, newest first.
 *
 * Fails soft: a storage error yields an empty page rather than a 500. A public page that cannot
 * reach storage should degrade to "nothing to show yet", not to an error screen — and an empty
 * page is correctly non-indexable, so a transient outage cannot cause a thin page to be indexed.
 */
export async function listPublishedAccas(input: {
  locale: string;
  limit?: number;
}): Promise<PublicAccaPage> {
  if (!publicAccaPagesEnabled()) return EMPTY;
  const limit = Math.min(Math.max(1, input.limit ?? PUBLIC_LIST_LIMIT), PUBLIC_LIST_LIMIT);
  try {
    const result = await getAccaService().listAccas({
      status: "PUBLISHED",
      locale: input.locale,
      sourceCandidateId: null,
      createdBefore: null,
      createdAfter: null,
      publishedBefore: null,
      publishedAfter: null,
      limit,
      offset: 0,
    });
    if (!result.ok) return EMPTY;

    // Belt and braces: the status filter above already narrows to PUBLISHED, but the visibility
    // rule is re-applied here so this function is correct even if a caller-supplied filter or a
    // future adapter change let something else through.
    const rows = result.page.rows.filter(
      (acca) => isPubliclyVisible(acca.status) && acca.locale === input.locale,
    );
    return {
      rows,
      total: rows.length,
      indexable: rows.length >= PUBLIC_INDEX_MIN_ENTRIES,
    };
  } catch {
    return EMPTY;
  }
}

/**
 * One published Acca by public slug, for a specific locale.
 *
 * Returns null for a draft, an archived record, a slug belonging to another locale, or a
 * malformed slug. The caller renders a 404 in every one of those cases, so a reader cannot
 * distinguish "not published" from "does not exist" — an unpublished Acca leaks nothing, not even
 * its existence.
 */
export async function getPublishedAccaBySlug(input: {
  slug: string;
  locale: string;
}): Promise<AccaRecord | null> {
  if (!publicAccaPagesEnabled()) return null;
  if (!isValidAccaSlug(input.slug)) return null;
  try {
    const result = await getAccaService().getAccaBySlug(input.slug);
    if (!result.ok) return null;
    const acca = result.acca;
    if (!isPubliclyVisible(acca.status)) return null;
    if (acca.locale !== input.locale) return null;
    return acca;
  } catch {
    return null;
  }
}

/**
 * Every published Acca across every locale, for the sitemap.
 *
 * Returns the locale alongside the slug so the sitemap emits exactly one URL per Acca, under its
 * own locale, rather than one per locale per Acca.
 */
export async function listPublishedAccasForSitemap(): Promise<
  Array<{ slug: string; locale: string; publishedAt: string | null }>
> {
  if (!publicAccaPagesEnabled()) return [];
  try {
    const result = await getAccaService().listAccas({
      status: "PUBLISHED",
      locale: null,
      sourceCandidateId: null,
      createdBefore: null,
      createdAfter: null,
      publishedBefore: null,
      publishedAfter: null,
      limit: 100,
      offset: 0,
    });
    if (!result.ok) return [];
    return result.page.rows
      .filter((acca) => isPubliclyVisible(acca.status))
      .map((acca) => ({
        slug: acca.slug,
        locale: acca.locale,
        publishedAt: acca.publishedAt,
      }));
  } catch {
    // A sitemap must never fail a build or an ISR revalidation because storage was briefly
    // unreachable. Omitting Acca URLs for one cycle is recoverable; a failed sitemap is not.
    return [];
  }
}

/* ------------------------------------------------------------------ *
 * Sprint 24 — projected reads
 *
 * The two functions below are what public PAGES consume. They return the redacted public view,
 * never the storage record, so a page component cannot render an internal identifier even by
 * accident. `listPublishedAccas` and `getPublishedAccaBySlug` remain for the homepage section and
 * for the visibility tests, which assert on stored records directly.
 * ------------------------------------------------------------------ */

export type PublicAccaScan = {
  views: PublicAccaView[];
  /** True when the bounded scan hit its ceiling, so older records were not examined. */
  truncated: boolean;
};

const EMPTY_SCAN: PublicAccaScan = { views: [], truncated: false };

/**
 * Every published Acca for a locale, projected, up to the scan ceiling.
 *
 * The ceiling is deliberate and is surfaced rather than hidden — see `publicIndex.ts` for why
 * derived facets make a bounded in-memory scan the honest implementation at this scale.
 */
export async function listPublicAccaViews(input: {
  locale: string;
  now: string | Date;
  scanLimit?: number;
}): Promise<PublicAccaScan> {
  if (!publicAccaPagesEnabled()) return EMPTY_SCAN;
  const limit = Math.min(Math.max(1, input.scanLimit ?? PUBLIC_ACCA_MAX_SCAN), PUBLIC_ACCA_MAX_SCAN);
  try {
    const result = await getAccaService().listAccas({
      status: "PUBLISHED",
      locale: input.locale,
      sourceCandidateId: null,
      createdBefore: null,
      createdAfter: null,
      publishedBefore: null,
      publishedAfter: null,
      limit,
      offset: 0,
    });
    if (!result.ok) return EMPTY_SCAN;
    const rows = result.page.rows.filter(
      (acca) => isPubliclyVisible(acca.status) && acca.locale === input.locale,
    );
    return {
      views: rows.map((acca) => toPublicAccaView(acca, input.now)),
      truncated: result.page.total > rows.length,
    };
  } catch {
    return EMPTY_SCAN;
  }
}

/** One published Acca, projected. Null in every case the record is not publicly readable. */
export async function getPublicAccaView(input: {
  slug: string;
  locale: string;
  now: string | Date;
}): Promise<PublicAccaView | null> {
  const acca = await getPublishedAccaBySlug({ slug: input.slug, locale: input.locale });
  return acca ? toPublicAccaView(acca, input.now) : null;
}

/* ------------------------------------------------------------------ *
 * URLs
 *
 * Re-exported from `paths.ts` so every existing import keeps working while path construction
 * itself stays free of any dependency on storage or composition.
 * ------------------------------------------------------------------ */

export { publicAccaCanonicalUrl, publicAccaIndexPath, publicAccaPath };

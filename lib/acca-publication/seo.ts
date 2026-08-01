import type { Metadata } from "next";
import { publicAccaIndexHref, type PublicAccaIndexPage, type PublicAccaIndexQuery } from "./publicIndex";
import { publicAccaIndexPath } from "./paths";
import { competitionsIn, type PublicAccaView } from "./publicView";
import type { Locale } from "@/lib/i18n";
import { pageMetadata, siteUrl } from "@/lib/seo";

/**
 * SEO for the public Acca surface (Sprint 24).
 *
 * Built ON TOP of the shared `pageMetadata`, never beside it: staging noindex, the canonical host
 * and the branded Open Graph image are decided in one place for the whole site and this must not
 * fork them. What is overridden here is only what genuinely differs for these two page types.
 *
 * 1. LOCALE ALTERNATES ON A DETAIL PAGE ARE WRONG, and were being emitted.
 *
 *    `pageMetadata` advertises every locale for a path, which is right for a template rendered in
 *    31 languages. An Acca is not: it is published under exactly ONE locale, and
 *    `getPublishedAccaBySlug` returns null for any other, so `/tr/accas/{slug}` is a hard 404.
 *    The page was therefore telling crawlers that 30 URLs existed which return 404. The detail
 *    page now declares a canonical and NO alternates, which is the honest description of a
 *    single-language document.
 *
 * 2. FILTERED AND CLAMPED INDEX VIEWS ARE NOT SEPARATE DOCUMENTS.
 *
 *    A facet combination shows a subset of the same inventory. Indexing those URLs multiplies
 *    near-duplicate pages without adding a fact, so every filtered view canonicalises to the bare
 *    index and is served `noindex, follow` — the links out of it stay crawlable.
 *
 * 3. REAL PAGINATION IS INDEXABLE.
 *
 *    `?page=2` of the unfiltered index carries different Accas, so it is a real document with its
 *    own canonical. `?page=1` is never emitted: the bare path already is page one.
 *
 * NO OUTCOME CLAIMS. Titles and descriptions state what a page contains — how many selections,
 * which competitions, when it was published. Nothing describes a result, a return or a chance.
 */

const INDEX_TITLE = "Published Accas — combinations with their evidence";
const INDEX_DESCRIPTION =
  "Multi-selection football combinations published with the evidence they were built on, the model confidence behind each selection, and the odds recorded at publication. Not tips, and not advice.";

/* ------------------------------------------------------------------ *
 * Index
 * ------------------------------------------------------------------ */

export function accaIndexMetadata(input: {
  locale: Locale;
  page: PublicAccaIndexPage;
  query: PublicAccaIndexQuery;
  /** Robots decision. Supplied by the route from `page.indexable`, never assumed here. */
  index: boolean;
}): Metadata {
  const { locale, page, query, index } = input;
  const paginated = !filtered(query) && page.page > 1 && !page.clamped;

  // Page 2+ gets its own title so two indexable URLs never share one.
  const title = paginated ? `${INDEX_TITLE} — page ${page.page}` : INDEX_TITLE;
  const description = paginated
    ? `Page ${page.page} of ${page.totalPages}. ${INDEX_DESCRIPTION}`
    : INDEX_DESCRIPTION;

  const canonicalPath = paginated
    ? `/accas?page=${page.page}`
    : publicAccaIndexPath(locale).replace(`/${locale}`, "");

  const base = pageMetadata({
    locale,
    path: canonicalPath,
    title,
    description,
    index,
  });

  // A paginated view is one document per page number, not one document per language.
  if (paginated || filtered(query) || page.clamped) {
    return {
      ...base,
      alternates: {
        canonical: `${siteUrl()}/${locale}${
          paginated ? `/accas?page=${page.page}` : "/accas"
        }`,
      },
    };
  }
  return base;
}

function filtered(query: PublicAccaIndexQuery): boolean {
  return query.profile !== null || query.competition !== null || query.state !== null;
}

/** Absolute URLs for the previous/next index page, for `<link rel>` hints and nav controls. */
export function accaIndexPaginationHrefs(
  locale: string,
  page: PublicAccaIndexPage,
  query: PublicAccaIndexQuery,
): { prev: string | null; next: string | null } {
  return {
    prev: page.hasPrev ? publicAccaIndexHref(locale, { ...query, page: page.page - 1 }) : null,
    next: page.hasNext ? publicAccaIndexHref(locale, { ...query, page: page.page + 1 }) : null,
  };
}

/* ------------------------------------------------------------------ *
 * Detail
 * ------------------------------------------------------------------ */

/**
 * Description for one published Acca.
 *
 * Derived from the record so no two Accas share a description: the selection count, the distinct
 * competitions and the combined price are all specific to this combination. The operator's own
 * summary wins when one was written, because a human sentence beats a generated one.
 */
export function accaDetailDescription(view: PublicAccaView): string {
  if (view.summary && view.summary.trim() !== "") return view.summary.trim();
  const competitions = competitionsIn(view);
  const where =
    competitions.length === 0
      ? ""
      : competitions.length === 1
        ? ` from ${competitions[0]}`
        : ` across ${competitions.slice(0, 3).join(", ")}`;
  return (
    `A ${view.legCount}-selection football combination${where}, combined odds ` +
    `${view.combinedOdds.display}, published with the evidence recorded for each selection and ` +
    `the prices captured at publication. A record of evidence, not a tip.`
  );
}

export function accaDetailMetadata(view: PublicAccaView): Metadata {
  const locale = view.locale as Locale;
  const url = `${siteUrl()}${view.canonicalPath}`;
  const title = `${view.title} — selections, evidence and captured odds`;
  const description = accaDetailDescription(view);

  const base = pageMetadata({
    locale,
    path: view.canonicalPath.replace(`/${locale}`, ""),
    title,
    description,
    index: true,
  });

  return {
    ...base,
    // One locale, one URL. No `languages` map: every other locale 404s for this slug.
    alternates: { canonical: url },
    openGraph: {
      ...base.openGraph,
      type: "article",
      url,
      ...(view.publishedAt.machine ? { publishedTime: view.publishedAt.machine } : {}),
    },
  };
}

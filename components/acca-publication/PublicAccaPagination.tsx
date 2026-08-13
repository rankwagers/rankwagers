import Link from "next/link";
import { formatDict } from "@/lib/formatDict";
import type { PredictionStrings } from "@/lib/translations/predictionsEn";
import {
  publicAccaIndexHref,
  type PublicAccaIndexPage,
  type PublicAccaIndexQuery,
} from "@/lib/acca-publication/publicIndex";

/**
 * Pagination for the public Acca index (Sprint 24).
 *
 * REAL LINKS, NOT A LOAD-MORE BUTTON. A crawler follows `<a href>`; it does not press buttons and
 * it does not run an intersection observer. Infinite scroll would have made every Acca past the
 * first page discoverable only by executing JavaScript, which is precisely the failure the index
 * is required not to have.
 *
 * Page one is always the bare path. `?page=1` is never emitted anywhere — not in a link, not in a
 * canonical — so one page never has two addresses.
 */
export function PublicAccaPagination({
  locale,
  page,
  query,
  p,
}: {
  p: PredictionStrings;
  locale: string;
  page: PublicAccaIndexPage;
  query: PublicAccaIndexQuery;
}) {
  if (page.totalPages <= 1) return null;

  const linkClass =
    "rounded-lg border border-border px-3 py-2 text-sm hover:bg-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400";

  return (
    <nav aria-label={p.apxPagesAria} className="mt-8 flex items-center gap-3">
      {page.hasPrev ? (
        <Link
          href={publicAccaIndexHref(locale, { ...query, page: page.page - 1 })}
          rel="prev"
          className={linkClass}
        >
          ← {p.arcPrev}
        </Link>
      ) : (
        <span className="rounded-lg border border-border px-3 py-2 text-sm text-[var(--hero-ink-2)]">
          ← {p.arcPrev}
        </span>
      )}

      <p className="text-sm text-[var(--ink-secondary)]" aria-current="page">
        {formatDict(p.arcPageOf, { page: String(page.page), total: String(page.totalPages) })}
      </p>

      {page.hasNext ? (
        <Link
          href={publicAccaIndexHref(locale, { ...query, page: page.page + 1 })}
          rel="next"
          className={linkClass}
        >
          {p.arcNext} →
        </Link>
      ) : (
        <span className="rounded-lg border border-border px-3 py-2 text-sm text-[var(--hero-ink-2)]">
          {p.arcNext} →
        </span>
      )}
    </nav>
  );
}

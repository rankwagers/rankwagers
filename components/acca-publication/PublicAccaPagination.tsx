import Link from "next/link";
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
}: {
  locale: string;
  page: PublicAccaIndexPage;
  query: PublicAccaIndexQuery;
}) {
  if (page.totalPages <= 1) return null;

  const linkClass =
    "rounded-lg border border-border px-3 py-2 text-sm hover:bg-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400";

  return (
    <nav aria-label="Published Acca pages" className="mt-8 flex items-center gap-3">
      {page.hasPrev ? (
        <Link
          href={publicAccaIndexHref(locale, { ...query, page: page.page - 1 })}
          rel="prev"
          className={linkClass}
        >
          ← Previous
        </Link>
      ) : (
        <span className="rounded-lg border border-border px-3 py-2 text-sm text-[var(--hero-ink-2)]">
          ← Previous
        </span>
      )}

      <p className="text-sm text-[var(--ink-secondary)]" aria-current="page">
        Page <span className="tabular-nums">{page.page}</span> of{" "}
        <span className="tabular-nums">{page.totalPages}</span>
      </p>

      {page.hasNext ? (
        <Link
          href={publicAccaIndexHref(locale, { ...query, page: page.page + 1 })}
          rel="next"
          className={linkClass}
        >
          Next →
        </Link>
      ) : (
        <span className="rounded-lg border border-border px-3 py-2 text-sm text-[var(--hero-ink-2)]">
          Next →
        </span>
      )}
    </nav>
  );
}

import Link from "next/link";
import type { PredictionStrings } from "@/lib/translations/predictionsEn";
import { formatDict } from "@/lib/dictionaryExtras";

export function ArchivePagination({
  basePath,
  page,
  pageCount,
  query,
  p,
}: {
  basePath: string;
  page: number;
  pageCount: number;
  query: Record<string, string | undefined>;
  p: PredictionStrings;
}) {
  if (pageCount <= 1) return null;

  const hrefFor = (target: number) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (!v || v === "all") continue;
      qs.set(k, v);
    }
    if (target > 1) qs.set("page", String(target));
    const s = qs.toString();
    return s ? `${basePath}?${s}` : basePath;
  };

  return (
    <nav
      className="mt-5 flex flex-wrap items-baseline justify-between gap-3 text-sm"
      aria-label={p.arcIndexTitle}
    >
      <p className="rw-m text-[var(--hero-ink-2)]">
        {formatDict(p.arcPageOf, { page: String(page), total: String(pageCount) })}
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link
            href={hrefFor(page - 1)}
            className="rw-m inline-flex min-h-10 items-center border border-[var(--hero-line)] px-3.5 text-[var(--hero-ink)] transition-colors hover:border-[var(--hero-ink)]"
            rel="prev"
          >
            {p.arcPrev}
          </Link>
        ) : null}
        {page < pageCount ? (
          <Link
            href={hrefFor(page + 1)}
            className="rw-m inline-flex min-h-10 items-center border border-[var(--hero-line)] px-3.5 text-[var(--hero-ink)] transition-colors hover:border-[var(--hero-ink)]"
            rel="next"
          >
            {p.arcNext}
          </Link>
        ) : null}
      </div>
    </nav>
  );
}

import Link from "next/link";

export function ArchivePagination({
  basePath,
  page,
  pageCount,
  query,
}: {
  basePath: string;
  page: number;
  pageCount: number;
  query: Record<string, string | undefined>;
}) {
  if (pageCount <= 1) return null;

  const hrefFor = (p: number) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (!v || v === "all") continue;
      qs.set(k, v);
    }
    if (p > 1) qs.set("page", String(p));
    const s = qs.toString();
    return s ? `${basePath}?${s}` : basePath;
  };

  return (
    <nav
      className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm"
      aria-label="Archive pagination"
    >
      <p className="text-muted-foreground">
        Page {page} of {pageCount}
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link
            href={hrefFor(page - 1)}
            className="inline-flex min-h-10 items-center rounded-md border border-border px-3 font-medium"
            rel="prev"
          >
            Previous
          </Link>
        ) : null}
        {page < pageCount ? (
          <Link
            href={hrefFor(page + 1)}
            className="inline-flex min-h-10 items-center rounded-md border border-border px-3 font-medium"
            rel="next"
          >
            Next
          </Link>
        ) : null}
      </div>
    </nav>
  );
}

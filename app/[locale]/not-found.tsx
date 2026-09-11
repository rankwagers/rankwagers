import { headers } from "next/headers";
import Link from "next/link";
import { defaultLocale, isLocale } from "@/lib/i18n";
import { getDictionary } from "@/lib/dictionaries";
import { EmptyStateV3, Illustration404 } from "@/components/v3/illustrations";

/* The locale-scoped 404 — Bible V3's fifth empty state: the illustration,
   one line of microcopy, and ghost doors to the real surfaces. Honest and
   quiet; it names the absence and promises nothing. Renders inside the
   locale shell, so the rw3 scope is already on the page. */
export default function LocaleNotFound() {
  const headerLocale = headers().get("x-locale");
  const locale =
    headerLocale && isLocale(headerLocale) ? headerLocale : defaultLocale;
  const home = `/${locale}`;
  const p = getDictionary(locale).predictions;

  return (
    <div role="status" aria-live="polite" style={{ padding: "24px 20px 64px" }}>
      <p className="rw3-label">404</p>
      <EmptyStateV3
        illustration={<Illustration404 />}
        title={p.v3NotFoundTitle}
        line={p.v3NotFoundLine}
        action={
          <span style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <Link href={home} className="rw3-ghost" style={{ fontSize: 12, padding: "4px 11px" }}>
              {p.v3BackToPredictions}
            </Link>
            <Link
              href={`${home}/archive`}
              className="rw3-ghost"
              style={{ fontSize: 12, padding: "4px 11px" }}
            >
              {p.arcIndexTitle}
            </Link>
            <Link
              href={`${home}/search`}
              className="rw3-ghost"
              style={{ fontSize: 12, padding: "4px 11px" }}
            >
              {p.srchTitle}
            </Link>
          </span>
        }
      />
    </div>
  );
}

import Link from "next/link";
import { defaultLocale } from "@/lib/i18n";
import { getDictionary } from "@/lib/dictionaries";
import { EmptyStateV3, Illustration404 } from "@/components/v3/illustrations";

/* The root 404 lives outside the [locale] segment, so it speaks the default
   locale — and carries the rw3 scope itself, since the locale shell is not
   above it. Same fifth empty state as the locale-scoped page. */
export default function NotFound() {
  const home = `/${defaultLocale}`;
  const p = getDictionary(defaultLocale).predictions;
  return (
    <div
      className="rw3 flex min-h-screen flex-col justify-center"
      role="status"
      aria-live="polite"
      style={{ padding: "24px 20px" }}
    >
      <div className="mx-auto w-full max-w-3xl">
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
                href={`${home}/competitions`}
                className="rw3-ghost"
                style={{ fontSize: 12, padding: "4px 11px" }}
              >
                {p.cmpIndexTitle}
              </Link>
              <Link
                href={`${home}/archive`}
                className="rw3-ghost"
                style={{ fontSize: 12, padding: "4px 11px" }}
              >
                {p.arcIndexTitle}
              </Link>
            </span>
          }
        />
      </div>
    </div>
  );
}

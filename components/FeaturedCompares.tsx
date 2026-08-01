import Link from "next/link";
import type { FullDictionary } from "@/lib/dictionaries";
import type { Locale } from "@/lib/i18n";

export const FEATURED_COMPARES = [
  "1xbet-vs-melbet",
  "1xbet-vs-betwinner",
  "1xbet-vs-888starz",
  "melbet-vs-betwinner",
  "megapari-vs-paripulse",
  "bet-and-you-vs-bizbet",
] as const;

export function FeaturedCompares({
  dict,
  locale,
}: {
  dict: FullDictionary;
  locale: Locale;
}) {
  return (
    <section className="mt-14">
      <h2 className="text-xl font-semibold text-foreground">{dict.home.popularCompares}</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURED_COMPARES.map((slug) => {
          const [a, b] = slug.split("-vs-");
          const label = slug
            .replace("-vs-", " vs ")
            .replace(/-/g, " ")
            .replace(/\b\w/g, (c) => c.toUpperCase());
          return (
            <Link
              key={slug}
              href={`/${locale}/compare/${slug}`}
              className="card group px-4 py-3 transition-colors hover:border-brand/30"
            >
              <span className="text-sm font-semibold text-foreground group-hover:text-brand-light">
                {label}
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {a} · {b}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

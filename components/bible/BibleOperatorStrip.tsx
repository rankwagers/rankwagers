import Image from "next/image";
import Link from "next/link";
import type { FullDictionary } from "@/lib/dictionaries";
import type { Locale } from "@/lib/i18n";
import type { CountryContext } from "@/lib/personalization/types";
import { getHomepageOperators } from "@/lib/personalization/homepage";
import type { HomepageFeaturedLeague } from "@/lib/homepage/types";

/** Editorial operator discovery — contextual cards, not banner spam. */
export function BibleOperatorStrip({
  dict,
  locale,
  subidBase,
  countryContext,
  featuredLeagues = [],
}: {
  dict: FullDictionary;
  locale: Locale;
  subidBase: string;
  countryContext: CountryContext;
  featuredLeagues?: HomepageFeaturedLeague[];
}) {
  const p = dict.predictions;
  const operators = getHomepageOperators(countryContext, 3, subidBase);

  return (
    <section
      id="operators"
      aria-labelledby="bible-operators-heading"
      className="border-t border-[var(--border-subtle)] py-8"
    >
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-metadata font-medium uppercase tracking-label text-muted-foreground">
            {p.bibleOperatorsEyebrow}
          </p>
          <h2
            id="bible-operators-heading"
            className="font-display text-xl font-semibold text-foreground sm:text-2xl"
          >
            {p.bibleOperatorsTitle}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Editorial options for {countryContext.country}. Research above is separate from
            commercial offers.
          </p>
        </div>
        <Link
          href={`/${locale}/operators`}
          className="text-sm font-medium text-brand hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          {p.bibleOperatorsCompareLink}
        </Link>
      </div>

      {featuredLeagues.length > 0 && (
        <div className="mb-5">
          <p className="text-metadata font-medium uppercase tracking-label text-muted-foreground">
            Related competitions
          </p>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {featuredLeagues.slice(0, 6).map((league) => (
              <li key={`${league.name}-${league.href ?? "x"}`}>
                {league.href ? (
                  <Link href={league.href} className="text-[var(--ink-secondary)] hover:text-brand">
                    {league.name}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">{league.name}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <ul className="grid gap-3 md:grid-cols-3">
        {operators.map((operator) => (
          <li key={operator.slug}>
            <a
              href={operator.outboundPath}
              className="flex min-h-[5.5rem] items-center gap-3 rounded-lg border border-border bg-[var(--canvas-secondary)] px-4 py-3 transition-colors hover:border-brand/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              aria-label={`${operator.name} — continue to sportsbook`}
              rel="noopener sponsored"
            >
              {operator.logo ? (
                <Image
                  src={operator.logo}
                  alt=""
                  width={40}
                  height={40}
                  className="h-10 w-10 rounded object-contain"
                />
              ) : (
                <span className="flex h-10 w-10 items-center justify-center rounded bg-background text-xs font-semibold">
                  {operator.name.slice(0, 2).toUpperCase()}
                </span>
              )}
              <div className="min-w-0">
                <p className="font-semibold text-foreground">{operator.name}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {operator.highlights[0] ?? "Licensed sportsbook partner"}
                </p>
              </div>
              <span className="ml-auto shrink-0 text-xs font-semibold text-brand">Continue</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

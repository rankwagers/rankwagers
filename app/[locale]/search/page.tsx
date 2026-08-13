import type { Metadata } from "next";
import Link from "next/link";
import { EntityDiscoverySection } from "@/components/discovery/EntityDiscoverySection";
import { PopularResearch } from "@/components/discovery/PopularResearch";
import { RecentlyViewed } from "@/components/discovery/RecentlyViewed";
import { locales, type Locale } from "@/lib/i18n";
import { getDictionary } from "@/lib/dictionaries";
import { formatDict } from "@/lib/dictionaryExtras";
import type { PredictionStrings } from "@/lib/translations/predictionsEn";
import { pageMetadata } from "@/lib/seo";
import { buildPopularResearchItems } from "@/lib/discovery";
import {
  SEARCH_GROUP_ORDER,
  normalizeSearchQuery,
  searchEntities,
  type SearchEntityType,
  type SearchGroupKey,
} from "@/lib/search";
import { searchGroupLabels } from "@/lib/search/labels";
import { SearchFilterTracker } from "@/components/search/SearchFilterTracker";
import { getRequestCountryContext } from "@/lib/personalization/server";

/* ============================================================================
   THE SEARCH PAGE — form-guide conversion, fixture-style hierarchy
   ----------------------------------------------------------------------------
   LEAD      what was asked — the query as the headline, its match count
             stated inline. No query → the honest invitation.
   FILTERS   the type chips, bordered, active state in ink.
   ROWS      grouped entity results as ruled rows.
   DETAIL    discovery below — related entities or popular research.
   LAST      nothing. Search carries no commercial block; operators appear
             only as registry results.
   ========================================================================== */

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export function generateMetadata({
  params,
  searchParams,
}: {
  params: { locale: Locale };
  searchParams?: { q?: string; type?: string };
}): Metadata {
  const q = normalizeSearchQuery(searchParams?.q ?? "");
  const title = q
    ? `Search: ${q} — RankWagers`
    : "Search — RankWagers entity discovery";
  const description = q
    ? `Discover RankWagers research entities matching “${q}”: competitions, seasons, teams, markets, and operators.`
    : "Search RankWagers competitions, seasons, teams, markets, and operators from the validated entity registry.";

  const path = q ? `/search?q=${encodeURIComponent(q)}` : "/search";
  return pageMetadata({
    locale: params.locale,
    path,
    title,
    description,
    index: false,
  });
}

function parseType(raw: string | undefined): SearchEntityType | undefined {
  if (!raw) return undefined;
  return SEARCH_GROUP_ORDER.includes(raw as SearchGroupKey)
    ? (raw as SearchEntityType)
    : undefined;
}

function emptyCopy(
  reason: string | undefined,
  p: PredictionStrings
): { title: string; description: string } {
  switch (reason) {
    case "no_query":
      return { title: p.srchEmptyNoQueryTitle, description: p.srchEmptyNoQueryDesc };
    case "filtered_away":
      return { title: p.srchEmptyFilteredTitle, description: p.srchEmptyFilteredDesc };
    case "unsupported_locale":
      return { title: p.srchEmptyLocaleTitle, description: p.srchEmptyLocaleDesc };
    default:
      return { title: p.srchEmptyNoneTitle, description: p.srchEmptyNoneDesc };
  }
}

export default function SearchPage({
  params,
  searchParams,
}: {
  params: { locale: Locale };
  searchParams?: { q?: string; type?: string; country?: string };
}) {
  const locale = params.locale;
  const rawQuery = searchParams?.q ?? "";
  const typeFilter = parseType(searchParams?.type);
  const countryContext = getRequestCountryContext(searchParams?.country);
  const response = searchEntities(rawQuery, {
    locale,
    country: countryContext.country,
    countrySource: countryContext.source,
    entityTypes: typeFilter ? [typeFilter] : undefined,
    limit: 60,
    limitPerGroup: 20,
  });
  const p = getDictionary(locale).predictions;
  const groupLabels = searchGroupLabels(p);

  const popular = buildPopularResearchItems(locale, 8);
  const seed = response.results[0];
  const seedableTypes = [
    "competition",
    "season",
    "team",
    "market",
    "operator",
  ] as const;
  type SeedableType = (typeof seedableTypes)[number];
  const seedType: SeedableType | null =
    seed && seedableTypes.includes(seed.entityType as SeedableType)
      ? (seed.entityType as SeedableType)
      : null;

  const copy = emptyCopy(response.meta.emptyReason, p);
  const filterHref = (type?: SearchGroupKey) => {
    const qs = new URLSearchParams();
    if (response.query) qs.set("q", response.query);
    if (type) qs.set("type", type);
    const suffix = qs.toString();
    return `/${locale}/search${suffix ? `?${suffix}` : ""}`;
  };

  const chipClass = (active: boolean) =>
    `rw-m inline-flex border px-3 py-1.5 transition-colors ${
      active
        ? "border-[var(--hero-ink)] text-[var(--hero-ink)]"
        : "border-[var(--hero-line)] text-[var(--hero-ink-2)] hover:border-[var(--hero-ink)] hover:text-[var(--hero-ink)]"
    }`;

  return (
    <div className="rw-hero container-wide bg-[var(--hero-canvas)] pb-24">
      <SearchFilterTracker
        locale={locale}
        query={response.query}
        filter={typeFilter ?? null}
        resultsCount={response.meta.count}
      />

      {/* LEAD — the query itself, count inline; without one, the invitation. */}
      <header className="border-b border-[var(--hero-line)] pb-10 pt-10">
        <span aria-hidden className="block h-[2px] w-10 bg-[var(--hero-ink)]" />
        <p className="rw-m mt-3.5 text-[var(--hero-ink-2)]">{p.srchEyebrow}</p>
        <h1 className="rw-h mt-1.5 text-[clamp(2.125rem,4.4vw,2.875rem)] text-[var(--hero-ink)]">
          {response.query
            ? formatDict(p.srchResultsFor, { q: response.query })
            : p.srchTitle}
        </h1>
        <p className="mt-2.5 max-w-[62ch] text-[15px] leading-[1.55] text-[var(--hero-ink-2)]">
          {response.query
            ? formatDict(p.srchCountLine, { n: String(response.meta.count) })
            : p.srchLede}
        </p>
      </header>

      {/* FILTERS — the type chips. */}
      <nav className="mt-8 flex flex-wrap gap-2" aria-label={p.srchEyebrow}>
        <Link href={filterHref()} className={chipClass(!typeFilter)}>
          {p.srchAllFilter}
        </Link>
        {SEARCH_GROUP_ORDER.filter((key) => key !== "fixture").map((key) => (
          <Link key={key} href={filterHref(key)} className={chipClass(typeFilter === key)}>
            {groupLabels[key]}
          </Link>
        ))}
      </nav>

      {/* ROWS — grouped entity results as ruled rows, or the honest empty. */}
      {!response.results.length ? (
        <div className="mt-10">
          <p className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--hero-ink)]">
            {copy.title}
          </p>
          <p className="mt-2 max-w-[52ch] border-l-2 border-[var(--hero-line)] py-1 pl-5 text-[15px] text-[var(--hero-ink-2)]">
            {copy.description}
          </p>
        </div>
      ) : (
        <div className="mt-10 space-y-10">
          {SEARCH_GROUP_ORDER.map((groupKey) => {
            const rows = response.groups[groupKey];
            if (!rows?.length) return null;
            return (
              <section key={groupKey} aria-labelledby={`group-${groupKey}`}>
                <h2 id={`group-${groupKey}`} className="rw-m text-[var(--hero-ink-2)]">
                  {groupLabels[groupKey]}
                </h2>
                <ul className="mt-3 border-t-[1.5px] border-[var(--hero-ink)]">
                  {rows.map((result) => (
                    <li key={`${result.entityType}-${result.slug}`}>
                      <Link
                        href={result.href}
                        className="rw-row flex items-baseline justify-between gap-x-4 border-b border-[var(--hero-line)] py-3 pl-3.5"
                      >
                        <span className="text-[15px] text-[var(--hero-ink)]">
                          {result.title}
                        </span>
                        <span className="rw-m shrink-0 text-[var(--hero-ink-2)]">
                          {result.entityType}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      {/* DETAIL — discovery below the results. */}
      {seedType && seed ? (
        <EntityDiscoverySection
          entityType={seedType}
          entitySlug={seed.slug}
          locale={locale}
          country={countryContext.country}
        />
      ) : (
        <>
          <PopularResearch
            items={popular}
            locale={locale}
            country={countryContext.country}
            sourceEntity="search"
          />
          <RecentlyViewed locale={locale} country={countryContext.country} />
        </>
      )}
    </div>
  );
}

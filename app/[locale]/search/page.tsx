import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { EntityDiscoverySection } from "@/components/discovery/EntityDiscoverySection";
import { PopularResearch } from "@/components/discovery/PopularResearch";
import { RecentlyViewed } from "@/components/discovery/RecentlyViewed";
import { locales, type Locale } from "@/lib/i18n";
import { pageMetadata } from "@/lib/seo";
import { buildPopularResearchItems } from "@/lib/discovery";
import {
  SEARCH_GROUP_LABELS,
  SEARCH_GROUP_ORDER,
  normalizeSearchQuery,
  searchEntities,
  type SearchEntityType,
  type SearchGroupKey,
} from "@/lib/search";
import { SearchFilterTracker } from "@/components/search/SearchFilterTracker";
import { getRequestCountryContext } from "@/lib/personalization/server";

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

function emptyCopy(reason: string | undefined): { title: string; description: string } {
  switch (reason) {
    case "no_query":
      return {
        title: "Search fixtures, teams, competitions and operators",
        description:
          "Type a competition, team, market, season, or operator name to discover validated research entities.",
      };
    case "filtered_away":
      return {
        title: "No fixtures match these filters.",
        description:
          "Matches exist, but none are available with the current type or country filter. Clear filters or try a broader query.",
      };
    case "unsupported_locale":
      return {
        title: "Language not available",
        description:
          "This locale is not available for search. Switch to a supported language and try again.",
      };
    default:
      return {
        title: "No matches for this search.",
        description:
          "Nothing in the validated registry matched that query. Try another spelling, a team alias, or browse popular research below.",
      };
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

  const copy = emptyCopy(response.meta.emptyReason);
  const filterHref = (type?: SearchGroupKey) => {
    const qs = new URLSearchParams();
    if (response.query) qs.set("q", response.query);
    if (type) qs.set("type", type);
    const suffix = qs.toString();
    return `/${locale}/search${suffix ? `?${suffix}` : ""}`;
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <SearchFilterTracker
        locale={locale}
        query={response.query}
        filter={typeFilter ?? null}
        resultsCount={response.meta.count}
      />

      <header className="border-b border-border pb-6">
        <p className="text-metadata font-medium uppercase tracking-label text-brand">
          Entity discovery
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-foreground">
          {response.query ? `Results for “${response.query}”` : "Search"}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          {response.query
            ? `${response.meta.count} validated ent${response.meta.count === 1 ? "ity" : "ities"} · ${response.meta.tookMs} ms`
            : "Search the RankWagers registry — competitions, seasons, teams, markets, and country-aware operators."}
        </p>
      </header>

      <nav className="mt-6 flex flex-wrap gap-2" aria-label="Result type filters">
        <Link
          href={filterHref()}
          className={`rounded-md px-3 py-1.5 text-sm ${
            !typeFilter
              ? "bg-accent font-medium text-brand"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          All
        </Link>
        {SEARCH_GROUP_ORDER.filter((key) => key !== "fixture").map((key) => (
          <Link
            key={key}
            href={filterHref(key)}
            className={`rounded-md px-3 py-1.5 text-sm ${
              typeFilter === key
                ? "bg-accent font-medium text-brand"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {SEARCH_GROUP_LABELS[key]}
          </Link>
        ))}
      </nav>

      {!response.results.length ? (
        <div className="mt-8">
          <EmptyState title={copy.title} description={copy.description} />
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          {SEARCH_GROUP_ORDER.map((groupKey) => {
            const rows = response.groups[groupKey];
            if (!rows?.length) return null;
            return (
              <section key={groupKey} aria-labelledby={`group-${groupKey}`}>
                <h2
                  id={`group-${groupKey}`}
                  className="font-display text-xl font-semibold text-foreground"
                >
                  {SEARCH_GROUP_LABELS[groupKey]}
                </h2>
                <ul className="mt-3 divide-y divide-border border-y border-border">
                  {rows.map((result) => (
                    <li key={`${result.entityType}-${result.slug}`}>
                      <Link
                        href={result.href}
                        className="flex items-baseline justify-between gap-3 py-2.5 text-sm text-foreground hover:text-brand"
                      >
                        <span>{result.title}</span>
                        <span className="shrink-0 text-metadata uppercase tracking-label text-muted-foreground">
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

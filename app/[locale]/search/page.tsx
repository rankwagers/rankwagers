import type { Metadata } from "next";
import type { CSSProperties } from "react";
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
   THE SEARCH PAGE — rw3 conversion, fixture-style hierarchy
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

  const chipStyle = (active: boolean): CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    padding: "5px 10px",
    border: `1px solid ${active ? "var(--text)" : "var(--line)"}`,
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 500,
    color: active ? "var(--text)" : "var(--muted)",
  });

  return (
    <div style={{ paddingBottom: 48 }}>
      <SearchFilterTracker
        locale={locale}
        query={response.query}
        filter={typeFilter ?? null}
        resultsCount={response.meta.count}
      />

      {/* LEAD — the query itself, count inline; without one, the invitation. */}
      <header style={{ padding: "14px 20px", borderBottom: "1px solid var(--line)" }}>
        <p className="rw3-label">{p.srchEyebrow}</p>
        <h1 className="rw3-title" style={{ margin: "2px 0 0" }}>
          {response.query
            ? formatDict(p.srchResultsFor, { q: response.query })
            : p.srchTitle}
        </h1>
        <p className="rw3-meta" style={{ margin: "2px 0 0", maxWidth: "62ch" }}>
          {response.query
            ? formatDict(p.srchCountLine, { n: String(response.meta.count) })
            : p.srchLede}
        </p>
      </header>

      {/* FILTERS — the type chips. */}
      <nav
        className="flex flex-wrap gap-2"
        style={{ padding: "16px 20px 0" }}
        aria-label={p.srchEyebrow}
      >
        <Link href={filterHref()} className="rw3-hoverable" style={chipStyle(!typeFilter)}>
          {p.srchAllFilter}
        </Link>
        {SEARCH_GROUP_ORDER.filter((key) => key !== "fixture").map((key) => (
          <Link
            key={key}
            href={filterHref(key)}
            className="rw3-hoverable"
            style={chipStyle(typeFilter === key)}
          >
            {groupLabels[key]}
          </Link>
        ))}
      </nav>

      {/* ROWS — grouped entity results as ruled rows, or the honest empty. */}
      {!response.results.length ? (
        <div style={{ padding: "28px 20px 0" }}>
          <p className="text-[14px] font-semibold">{copy.title}</p>
          <p
            className="mt-2 max-w-[52ch] py-1 pl-5 text-[13px]"
            style={{ borderLeft: "2px solid var(--line)", color: "var(--muted)" }}
          >
            {copy.description}
          </p>
        </div>
      ) : (
        <div className="space-y-8" style={{ padding: "28px 20px 0" }}>
          {SEARCH_GROUP_ORDER.map((groupKey) => {
            const rows = response.groups[groupKey];
            if (!rows?.length) return null;
            return (
              <section key={groupKey} aria-labelledby={`group-${groupKey}`}>
                <h2 id={`group-${groupKey}`} className="rw3-label">
                  {groupLabels[groupKey]}
                </h2>
                <ul className="mt-3" style={{ borderTop: "1px solid var(--line)" }}>
                  {rows.map((result) => (
                    <li key={`${result.entityType}-${result.slug}`}>
                      <Link
                        href={result.href}
                        className="rw3-hoverable flex items-baseline justify-between gap-x-4 py-3 pl-3.5 pr-2"
                        style={{ borderBottom: "1px solid var(--line)" }}
                      >
                        <span className="text-[13px]" style={{ color: "var(--text)" }}>
                          {result.title}
                        </span>
                        <span className="rw3-meta shrink-0">{result.entityType}</span>
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

import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { EmptyState } from "@/components/ui/EmptyState";
import { getCompetition } from "@/lib/competitions/registry";
import { CountryFlagIcon } from "@/components/CountryFlagIcon";
import { countryName } from "@/lib/geoNames";
import { locales, type Locale } from "@/lib/i18n";
import { listSeasons } from "@/lib/seasons/registry";
import { seasonsIndexLd } from "@/lib/seasons/schema";
import { seasonPath, seasonsIndexPath } from "@/lib/seasons/links";
import { pageMetadata } from "@/lib/seo";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export function generateMetadata({
  params,
}: {
  params: { locale: Locale };
}): Metadata {
  return pageMetadata({
    locale: params.locale,
    path: "/seasons",
    title: "Seasons — coverage and settled records",
    description:
      "Browse RankWagers season intelligence pages: fixtures, markets, participating teams, and country-aware operators.",
  });
}

export default function SeasonsIndexPage({
  params,
  searchParams,
}: {
  params: { locale: Locale };
  searchParams?: { q?: string; competition?: string; country?: string };
}) {
  const all = listSeasons().sort((left, right) =>
    left.displayName.localeCompare(right.displayName)
  );
  const q = searchParams?.q?.trim().toLowerCase() ?? "";
  const competitionFilter = searchParams?.competition?.trim() ?? "";
  const countryFilter = searchParams?.country?.trim().toUpperCase() ?? "";

  const seasons = all.filter((season) => {
    if (q) {
      const competition = getCompetition(season.competitionSlug);
      const haystack = `${season.displayName} ${competition?.name ?? ""}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (competitionFilter && season.competitionSlug !== competitionFilter) return false;
    if (countryFilter && season.countryCode !== countryFilter) return false;
    return true;
  });

  const competitions = [
    ...new Set(all.map((season) => season.competitionSlug)),
  ].sort();
  const countries = [
    ...new Set(all.map((season) => season.countryCode).filter(Boolean) as string[]),
  ].sort();

  return (
    <>
      <JsonLd data={seasonsIndexLd({ locale: params.locale, seasons: all })} />
      <div className="container-wide pb-16 pt-5">
        <section className="border-b border-[var(--border-subtle)] pb-8">
          <p className="text-metadata font-medium uppercase tracking-label text-brand">
            Season intelligence
          </p>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-display text-foreground md:text-4xl">
            Seasons
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--ink-secondary)] md:text-base">
            Canonical season research hubs connecting competitions, teams, fixtures, markets, and
            operators. Factual relationships only — no standings or tipster content.
          </p>
        </section>

        <form
          className="mt-8 grid gap-3 border-b border-[var(--border-subtle)] pb-8 md:grid-cols-3"
          action={seasonsIndexPath(params.locale)}
          method="get"
          role="search"
          aria-label="Filter seasons"
        >
          <label className="block text-sm">
            <span className="text-metadata font-semibold uppercase tracking-label text-muted-foreground">
              Search
            </span>
            <input
              type="search"
              name="q"
              defaultValue={searchParams?.q ?? ""}
              placeholder="Competition or season"
              className="mt-1.5 w-full rounded-md border border-border bg-[var(--canvas-secondary)] px-3 py-2 text-sm text-foreground"
            />
          </label>
          <label className="block text-sm">
            <span className="text-metadata font-semibold uppercase tracking-label text-muted-foreground">
              Competition
            </span>
            <select
              name="competition"
              defaultValue={competitionFilter}
              className="mt-1.5 w-full rounded-md border border-border bg-[var(--canvas-secondary)] px-3 py-2 text-sm text-foreground"
            >
              <option value="">All competitions</option>
              {competitions.map((slug) => (
                <option key={slug} value={slug}>
                  {getCompetition(slug)?.name ?? slug}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-metadata font-semibold uppercase tracking-label text-muted-foreground">
              Country
            </span>
            <select
              name="country"
              defaultValue={countryFilter}
              className="mt-1.5 w-full rounded-md border border-border bg-[var(--canvas-secondary)] px-3 py-2 text-sm text-foreground"
            >
              <option value="">All countries</option>
              {countries.map((code) => (
                <option key={code} value={code}>
                  {countryName(code)}
                </option>
              ))}
            </select>
          </label>
          <div className="md:col-span-3">
            <button type="submit" className="btn-primary">
              Apply filters
            </button>
          </div>
        </form>

        {seasons.length === 0 ? (
          <div className="mt-8">
            <EmptyState
              title="No seasons match these filters"
              description="Clear search or filters to browse the full canonical season registry."
              action={
                <Link href={seasonsIndexPath(params.locale)} className="btn-ghost">
                  Reset filters
                </Link>
              }
            />
          </div>
        ) : (
          <ul className="mt-8 divide-y divide-[var(--border-subtle)] border-y border-[var(--border-subtle)]">
            {seasons.map((season) => (
              <li key={season.id}>
                <Link
                  href={seasonPath(params.locale, season.competitionSlug, season.slug)}
                  className="block py-4 transition-colors hover:bg-[var(--canvas-secondary)]"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-semibold text-foreground">{season.displayName}</p>
                    <span className="flex items-center gap-1.5 text-metadata uppercase tracking-label text-muted-foreground">
                      {season.active ? "Current" : "Archived"}
                      {season.countryCode ? (
                        <>
                          {" · "}
                          <CountryFlagIcon code={season.countryCode} />
                          {countryName(season.countryCode)}
                        </>
                      ) : null}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-[var(--ink-secondary)]">
                    {getCompetition(season.competitionSlug)?.name ?? season.competitionSlug}
                    {" · "}
                    {season.startDate} → {season.endDate}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

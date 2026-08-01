import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { EmptyState } from "@/components/ui/EmptyState";
import { getCompetition } from "@/lib/competitions/registry";
import { countryName } from "@/lib/geoNames";
import { locales, type Locale } from "@/lib/i18n";
import { listTeams } from "@/lib/teams/registry";
import { teamsIndexLd } from "@/lib/teams/schema";
import { teamPath, teamsIndexPath } from "@/lib/teams/links";
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
    path: "/teams",
    title: "Teams — coverage and settled records",
    description:
      "Browse RankWagers team intelligence pages: fixtures, market evidence, competitions, and country-aware operators.",
  });
}

export default function TeamsIndexPage({
  params,
  searchParams,
}: {
  params: { locale: Locale };
  searchParams?: { q?: string; competition?: string; country?: string };
}) {
  const all = listTeams().sort((left, right) => left.name.localeCompare(right.name));
  const q = searchParams?.q?.trim().toLowerCase() ?? "";
  const competitionFilter = searchParams?.competition?.trim() ?? "";
  const countryFilter = searchParams?.country?.trim().toUpperCase() ?? "";

  const teams = all.filter((team) => {
    if (q) {
      const haystack = [team.name, team.shortName, ...(team.aliases ?? [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (competitionFilter && !team.competitionSlugs.includes(competitionFilter)) return false;
    if (countryFilter && team.countryCode !== countryFilter) return false;
    return true;
  });

  const competitions = [
    ...new Set(all.flatMap((team) => team.competitionSlugs)),
  ].sort();
  const countries = [
    ...new Set(all.map((team) => team.countryCode).filter(Boolean) as string[]),
  ].sort();

  return (
    <>
      <JsonLd data={teamsIndexLd({ locale: params.locale, teams: all })} />
      <div className="container-wide pb-16 pt-5">
        <section className="border-b border-[var(--border-subtle)] pb-8">
          <p className="text-metadata font-medium uppercase tracking-label text-brand">
            Team intelligence
          </p>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-display text-foreground md:text-4xl">
            Teams
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--ink-secondary)] md:text-base">
            Canonical team research hubs connected to competitions, fixtures, markets, and
            operators. Factual relationships only — no fan content or tipster ratings.
          </p>
        </section>

        <form
          className="mt-8 grid gap-3 border-b border-[var(--border-subtle)] pb-8 md:grid-cols-3"
          action={teamsIndexPath(params.locale)}
          method="get"
          role="search"
          aria-label="Filter teams"
        >
          <label className="block text-sm">
            <span className="text-metadata font-semibold uppercase tracking-label text-muted-foreground">
              Search
            </span>
            <input
              type="search"
              name="q"
              defaultValue={searchParams?.q ?? ""}
              placeholder="Team name"
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

        {teams.length === 0 ? (
          <div className="mt-8">
            <EmptyState
              title="No teams match these filters"
              description="Clear search or filters to browse the full canonical team registry."
              action={
                <Link href={teamsIndexPath(params.locale)} className="btn-ghost">
                  Reset filters
                </Link>
              }
            />
          </div>
        ) : (
          <ul className="mt-8 divide-y divide-[var(--border-subtle)] border-y border-[var(--border-subtle)]">
            {teams.map((team) => (
              <li key={team.slug}>
                <Link
                  href={teamPath(params.locale, team.slug)}
                  className="block py-4 transition-colors hover:bg-[var(--canvas-secondary)]"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-semibold text-foreground">{team.name}</p>
                    <span className="text-metadata uppercase tracking-label text-muted-foreground">
                      {team.countryCode ? countryName(team.countryCode) : "International"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-[var(--ink-secondary)]">
                    {team.competitionSlugs
                      .map((slug) => getCompetition(slug)?.name ?? slug)
                      .join(" · ")}
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

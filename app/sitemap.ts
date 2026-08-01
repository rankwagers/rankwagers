import type { MetadataRoute } from "next";
import { locales } from "@/lib/i18n";
import { BRANDS } from "@/lib/brands";
import { COMPARE_INDEXABLE_SLUGS } from "@/lib/compareSlugs";
import { listCompetitions } from "@/lib/competitions/registry";
import { listMarkets } from "@/lib/markets/registry";
import { listSeasons } from "@/lib/seasons/registry";
import { listTeams } from "@/lib/teams/registry";
import { listIndexableCountryCodes } from "@/lib/countries/landing";
import { listPublishedAccasForSitemap } from "@/lib/acca-publication/public";
import { siteUrl, contentDate } from "@/lib/seo";

/** Cache sitemap for an hour — crawl-friendly without force-dynamic. */
export const revalidate = 3600;

const STATIC_PATHS = [
  "",
  "/best-crypto-betting-sites",
  "/best-betting-sites",
  "/operators",
  "/markets",
  "/competitions",
  "/teams",
  "/seasons",
  "/countries",
  // /combo redirects to Acca Builder (noindex) — excluded from sitemap (Sprint 22)
  "/archive",
  "/methodology",
  "/bonuses",
  "/responsible-gambling",
  "/terms",
  "/privacy",
  "/availability",
];

type SitemapId =
  | "static"
  | "operators"
  | "markets"
  | "competitions"
  | "teams"
  | "seasons"
  | "countries"
  | "compare"
  | "accas";

/** Produces a sitemap index: /sitemap/static.xml, /sitemap/operators.xml, … */
export async function generateSitemaps() {
  return [
    { id: "static" },
    { id: "operators" },
    { id: "markets" },
    { id: "competitions" },
    { id: "teams" },
    { id: "seasons" },
    { id: "countries" },
    { id: "compare" },
    { id: "accas" },
  ] satisfies Array<{ id: SitemapId }>;
}

export default async function sitemap({
  id,
}: {
  id: SitemapId | number | string;
}): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const staticLastModified = contentDate();
  const entries: MetadataRoute.Sitemap = [];
  const key = String(id) as SitemapId;

  /*
   * Sprint 20B-B stage B5 — published Accas.
   *
   * Handled OUTSIDE the per-locale loop, because an Acca belongs to exactly one locale. Emitting
   * it once per locale would fabricate 31 URLs from one piece of work and serve English content
   * at Turkish URLs — the thin-duplicate problem already recorded in the SEO backlog.
   *
   * `/accas` index URLs are emitted only for locales that actually have a published Acca, so an
   * empty listing is never advertised to a crawler. This is the only shard that reads storage;
   * it fails soft to an empty list, so an outage costs one crawl cycle rather than the sitemap.
   */
  if (key === "accas") {
    const published = await listPublishedAccasForSitemap();
    const localesWithAccas = new Set<string>();
    for (const acca of published) {
      if (!(locales as readonly string[]).includes(acca.locale)) continue;
      localesWithAccas.add(acca.locale);
      entries.push({
        url: `${base}/${acca.locale}/accas/${acca.slug}`,
        lastModified: acca.publishedAt ? new Date(acca.publishedAt) : staticLastModified,
        changeFrequency: "weekly",
        priority: 0.6,
      });
    }
    for (const locale of localesWithAccas) {
      entries.push({
        url: `${base}/${locale}/accas`,
        lastModified: staticLastModified,
        changeFrequency: "daily",
        priority: 0.65,
      });
    }
    return entries;
  }

  for (const locale of locales) {
    if (key === "static") {
      for (const p of STATIC_PATHS) {
        const isHome = p === "";
        entries.push({
          url: `${base}/${locale}${p}`,
          // Stable content date, not a per-request `new Date()`. The home genuinely
          // changes ~daily — which `changeFrequency: "daily"` already signals — so a
          // fresh lastmod on every hourly revalidate would be a false "just changed"
          // signal that erodes crawl trust and wastes crawl budget.
          lastModified: staticLastModified,
          changeFrequency: isHome ? "daily" : "weekly",
          priority: isHome ? 1 : 0.7,
        });
      }
    }

    if (key === "operators") {
      for (const brand of BRANDS) {
        entries.push({
          url: `${base}/${locale}/operators/${brand.slug}`,
          lastModified: staticLastModified,
          changeFrequency: "weekly",
          priority: 0.75,
        });
        entries.push({
          url: `${base}/${locale}/reviews/${brand.slug}`,
          lastModified: staticLastModified,
          changeFrequency: "weekly",
          priority: 0.55,
        });
      }
    }

    if (key === "markets") {
      for (const market of listMarkets()) {
        entries.push({
          url: `${base}/${locale}/markets/${market.slug}`,
          lastModified: staticLastModified,
          changeFrequency: "weekly",
          priority: 0.8,
        });
      }
    }

    if (key === "competitions") {
      for (const competition of listCompetitions()) {
        entries.push({
          url: `${base}/${locale}/competitions/${competition.slug}`,
          lastModified: staticLastModified,
          changeFrequency: "weekly",
          priority: 0.8,
        });
      }
    }

    if (key === "teams") {
      for (const team of listTeams()) {
        entries.push({
          url: `${base}/${locale}/teams/${team.slug}`,
          lastModified: staticLastModified,
          changeFrequency: "weekly",
          priority: 0.75,
        });
      }
    }

    if (key === "seasons") {
      for (const season of listSeasons()) {
        entries.push({
          url: `${base}/${locale}/competitions/${season.competitionSlug}/seasons/${season.slug}`,
          lastModified: staticLastModified,
          changeFrequency: "weekly",
          priority: 0.75,
        });
      }
    }

    if (key === "countries") {
      for (const code of listIndexableCountryCodes()) {
        entries.push({
          url: `${base}/${locale}/countries/${code.toLowerCase()}`,
          lastModified: staticLastModified,
          changeFrequency: "weekly",
          priority: 0.7,
        });
      }
    }

    if (key === "compare") {
      for (const slug of COMPARE_INDEXABLE_SLUGS) {
        entries.push({
          url: `${base}/${locale}/compare/${slug}`,
          lastModified: staticLastModified,
          changeFrequency: "monthly",
          priority: 0.5,
        });
      }
    }
  }

  return entries;
}

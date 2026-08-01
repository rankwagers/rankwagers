import type { Locale } from "@/lib/i18n";
import { operatorPath } from "@/lib/operators/links";

export function marketsIndexPath(locale: Locale): string {
  return `/${locale}/markets`;
}

export function marketPath(locale: Locale, slug: string): string {
  return `/${locale}/markets/${slug}`;
}

export function marketFixtureHref(locale: Locale): string {
  return `/${locale}#fixtures`;
}

export function marketEvidenceHref(locale: Locale): string {
  return `/${locale}/methodology`;
}

export function marketOddsHref(locale: Locale): string {
  return `/${locale}#fixtures`;
}

export function marketLeagueHref(locale: Locale, leagueName?: string): string {
  if (!leagueName) return `/${locale}/competitions`;
  const slug = leagueName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  // Prefer competition index; detail pages use registry slugs (premier-league, etc.).
  const known = [
    "premier-league",
    "la-liga",
    "serie-a",
    "bundesliga",
    "ligue-1",
    "champions-league",
    "europa-league",
    "libertadores",
    "brasileirao",
    "eredivisie",
    "mls",
    "liga-mx",
    "npfl",
    "j-league",
  ];
  if (known.includes(slug)) return `/${locale}/competitions/${slug}`;
  return `/${locale}/competitions`;
}

export function marketOperatorHref(locale: Locale, slug: string): string {
  return operatorPath(locale, slug);
}

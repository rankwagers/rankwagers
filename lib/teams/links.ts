import type { Locale } from "@/lib/i18n";
import { competitionPath } from "@/lib/competitions/links";
import { marketPath } from "@/lib/markets/links";
import { operatorPath } from "@/lib/operators/links";

export function teamsIndexPath(locale: Locale): string {
  return `/${locale}/teams`;
}

export function teamPath(locale: Locale, slug: string): string {
  return `/${locale}/teams/${slug}`;
}

export function teamFixtureHref(locale: Locale): string {
  return `/${locale}#fixtures`;
}

export function teamCompetitionHref(locale: Locale, competitionSlug: string): string {
  return competitionPath(locale, competitionSlug);
}

export function teamMarketHref(locale: Locale, marketSlug: string): string {
  return marketPath(locale, marketSlug);
}

export function teamOperatorHref(locale: Locale, operatorSlug: string): string {
  return operatorPath(locale, operatorSlug);
}

export function teamEvidenceHref(locale: Locale): string {
  return `/${locale}/methodology`;
}

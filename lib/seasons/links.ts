import type { Locale } from "@/lib/i18n";
import { competitionPath } from "@/lib/competitions/links";
import { marketPath } from "@/lib/markets/links";
import { operatorPath } from "@/lib/operators/links";
import { teamPath } from "@/lib/teams/links";

export function seasonsIndexPath(locale: Locale): string {
  return `/${locale}/seasons`;
}

export function seasonPath(
  locale: Locale,
  competitionSlug: string,
  seasonSlug: string
): string {
  return `/${locale}/competitions/${competitionSlug}/seasons/${seasonSlug}`;
}

export function seasonCompetitionHref(locale: Locale, competitionSlug: string): string {
  return competitionPath(locale, competitionSlug);
}

export function seasonTeamHref(locale: Locale, teamSlug: string): string {
  return teamPath(locale, teamSlug);
}

export function seasonMarketHref(locale: Locale, marketSlug: string): string {
  return marketPath(locale, marketSlug);
}

export function seasonOperatorHref(locale: Locale, operatorSlug: string): string {
  return operatorPath(locale, operatorSlug);
}

export function seasonFixtureHref(locale: Locale): string {
  return `/${locale}#fixtures`;
}

export function seasonEvidenceHref(locale: Locale): string {
  return `/${locale}/methodology`;
}

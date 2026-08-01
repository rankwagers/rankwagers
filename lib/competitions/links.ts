import type { Locale } from "@/lib/i18n";
import { marketPath } from "@/lib/markets/links";
import { operatorPath } from "@/lib/operators/links";

export function competitionsIndexPath(locale: Locale): string {
  return `/${locale}/competitions`;
}

export function competitionPath(locale: Locale, slug: string): string {
  return `/${locale}/competitions/${slug}`;
}

export function competitionFixtureHref(locale: Locale): string {
  return `/${locale}#fixtures`;
}

export function competitionMarketHref(locale: Locale, marketSlug: string): string {
  return marketPath(locale, marketSlug);
}

export function competitionOperatorHref(locale: Locale, operatorSlug: string): string {
  return operatorPath(locale, operatorSlug);
}

export function competitionEvidenceHref(locale: Locale): string {
  return `/${locale}/methodology`;
}

import type { Locale } from "@/lib/i18n";

export function countryPath(locale: Locale | string, code: string): string {
  return `/${locale}/countries/${code.toLowerCase()}`;
}

export function countriesIndexPath(locale: Locale | string): string {
  return `/${locale}/countries`;
}

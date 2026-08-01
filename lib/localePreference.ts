import { isLocale, type Locale } from "./i18n";

export const LOCALE_COOKIE = "rw_locale";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function localeFromCookie(value: string | undefined): Locale | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  return isLocale(v) ? v : null;
}

"use client";

import { usePathname } from "next/navigation";
import { locales, localeNames, isLocale, type Locale } from "@/lib/i18n";
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE } from "@/lib/localePreference";

function localePath(pathname: string, locale: Locale): string {
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] && isLocale(segments[0])) {
    segments[0] = locale;
  } else {
    segments.unshift(locale);
  }
  return `/${segments.join("/")}`;
}

export function LanguageSwitcher({ current }: { current: Locale }) {
  const pathname = usePathname();

  function switchTo(locale: Locale) {
    if (locale === current) return;
    try {
      document.cookie = `${LOCALE_COOKIE}=${encodeURIComponent(locale)}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
    } catch {
      /* ignore */
    }
    const next = localePath(pathname || `/${current}`, locale);
    window.location.assign(next);
  }

  return (
    <select
      aria-label="Language"
      value={current}
      onChange={(e) => switchTo(e.target.value as Locale)}
      className="rounded-md border border-border bg-muted px-2 py-1 text-sm text-foreground"
    >
      {locales.map((l) => (
        <option key={l} value={l}>
          {localeNames[l]}
        </option>
      ))}
    </select>
  );
}

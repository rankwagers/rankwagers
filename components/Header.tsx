"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { FullDictionary } from "@/lib/dictionaries";
import type { Locale } from "@/lib/i18n";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { MobileNav } from "./MobileNav";
import { GlobalSearch } from "./search/GlobalSearch";
import { trackHomepageNavigation } from "@/lib/analytics/homepage";
import { trackAnalyticsEvent } from "@/lib/analytics/client";
import { buildPrimaryNav } from "@/lib/navigation/primaryNav";

function navActive(pathname: string, href: string): boolean {
  const base = href.split("#")[0].split("?")[0];
  if (base.endsWith("/") && base.length > 1) {
    return pathname === base.slice(0, -1) || pathname === base;
  }
  return (
    pathname === base ||
    (base !== "" &&
      pathname.startsWith(base + "/") &&
      base.split("/").length > 2)
  );
}

export function Header({
  dict,
  locale,
  embedded = false,
}: {
  dict: FullDictionary;
  locale: Locale;
  embedded?: boolean;
}) {
  const pathname = usePathname() ?? "";
  const { groups, desktop } = buildPrimaryNav(locale, {
    bestBetting: dict.nav.bestBetting,
    bestCrypto: dict.nav.bestCrypto,
    bonuses: dict.nav.bonuses,
    reviews: dict.nav.reviews,
  });

  return (
    <header
      className={
        embedded
          ? "bg-[var(--canvas-secondary)]"
          : "sticky top-0 z-30 border-b border-border bg-[var(--canvas-secondary)]/95 backdrop-blur-md"
      }
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-brand focus:px-3 focus:py-2 focus:text-white"
      >
        {dict.a11y.skipToContent}
      </a>
      <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between gap-3 px-6 lg:px-10">
        <div className="flex min-w-0 items-center gap-4 lg:gap-6">
          <Link
            href={`/${locale}`}
            className="font-display text-lg font-semibold tracking-display text-brand"
          >
            RankWagers
          </Link>
          {/*
            `min-w-0` is load-bearing. Without it this nav claimed its full intrinsic width inside
            the flex row and simply painted over the search box to its right; it did not wrap and
            it did not clip.

            `overflow-hidden` is the backstop, not the mechanism. What makes the row fit is the
            five-entry `desktopPrimary` budget set in primaryNav.ts, measured against the space the
            capped header container actually leaves. Should a future entry or label outgrow that
            budget, this degrades to a clipped entry rather than back to text painted over the
            search input. The labels in this row are hardcoded English, so its width does not move
            with locale.
          */}
          <nav
            className="hidden min-w-0 items-center gap-0.5 overflow-hidden xl:flex"
            aria-label="Primary navigation"
          >
            {desktop.map((item) => {
              const active = navActive(pathname, item.href);
              return (
                <Link
                  key={`${item.href}-${item.label}`}
                  href={item.href}
                  onClick={() => {
                    if (item.analyticsDestination) {
                      trackHomepageNavigation(item.analyticsDestination, locale);
                    }
                    if (item.analyticsDestination === "live_signals") {
                      trackAnalyticsEvent({
                        event_name: "live_signals_nav_clicked",
                        fixture_id: null,
                        market: null,
                        operator_slug: null,
                        locale,
                        user_id: null,
                        properties: { source: "header" },
                      });
                    }
                  }}
                  className={`whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm transition-colors ${
                    active
                      ? "bg-accent font-medium text-brand"
                      : "text-[var(--ink-secondary)] hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <GlobalSearch locale={locale} variant="header" />
          <span className="hidden rounded-full border border-brand/25 px-2 py-0.5 text-xs font-semibold text-brand sm:inline">
            18+
          </span>
          <div className="hidden md:block">
            <LanguageSwitcher current={locale} />
          </div>
          <MobileNav dict={dict} locale={locale} groups={groups} />
        </div>
      </div>
    </header>
  );
}

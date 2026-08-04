"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { FullDictionary } from "@/lib/dictionaries";
import type { Locale } from "@/lib/i18n";
import { MobileNav } from "./MobileNav";
import { trackHomepageNavigation } from "@/lib/analytics/homepage";
import { trackAnalyticsEvent } from "@/lib/analytics/client";
import { buildPrimaryNav } from "@/lib/navigation/primaryNav";

/* ============================================================================
   THE MASTHEAD — rebrand v2, replicated from the map
   ----------------------------------------------------------------------------
   A publication's masthead, not an app bar:

     nameplate   the heading face, 19px, tight
     nav         MONO, uppercase, letterspaced — the active destination carries
                 a 2px ink rule that draws in from the left
     meta        one mono line, right: retrieved · edition · 18+
     rule        2px ink over a 1px half-ink hairline, 2px apart

   WHAT MOVED OUT, AND WHY IT IS NOT A REGRESSION.

   The search input and the language select are gone from the bar and live in
   the menu sheet. That is a product decision, taken deliberately: the map's
   masthead is four elements wide and a text input in it would be the widest
   and loudest thing on a page whose subject is a table of research. Neither
   is removed — both are one tap away, in the sheet that already exists on
   every route and already holds the full navigation.

   The nav is no longer `xl:`-only. With the input gone the row has the width
   to show the destinations from `lg`, which is the point of taking it out.
   ========================================================================== */

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
  meta,
  embedded = false,
}: {
  dict: FullDictionary;
  locale: Locale;
  /**
   * The masthead line, resolved on the server: `Lists retrieved 08:31 UTC · Edition 216 · 18+`.
   *
   * Passed in rather than derived here because this is a client component and both halves are
   * server facts — the provider's retrieval stamp and the archive directory.
   */
  meta?: string;
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
    <header className={embedded ? "" : "border-b border-[var(--hero-line)] bg-[var(--hero-canvas)]"}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:bg-[var(--hero-accent)] focus:px-3 focus:py-2 focus:text-white"
      >
        {dict.a11y.skipToContent}
      </a>

      <div className="mx-auto w-full max-w-[1240px] px-5 pt-6 lg:px-8">
        {/* Baseline-aligned, wrapping: the nameplate, the destinations, then the line. */}
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 pb-3">
          <Link href={`/${locale}`} className="rw-h text-[19px] text-[var(--hero-ink)]">
            RankWagers
          </Link>

          <nav
            className="hidden min-w-0 flex-wrap items-baseline gap-x-5 gap-y-1 lg:flex"
            aria-label="Primary navigation"
          >
            {desktop.map((item) => {
              const active = navActive(pathname, item.href);
              return (
                <Link
                  key={`${item.href}-${item.label}`}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
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
                  /*
                    Mono, uppercase, 0.1em. The active rule is an absolutely positioned 2px bar
                    that scales from the left — so it costs no layout in either state and cannot
                    reflow the row when the destination changes.
                  */
                  className={`rw-nav group relative whitespace-nowrap pb-[3px] ${
                    active ? "font-bold text-[var(--hero-ink)]" : "text-[var(--hero-ink-2)]"
                  }`}
                >
                  {item.label}
                  <span
                    aria-hidden
                    className={`absolute inset-x-0 bottom-0 h-[2px] origin-left bg-[var(--hero-ink)] transition-transform duration-[var(--dur-respond)] ease-[var(--ease-settle)] ${
                      active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                    }`}
                  />
                </Link>
              );
            })}
          </nav>

          {/*
            THE MASTHEAD LINE. `ml-auto` so it holds the right edge at every width, and it wraps
            to its own line rather than compressing the nav beside it.
          */}
          {meta ? (
            <p className="rw-tnum ml-auto text-[10.5px] uppercase tracking-[0.08em] text-[var(--hero-ink-2)] [font-family:var(--font-hero-mono),ui-monospace,monospace]">
              {meta}
            </p>
          ) : null}

          {/* The sheet now carries search and the language select as well as the navigation. */}
          <div className="ml-auto shrink-0 lg:ml-0">
            <MobileNav dict={dict} locale={locale} groups={groups} />
          </div>
        </div>
      </div>

      {/* The thick masthead rule: 2px ink, then a half-ink hairline 2px below it. */}
      <div aria-hidden className="mx-auto w-full max-w-[1240px] px-5 lg:px-8">
        <div className="h-[2px] w-full bg-[var(--hero-ink)]" />
        <div className="mt-[2px] h-px w-full bg-[var(--hero-ink)] opacity-50" />
      </div>
    </header>
  );
}

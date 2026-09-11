"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Locale } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Icon } from "@/components/v3/Icon";

/* The v3 header (Bible V3, shell): logo · four destinations · search · locale
   · 18+ pill · sign-in. 52px on desktop; on mobile it drops to 48px and the
   destinations move to a scrollable 2nd row — the bottom tab bar carries the
   primary nav there. Client component for pathname-active state only; every
   string arrives as a prop (bundle-boundary law: no dictionary imports in
   client files). */

export type HeaderV3Strings = {
  predictions: string;
  bettingTips: string;
  bettingSites: string;
  freeBets: string;
  search: string;
  signIn: string;
  skipToContent: string;
};

export function HeaderV3({ locale, strings }: { locale: Locale; strings: HeaderV3Strings }) {
  const pathname = usePathname() ?? "";
  const items = [
    { href: `/${locale}`, label: strings.predictions, exact: true },
    { href: `/${locale}/markets`, label: strings.bettingTips, exact: false },
    { href: `/${locale}/best-betting-sites`, label: strings.bettingSites, exact: false },
    { href: `/${locale}/free-bets`, label: strings.freeBets, exact: false },
  ];
  const isActive = (item: { href: string; exact: boolean }) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  const navLink = (item: (typeof items)[number]) => {
    const active = isActive(item);
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        className="rw3-nav-link"
        style={{
          padding: "0 0 2px",
          borderBottom: `2px solid ${active ? "var(--text)" : "transparent"}`,
          color: active ? "var(--text)" : "var(--muted)",
          fontWeight: 500,
          whiteSpace: "nowrap",
          transition: "color 120ms ease-out",
        }}
      >
        {item.label}
      </Link>
    );
  };

  return (
    <header style={{ borderBottom: "1px solid var(--line)" }}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50"
        style={{ background: "var(--accent)", color: "var(--accent-ink)", padding: "6px 10px" }}
      >
        {strings.skipToContent}
      </a>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          height: 52,
          padding: "0 20px",
          gap: 22,
          maxWidth: 1440,
          margin: "0 auto",
        }}
      >
        <Link
          href={`/${locale}`}
          style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, fontSize: 15 }}
        >
          <span
            aria-hidden
            style={{ width: 16, height: 16, background: "var(--text)", borderRadius: 4, flex: "none" }}
          />
          RankWagers
        </Link>

        <nav
          aria-label="Primary navigation"
          className="rw3-desktop-nav"
          style={{ display: "flex", gap: 18, fontSize: 13, alignSelf: "stretch", alignItems: "center" }}
        >
          {items.map(navLink)}
        </nav>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <Link
            href={`/${locale}/search`}
            className="rw3-hoverable rw3-search-entry"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: 240,
              height: 32,
              padding: "0 10px",
              border: "1px solid var(--line)",
              borderRadius: 6,
              color: "var(--muted)",
              fontSize: 12,
              background: "var(--surface)",
            }}
          >
            <Icon name="search" size={13} />
            {strings.search}
          </Link>
          <span className="rw3-locale-switcher" style={{ display: "flex" }}>
            <LanguageSwitcher current={locale} />
          </span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              border: "1px solid var(--line)",
              padding: "2px 5px",
              borderRadius: 4,
              color: "var(--muted)",
            }}
          >
            18+
          </span>
          <Link href="/admin" className="rw3-ghost rw3-signin" style={{ height: 32 }}>
            {strings.signIn}
          </Link>
        </div>
      </div>

      {/* Mobile destination row — hidden from lg up via the rw3 chrome CSS. */}
      <nav
        aria-label="Primary navigation (mobile)"
        className="rw3-mobile-navrow"
        style={{
          display: "none",
          gap: 16,
          padding: "0 14px",
          fontSize: 12,
          fontWeight: 500,
          borderTop: "1px solid var(--line)",
          whiteSpace: "nowrap",
          overflowX: "auto",
        }}
      >
        {items.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              style={{
                padding: "9px 0",
                borderBottom: `2px solid ${active ? "var(--text)" : "transparent"}`,
                color: active ? "var(--text)" : "var(--muted)",
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

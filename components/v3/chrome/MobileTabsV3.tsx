"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Locale } from "@/lib/i18n";
import { Icon } from "@/components/v3/Icon";

/* The mobile bottom tab bar — the rails' jobs collapse into four doors:
   Predictions (home), Sites, Free bets, Record. Nav icons are the only icons
   here (icon law). Hidden from lg up via the rw3 chrome CSS; the page body
   gets bottom padding so the bar never covers the last row. */

export type MobileTabsStrings = {
  predictions: string;
  sites: string;
  freeBets: string;
  record: string;
};

export function MobileTabsV3({ locale, strings }: { locale: Locale; strings: MobileTabsStrings }) {
  const pathname = usePathname() ?? "";
  const tabs = [
    { href: `/${locale}`, icon: "navPred" as const, label: strings.predictions, exact: true },
    { href: `/${locale}/operators`, icon: "navSites" as const, label: strings.sites, exact: false },
    { href: `/${locale}/free-bets`, icon: "navFree" as const, label: strings.freeBets, exact: false },
    { href: `/${locale}/archive`, icon: "navRecord" as const, label: strings.record, exact: false },
  ];
  return (
    <nav
      aria-label="Bottom navigation"
      className="rw3-bottom-tabs"
      style={{
        display: "none",
        position: "fixed",
        insetInline: 0,
        bottom: 0,
        zIndex: 40,
        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        borderTop: "1px solid var(--line)",
        background: "var(--surface)",
        padding: "8px 0 10px",
      }}
    >
      {tabs.map((tab) => {
        const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
              fontSize: 11,
              fontWeight: active ? 600 : 400,
              color: active ? "var(--text)" : "var(--muted)",
            }}
          >
            <Icon name={tab.icon} size={18} />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

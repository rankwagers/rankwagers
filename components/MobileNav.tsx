"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { FullDictionary } from "@/lib/dictionaries";
import type { Locale } from "@/lib/i18n";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { SiteBrandLogo } from "./SiteBrand";
import { trackHomepageNavigation } from "@/lib/analytics/homepage";
import { trackAnalyticsEvent } from "@/lib/analytics/client";
import { GlobalSearch } from "./search/GlobalSearch";
import type { NavGroup } from "@/lib/navigation/primaryNav";
import { trapTabKey } from "@/lib/ui/focusTrap";
import { X } from "lucide-react";

export function MobileNav({
 locale,
 groups,
}: {
 dict: FullDictionary;
 locale: Locale;
 groups: NavGroup[];
}) {
 const [open, setOpen] = useState(false);
 const [mounted, setMounted] = useState(false);
 const panelRef = useRef<HTMLElement | null>(null);
 const closeRef = useRef<HTMLButtonElement | null>(null);
 const menuButtonRef = useRef<HTMLButtonElement | null>(null);
 const previousFocus = useRef<HTMLElement | null>(null);

 useEffect(() => {
 setMounted(true);
 }, []);

 useEffect(() => {
 if (!open) return;
 previousFocus.current = document.activeElement as HTMLElement | null;
 const menuButton = menuButtonRef.current;
 const prev = document.body.style.overflow;
 document.body.style.overflow = "hidden";
 closeRef.current?.focus();

 const onKey = (e: KeyboardEvent) => {
 if (e.key === "Escape") {
 setOpen(false);
 return;
 }
 if (panelRef.current) trapTabKey(e, panelRef.current);
 };
 window.addEventListener("keydown", onKey);
 return () => {
 document.body.style.overflow = prev;
 window.removeEventListener("keydown", onKey);
 (previousFocus.current ?? menuButton)?.focus();
 };
 }, [open]);

 const panel =
 open && mounted
 ? createPortal(
 <>
 <button
 type="button"
 className="fixed inset-0 z-[100] bg-[var(--backdrop)] backdrop-blur-[1px]"
 aria-label="Close menu"
 onClick={() => setOpen(false)}
 />
 <nav
 ref={panelRef}
 id="mobile-nav-panel"
 className="panel-enter fixed inset-y-0 right-0 z-[101] flex w-[min(100%,300px)] flex-col gap-1 overflow-y-auto border-l border-border bg-[var(--canvas-secondary)] p-4 shadow-elevated"
 aria-label="Mobile navigation"
 >
 <div className="mb-4 flex items-center justify-between gap-2">
 <SiteBrandLogo variant="drawer" />
 <button
 ref={closeRef}
 type="button"
 onClick={() => setOpen(false)}
 className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-[var(--canvas-primary)] hover:text-foreground"
 aria-label="Close menu"
 >
 <X className="h-4 w-4" aria-hidden />
 </button>
 </div>
 <div className="mb-3">
 <GlobalSearch
 locale={locale}
 variant="mobile"
 onNavigate={() => setOpen(false)}
 />
 </div>
 {groups.map((group) => (
 <div key={group.id} className="mb-3">
 <p className="px-3 pb-1 pt-2 text-metadata font-semibold uppercase tracking-label text-muted-foreground">
 {group.label}
 </p>
 {group.items.map((item) => (
 <Link
 key={`${group.id}-${item.href}-${item.label}`}
 href={item.href}
 onClick={() => {
 setOpen(false);
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
 properties: { source: "mobile_navigation" },
 });
 }
 }}
 className="block min-h-11 rounded-md px-3 py-2.5 text-sm font-medium text-[var(--ink-secondary)] hover:bg-[var(--canvas-primary)] hover:text-foreground"
 >
 {item.label}
 </Link>
 ))}
 </div>
 ))}
 <div className="mt-2 flex items-center gap-2 border-t border-border pt-4">
 <span className="rounded-full border border-brand/25 px-2 py-0.5 text-xs font-semibold text-brand">
 18+
 </span>
 <LanguageSwitcher current={locale} />
 </div>
 </nav>
 </>,
 document.body
 )
 : null;

 return (
 // Visible at every width, not just below xl. The compact desktop row holds five entries because
 // that is all the capped header container can seat without overrunning the search box, so this
 // grouped menu is the only route to the other four on desktop — it is no longer mobile-only.
 <div className="relative z-10">
 <button
 ref={menuButtonRef}
 type="button"
 aria-expanded={open}
 aria-controls="mobile-nav-panel"
 onClick={() => setOpen((v) => !v)}
 className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border text-foreground hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
 >
 <span className="sr-only">Menu</span>
 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
 <path
 d="M4 7h16M4 12h16M4 17h16"
 stroke="currentColor"
 strokeWidth="2"
 strokeLinecap="round"
 />
 </svg>
 </button>
 {panel}
 </div>
 );
}

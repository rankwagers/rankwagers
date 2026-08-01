import Link from "next/link";
import type { ReactNode } from "react";

const NAV = [
 { href: "/admin/affiliate/overview", label: "Overview" },
 { href: "/admin/affiliate/operators", label: "Operators" },
 { href: "/admin/affiliate/placements", label: "Placements" },
 { href: "/admin/affiliate/funnels", label: "Funnels" },
 { href: "/admin/affiliate/campaigns", label: "Campaigns" },
 { href: "/admin/affiliate/redirects", label: "Redirects" },
 { href: "/admin/affiliate/availability", label: "Availability" },
 { href: "/admin/affiliate/issues", label: "Issues" },
 { href: "/admin/affiliate/quality", label: "Quality" },
 { href: "/admin/dashboard", label: "← Intelligence" },
] as const;

export function AffiliateShell({
 title,
 children,
 activePath,
}: {
 title: string;
 children: ReactNode;
 activePath: string;
}) {
 return (
 <div className="min-h-screen bg-[var(--surface-elevated)] text-foreground">
 <header className="border-b border-border bg-background">
 <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4">
 <div>
 <p className="text-metadata font-medium uppercase tracking-label text-brand">
 Affiliate Intelligence · noindex
 </p>
 <h1 className="font-semibold text-xl text-foreground">{title}</h1>
 </div>
 <form action="/api/admin/logout" method="post">
 <button
 type="submit"
 className="min-h-10 rounded-md border border-border px-3 text-sm hover:bg-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400"
 >
 Log out
 </button>
 </form>
 </div>
 <nav
 aria-label="Affiliate intelligence sections"
 className="mx-auto max-w-7xl overflow-x-auto px-4 pb-3"
 >
 <ul className="flex min-w-max gap-2">
 {NAV.map((item) => {
 const active = activePath === item.href;
 return (
 <li key={item.href}>
 <Link
 href={item.href}
 className={`inline-flex min-h-10 items-center rounded-md px-3 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400 ${
 active
 ?"bg-[var(--green-surface)] text-brand"
 :"text-[var(--ink-secondary)] hover:bg-card"
 }`}
 aria-current={active ? "page" : undefined}
 >
 {item.label}
 </Link>
 </li>
 );
 })}
 </ul>
 </nav>
 </header>
 <main id="main" className="mx-auto max-w-7xl px-4 py-6">
 {children}
 </main>
 </div>
 );
}

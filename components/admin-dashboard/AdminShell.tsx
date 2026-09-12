import Link from "next/link";
import type { ReactNode } from "react";
import { getFeatureFlags } from "@/lib/config/featureFlags";

const NAV = [
  { href: "/admin/dashboard", label: "Overview" },
  { href: "/admin/predictions", label: "Predictions" },
  { href: "/admin/featured", label: "Featured picks" },
  { href: "/admin/markets", label: "Markets" },
  { href: "/admin/leagues", label: "Leagues" },
  { href: "/admin/builder", label: "Builder" },
  { href: "/admin/operators", label: "Operators" },
  { href: "/admin/search", label: "Search" },
  { href: "/admin/system", label: "System" },
  { href: "/admin/seo/overview", label: "SEO" },
  { href: "/admin/affiliate/overview", label: "Affiliate" },
  { href: "/admin/calibration/overview", label: "Calibration" },
  { href: "/admin/experiments/overview", label: "Experiments" },
  { href: "/admin/traffic", label: "Traffic" },
] as const;

/**
 * Feature-gated navigation entries (Sprint 20B-A Phase E).
 *
 * AdminShell only ever renders inside `AdminGate`, so reaching this code already implies an
 * authorized admin. The remaining condition is the server-side feature flag, evaluated here
 * rather than hidden with CSS — a disabled feature produces no link at all, and its routes
 * independently return 404, so the nav is not the security boundary.
 */
function navItems(): ReadonlyArray<{ href: string; label: string }> {
  const items = [...NAV] as Array<{ href: string; label: string }>;
  if (getFeatureFlags().operatorApprovalEnabled) {
    items.push({ href: "/admin/builder-approval", label: "Builder approval" });
    // Sprint 20B-B stage B4. Gated by the same flag and ordered directly after Builder approval,
    // because that is the workflow order: a candidate is approved, then it becomes an Acca.
    items.push({ href: "/admin/accas", label: "Acca Studio" });
  }
  return items;
}

/**
 * V3 reskin — the rw3 scope is applied to the HEADER CHROME ONLY, not the
 * whole page. The admin tools inside `children` are built for the light v2
 * theme: white inputs (`bg-[var(--surface-elevated)]`), light cards
 * (`bg-card`), dark ink (`text-foreground`), and tables whose transparent
 * bodies sit directly on this wrapper's white ground. Scoping `.rw3` over
 * them would put its dark background/inherited light ink and light-ink
 * focus rings under light-theme surfaces, so the content area keeps the
 * plain light wrapper and only the shell chrome speaks rw3.
 */
export function AdminShell({
  title,
  children,
  activePath,
}: {
  title: string;
  children: ReactNode;
  activePath: string;
}) {
  const nav = navItems();
  return (
    <div className="min-h-screen bg-[var(--surface-elevated)] text-foreground">
      <header
        className="rw3"
        style={{
          borderBottom: "1px solid var(--line)",
          background: "var(--surface)",
        }}
      >
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div>
            <p className="rw3-label">Internal · noindex</p>
            <h1 className="rw3-title">{title}</h1>
          </div>
          <form action="/api/admin/logout" method="post">
            <button type="submit" className="rw3-ghost min-h-10">
              Log out
            </button>
          </form>
        </div>
        <nav
          aria-label="Admin sections"
          className="mx-auto max-w-7xl overflow-x-auto px-4 pb-3"
        >
          <ul className="flex min-w-max gap-2">
            {nav.map((item) => {
              const active = activePath === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`inline-flex min-h-10 items-center px-3 ${
                      active ? "" : "rw3-hoverable"
                    }`}
                    style={{
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 500,
                      border: active
                        ? "1px solid var(--text)"
                        : "1px solid transparent",
                      color: active ? "var(--text)" : "var(--muted)",
                    }}
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

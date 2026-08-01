"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, type FormEvent } from "react";

export function AffiliateFiltersBar({ section }: { section: string }) {
 const router = useRouter();
 const pathname = usePathname();
 const params = useSearchParams();

 const onSubmit = useCallback(
 (e: FormEvent<HTMLFormElement>) => {
 e.preventDefault();
 const fd = new FormData(e.currentTarget);
 const next = new URLSearchParams();
 for (const [k, v] of fd.entries()) {
 const s = String(v).trim();
 if (s) next.set(k, s);
 }
 router.push(`${pathname}?${next.toString()}`);
 },
 [pathname, router]
 );

 const exportHref = (format: "csv" | "json") => {
 const q = new URLSearchParams(params.toString());
 q.set("section", section);
 q.set("format", format);
 return `/api/admin/affiliate/export?${q.toString()}`;
 };

 return (
 <form
 onSubmit={onSubmit}
 className="mb-6 rounded-lg border border-border bg-card p-4"
 aria-label="Affiliate filters"
 >
 <fieldset>
 <legend className="text-sm font-semibold text-[var(--ink-secondary)]">Filters</legend>
 <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
 <label className="text-xs text-[var(--ink-secondary)]">
 Operator
 <input
 name="operator"
 defaultValue={params.get("operator") ?? ""}
 className="mt-1 w-full min-h-10 rounded border border-border bg-[var(--surface-elevated)] px-2 text-sm text-foreground"
 placeholder="slug"
 />
 </label>
 <label className="text-xs text-[var(--ink-secondary)]">
 Country
 <input
 name="country"
 defaultValue={params.get("country") ?? ""}
 className="mt-1 w-full min-h-10 rounded border border-border bg-[var(--surface-elevated)] px-2 text-sm text-foreground"
 placeholder="e.g. GB"
 />
 </label>
 <label className="text-xs text-[var(--ink-secondary)]">
 Availability
 <select
 name="availability"
 defaultValue={params.get("availability") ?? ""}
 className="mt-1 w-full min-h-10 rounded border border-border bg-[var(--surface-elevated)] px-2 text-sm text-foreground"
 >
 <option value="">All</option>
 <option value="AVAILABLE">AVAILABLE</option>
 <option value="UNAVAILABLE">UNAVAILABLE</option>
 <option value="UNKNOWN">UNKNOWN</option>
 <option value="DISABLED">DISABLED</option>
 <option value="MISCONFIGURED">MISCONFIGURED</option>
 <option value="REVIEW_REQUIRED">REVIEW_REQUIRED</option>
 </select>
 </label>
 <label className="text-xs text-[var(--ink-secondary)]">
 Severity
 <select
 name="severity"
 defaultValue={params.get("severity") ?? ""}
 className="mt-1 w-full min-h-10 rounded border border-border bg-[var(--surface-elevated)] px-2 text-sm text-foreground"
 >
 <option value="">All</option>
 <option value="CRITICAL">CRITICAL</option>
 <option value="HIGH">HIGH</option>
 <option value="MEDIUM">MEDIUM</option>
 <option value="LOW">LOW</option>
 <option value="INFO">INFO</option>
 </select>
 </label>
 <label className="text-xs text-[var(--ink-secondary)] sm:col-span-2">
 Search
 <input
 name="q"
 defaultValue={params.get("q") ?? ""}
 className="mt-1 w-full min-h-10 rounded border border-border bg-[var(--surface-elevated)] px-2 text-sm text-foreground"
 placeholder="Operator, placement, issue"
 />
 </label>
 </div>
 </fieldset>
 <div className="mt-4 flex flex-wrap gap-2">
 <button
 type="submit"
 className="inline-flex min-h-10 items-center rounded-md bg-[var(--green-surface)] px-3 text-sm font-semibold text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400"
 >
 Apply filters
 </button>
 <a
 href={exportHref("csv")}
 className="inline-flex min-h-10 items-center rounded-md border border-border px-3 text-sm"
 >
 Export CSV
 </a>
 <a
 href={exportHref("json")}
 className="inline-flex min-h-10 items-center rounded-md border border-border px-3 text-sm"
 >
 Export JSON
 </a>
 </div>
 <p className="sr-only" role="status" aria-live="polite">
 Filters and exports available
 </p>
 </form>
 );
}

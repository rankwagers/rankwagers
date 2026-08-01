"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, type FormEvent } from "react";

export function AdminFilters({
 section,
}: {
 section: string;
}) {
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
 return `/api/admin/dashboard/export?${q.toString()}`;
 };

 return (
 <form
 onSubmit={onSubmit}
 className="mb-6 rounded-lg border border-border bg-card p-4"
 >
 <fieldset>
 <legend className="text-sm font-semibold text-[var(--ink-secondary)]">Filters</legend>
 <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
 <label className="text-xs text-[var(--ink-secondary)]">
 From
 <input
 name="from"
 type="date"
 defaultValue={params.get("from") ?? ""}
 className="mt-1 w-full min-h-10 rounded border border-border bg-[var(--surface-elevated)] px-2 text-sm text-foreground"
 />
 </label>
 <label className="text-xs text-[var(--ink-secondary)]">
 To
 <input
 name="to"
 type="date"
 defaultValue={params.get("to") ?? ""}
 className="mt-1 w-full min-h-10 rounded border border-border bg-[var(--surface-elevated)] px-2 text-sm text-foreground"
 />
 </label>
 <label className="text-xs text-[var(--ink-secondary)]">
 Competition / league
 <input
 name="competition"
 defaultValue={params.get("competition") ?? ""}
 className="mt-1 w-full min-h-10 rounded border border-border bg-[var(--surface-elevated)] px-2 text-sm text-foreground"
 placeholder="e.g. Premier"
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
 Season
 <input
 name="season"
 defaultValue={params.get("season") ?? ""}
 className="mt-1 w-full min-h-10 rounded border border-border bg-[var(--surface-elevated)] px-2 text-sm text-foreground"
 placeholder="Not in archives"
 title="Season is not a distinct archive field yet"
 />
 </label>
 <label className="text-xs text-[var(--ink-secondary)]">
 Market
 <select
 name="market"
 defaultValue={params.get("market") ?? ""}
 className="mt-1 w-full min-h-10 rounded border border-border bg-[var(--surface-elevated)] px-2 text-sm text-foreground"
 >
 <option value="">All supported</option>
 <option value="over15">Over 1.5</option>
 <option value="over25">Over 2.5</option>
 <option value="fh">First half</option>
 <option value="sh">Second half</option>
 </select>
 </label>
 <label className="text-xs text-[var(--ink-secondary)]">
 Prediction source
 <select
 name="predictionSource"
 defaultValue={params.get("predictionSource") ?? ""}
 className="mt-1 w-full min-h-10 rounded border border-border bg-[var(--surface-elevated)] px-2 text-sm text-foreground"
 >
 <option value="">Qualified lists</option>
 <option value="daily_lists">Daily lists</option>
 </select>
 </label>
 <label className="text-xs text-[var(--ink-secondary)]">
 Risk mode
 <select
 name="riskMode"
 defaultValue={params.get("riskMode") ?? ""}
 className="mt-1 w-full min-h-10 rounded border border-border bg-[var(--surface-elevated)] px-2 text-sm text-foreground"
 >
 <option value="">Any</option>
 <option value="conservative">Conservative</option>
 <option value="balanced">Balanced</option>
 <option value="aggressive">Aggressive</option>
 </select>
 </label>
 </div>
 </fieldset>
 <div className="mt-4 flex flex-wrap gap-2">
 <button
 type="submit"
 className="inline-flex min-h-10 items-center rounded-md bg-[var(--green-surface)] px-3 text-sm font-semibold text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
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
 </form>
 );
}

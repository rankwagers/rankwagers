"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, type FormEvent } from "react";

export function CalibrationFiltersBar({ section }: { section: string }) {
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
 [pathname, router],
 );

 const exportHref = (format: "csv" | "json") => {
 const q = new URLSearchParams(params.toString());
 q.set("section", section);
 q.set("format", format);
 return `/api/admin/calibration/export?${q.toString()}`;
 };

 return (
 <form
 onSubmit={onSubmit}
 className="mb-6 rounded-lg border border-border bg-card p-4"
 aria-label="Calibration filters"
 >
 <fieldset>
 <legend className="text-sm font-semibold text-[var(--ink-secondary)]">
 Active cohort filters
 </legend>
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
 Market
 <select
 name="market"
 defaultValue={params.get("market") ?? ""}
 className="mt-1 w-full min-h-10 rounded border border-border bg-[var(--surface-elevated)] px-2 text-sm text-foreground"
 >
 <option value="">All</option>
 <option value="over15">over15</option>
 <option value="over25">over25</option>
 <option value="fh">fh</option>
 <option value="sh">sh</option>
 </select>
 </label>
 <label className="text-xs text-[var(--ink-secondary)]">
 Competition
 <input
 name="competition"
 defaultValue={params.get("competition") ?? ""}
 className="mt-1 w-full min-h-10 rounded border border-border bg-[var(--surface-elevated)] px-2 text-sm text-foreground"
 placeholder="contains…"
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
 Search
 <input
 name="q"
 defaultValue={params.get("q") ?? ""}
 className="mt-1 w-full min-h-10 rounded border border-border bg-[var(--surface-elevated)] px-2 text-sm text-foreground"
 placeholder="team / id"
 />
 </label>
 </div>
 <div className="mt-4 flex flex-wrap gap-3">
 <button
 type="submit"
 className="min-h-10 rounded-md bg-[var(--amber-surface)] px-4 text-sm font-medium text-black hover:bg-[var(--amber-surface)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
 >
 Apply filters
 </button>
 <a
 href={exportHref("csv")}
 className="inline-flex min-h-10 items-center rounded-md border border-border px-3 text-sm hover:bg-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
 >
 Export CSV
 </a>
 <a
 href={exportHref("json")}
 className="inline-flex min-h-10 items-center rounded-md border border-border px-3 text-sm hover:bg-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
 >
 Export JSON
 </a>
 </div>
 </fieldset>
 <p className="mt-2 text-xs text-muted-foreground" role="status">
 Every result panel shows its active cohort definition. Hidden filtering is
 not used.
 </p>
 </form>
 );
}

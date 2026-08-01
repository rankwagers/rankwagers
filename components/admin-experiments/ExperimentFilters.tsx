"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, type FormEvent } from "react";

export function ExperimentFiltersBar({ section }: { section: string }) {
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
 return `/api/admin/experiments/export?${q.toString()}`;
 };

 return (
 <form
 onSubmit={onSubmit}
 className="mb-6 rounded-lg border border-border bg-card p-4"
 aria-label="Experiment filters"
 >
 <fieldset>
 <legend className="text-sm font-semibold text-[var(--ink-secondary)]">Filters</legend>
 <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
 <label className="text-xs text-[var(--ink-secondary)]">
 Status
 <select
 name="status"
 defaultValue={params.get("status") ?? ""}
 className="mt-1 w-full min-h-10 rounded border border-border bg-[var(--surface-elevated)] px-2 text-sm text-foreground"
 >
 <option value="">All</option>
 <option value="DRAFT">DRAFT</option>
 <option value="READY_FOR_REVIEW">READY_FOR_REVIEW</option>
 <option value="APPROVED">APPROVED</option>
 <option value="RUNNING">RUNNING</option>
 <option value="PAUSED">PAUSED</option>
 <option value="COMPLETED">COMPLETED</option>
 <option value="INVALIDATED">INVALIDATED</option>
 </select>
 </label>
 <label className="text-xs text-[var(--ink-secondary)]">
 Environment
 <select
 name="environment"
 defaultValue={params.get("environment") ?? ""}
 className="mt-1 w-full min-h-10 rounded border border-border bg-[var(--surface-elevated)] px-2 text-sm text-foreground"
 >
 <option value="">All</option>
 <option value="LOCAL">LOCAL</option>
 <option value="TEST">TEST</option>
 <option value="STAGING">STAGING</option>
 <option value="PRODUCTION">PRODUCTION</option>
 </select>
 </label>
 <label className="text-xs text-[var(--ink-secondary)]">
 Search
 <input
 name="q"
 defaultValue={params.get("q") ?? ""}
 className="mt-1 w-full min-h-10 rounded border border-border bg-[var(--surface-elevated)] px-2 text-sm text-foreground"
 placeholder="id / name"
 />
 </label>
 </div>
 <div className="mt-4 flex flex-wrap gap-3">
 <button
 type="submit"
 className="min-h-10 rounded-md bg-[var(--info-surface)] px-4 text-sm font-medium text-black hover:bg-[var(--info-surface)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
 >
 Apply filters
 </button>
 <a
 href={exportHref("csv")}
 className="inline-flex min-h-10 items-center rounded-md border border-border px-3 text-sm hover:bg-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
 >
 Export CSV
 </a>
 <a
 href={exportHref("json")}
 className="inline-flex min-h-10 items-center rounded-md border border-border px-3 text-sm hover:bg-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
 >
 Export JSON
 </a>
 </div>
 </fieldset>
 <p className="mt-2 text-xs text-[var(--amber-primary)]" role="status">
 LOCAL/TEST DATA — NOT REAL USER EVIDENCE
 </p>
 </form>
 );
}

"use client";

import type { ChartPoint } from "@/lib/admin-dashboard";
import { chartBarPct, maxChartValue } from "@/lib/admin-dashboard";

export function SimpleBars({
 title,
 points,
 emptyLabel = "No data",
}: {
 title: string;
 points: ChartPoint[];
 emptyLabel?: string;
}) {
 const max = maxChartValue(points);
 const visible = points.filter((p) => p.value != null).slice(-21);
 return (
 <section
 aria-label={title}
 className="rounded-lg border border-border bg-card p-4"
 >
 <h2 className="text-sm font-semibold uppercase tracking-label text-[var(--ink-secondary)]">
 {title}
 </h2>
 {!visible.length ? (
 <p className="mt-3 text-sm text-muted-foreground">{emptyLabel}</p>
 ) : (
 <ul className="mt-4 space-y-2">
 {visible.map((p) => (
 <li key={p.label} className="grid grid-cols-[5rem_1fr_3rem] items-center gap-2 text-xs">
 <span className="truncate text-[var(--ink-secondary)]">{p.label}</span>
 <div className="h-2 overflow-hidden rounded bg-card">
 <div
 className="h-full rounded bg-[var(--green-surface)] motion-reduce:transition-none"
 style={{ width: `${chartBarPct(p.value, max)}%` }}
 />
 </div>
 <span className="text-right tabular-nums text-[var(--ink-secondary)]">
 {p.value == null ? "—" : p.value}
 </span>
 </li>
 ))}
 </ul>
 )}
 </section>
 );
}

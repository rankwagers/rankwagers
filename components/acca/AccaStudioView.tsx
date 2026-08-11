"use client";

import Link from "next/link";
import { AccaPanelBody } from "./AccaPanelBody";
import type { PredictionStrings } from "@/lib/translations/predictionsEn";
import { useAcca } from "./AccaProvider";

export function AccaStudioView({ locale, p }: { locale: string; p: PredictionStrings }) {
 const { setPanelOpen } = useAcca();

 return (
 <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_400px]">
 <section aria-labelledby="acca-how-heading" className="space-y-4">
 <h2 id="acca-how-heading" className="rw-display text-xl font-semibold">
 How to build
 </h2>
 <ol className="list-decimal space-y-2 pl-5 text-sm text-[var(--ink-secondary)]">
 <li>Add from homepage top picks, fixture explorer, or match prediction panels.</li>
 <li>
 Or generate ranked combinations in the{" "}
 <Link
 href={`/${locale}/acca/builder`}
 className="text-[var(--hero-ink)] hover:underline"
 >
 Acca Builder
 </Link>
 , then merge or replace into this Studio.
 </li>
 <li>One market per fixture — conflicts are blocked automatically.</li>
 <li>Set a unit stake to see potential return (currency-neutral).</li>
 <li>Compare operators and continue via server-signed affiliate links.</li>
 <li>Copy, Telegram-export, or share a noindex restore URL.</li>
 </ol>
 <div className="rounded-lg border border-border bg-[var(--canvas-secondary)] px-4 py-3 text-sm">
 <p className="font-semibold text-foreground">Supported markets</p>
 <p className="mt-1 text-[var(--ink-secondary)]">
 Over 1.5, Over 2.5, BTTS, First/Second half over 0.5, and Match Winner when published
 on the match page with odds. Unsupported markets are never exposed.
 </p>
 </div>
 <div className="flex flex-wrap gap-2">
 <Link
 href={`/${locale}/acca/builder`}
 className="inline-flex min-h-11 items-center rounded-md border border-brand/35 bg-[var(--green-surface)] px-4 text-sm font-semibold text-[var(--hero-ink)]"
 >
 Open Acca Builder
 </Link>
 <button
 type="button"
 className="rw-m inline-flex items-center justify-center border border-[var(--hero-ink)] px-4 text-[var(--hero-ink)] transition-colors hover:bg-[var(--hero-ink)] hover:text-[var(--hero-canvas)] min-h-11 lg:hidden"
 onClick={() => setPanelOpen(true)}
 >
 Open Acca panel
 </button>
 </div>
 </section>

 <div className="rounded-xl border border-border bg-[var(--canvas)] p-4 shadow-card">
 <AccaPanelBody locale={locale} p={p} />
 </div>
 </div>
 );
}

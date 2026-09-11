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
 <h2 id="acca-how-heading" className="rw3-title">
 How to build
 </h2>
 <ol className="list-decimal space-y-2 pl-5 text-[13px]" style={{ color: "var(--muted)" }}>
 <li>Add from homepage top picks, fixture explorer, or match prediction panels.</li>
 <li>
 Or generate ranked combinations in the{" "}
 <Link
 href={`/${locale}/acca/builder`}
 className="hover:underline"
 style={{ color: "var(--text)", fontWeight: 500 }}
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
 <div
 className="px-4 py-3 text-[13px]"
 style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 6 }}
 >
 <p className="font-semibold">Supported markets</p>
 <p className="mt-1" style={{ color: "var(--muted)" }}>
 Over 1.5, Over 2.5, BTTS, First/Second half over 0.5, and Match Winner when published
 on the match page with odds. Unsupported markets are never exposed.
 </p>
 </div>
 <div className="flex flex-wrap gap-2">
 <Link href={`/${locale}/acca/builder`} className="rw3-ghost min-h-11">
 Open Acca Builder
 </Link>
 <button
 type="button"
 className="rw3-ghost min-h-11 lg:hidden"
 onClick={() => setPanelOpen(true)}
 >
 Open Acca panel
 </button>
 </div>
 </section>

 <div
 className="p-4"
 style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 6 }}
 >
 <AccaPanelBody locale={locale} p={p} />
 </div>
 </div>
 );
}

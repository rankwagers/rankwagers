"use client";

import type { PublicOperatorMatch } from "@/lib/combo/apiTypes";
import { ComboOperatorCard } from "./ComboOperatorCard";

export function ComboOperatorComparison({
 open,
 operators,
 locale,
 onClose,
 onOperatorClick,
}: {
 open: boolean;
 operators: PublicOperatorMatch[];
 locale: string;
 onClose: () => void;
 onOperatorClick: (op: PublicOperatorMatch) => void;
}) {
 if (!open) return null;

 return (
 <div
 className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
 role="dialog"
 aria-modal="true"
 aria-labelledby="operator-compare-title"
 >
 <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-lg border border-border bg-[var(--canvas)] p-4 shadow-elevated">
 <div className="flex items-center justify-between gap-3">
 <h2 id="operator-compare-title" className="font-display text-xl font-semibold">
 Compare operators
 </h2>
 <button
 type="button"
 onClick={onClose}
 className="min-h-12 min-w-12 rounded-md border border-border px-3 text-sm font-semibold"
 >
 Close
 </button>
 </div>
 <div className="mt-4 hidden overflow-x-auto md:block">
 <table className="w-full min-w-[640px] text-left text-sm">
 <thead>
 <tr className="border-b border-border text-metadata uppercase text-muted-foreground">
 <th scope="col" className="py-2 pr-3">Operator</th>
 <th scope="col" className="py-2 pr-3">Eligibility</th>
 <th scope="col" className="py-2 pr-3">Availability</th>
 <th scope="col" className="py-2 pr-3">Selections</th>
 <th scope="col" className="py-2 pr-3">Deep link</th>
 <th scope="col" className="py-2">CTA</th>
 </tr>
 </thead>
 <tbody>
 {operators.map((op) => (
 <tr key={op.slug} className="border-b border-border/70">
 <td className="py-3 pr-3 font-medium">{op.displayName}</td>
 <td className="py-3 pr-3">
 {op.countryEligible ? "Eligible" : "Not eligible"}
 </td>
 <td className="py-3 pr-3 capitalize">{op.availability}</td>
 <td className="py-3 pr-3 font-mono">
 {op.availableSelectionCount}/{op.totalSelections}
 </td>
 <td className="py-3 pr-3">{op.deeplinkType.replace(/_/g, " ")}</td>
 <td className="py-3">
 {op.outboundPath && op.deeplinkType !== "unavailable" ? (
 <a
 href={op.outboundPath}
 onClick={() => onOperatorClick(op)}
 className="font-semibold text-brand"
 rel="nofollow sponsored"
 >
 Open
 </a>
 ) : (
 "—"
 )}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 <div className="mt-4 space-y-3 md:hidden">
 {operators.map((op) => (
 <ComboOperatorCard
 key={op.slug}
 operator={op}
 locale={locale}
 onView={() => {}}
 onCta={() => onOperatorClick(op)}
 />
 ))}
 </div>
 </div>
 </div>
 );
}

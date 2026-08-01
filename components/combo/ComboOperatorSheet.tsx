"use client";

import { useEffect, useRef } from "react";
import type { PublicOperatorMatch } from "@/lib/combo/apiTypes";
import { ComboOperatorCard } from "./ComboOperatorCard";

export function ComboOperatorSheet({
 open,
 operators,
 locale,
 onClose,
 onOperatorClick,
 onCompare,
}: {
 open: boolean;
 operators: PublicOperatorMatch[];
 locale: string;
 onClose: () => void;
 onOperatorClick: (op: PublicOperatorMatch) => void;
 onCompare: () => void;
}) {
 const closeRef = useRef<HTMLButtonElement>(null);
 const previousFocus = useRef<HTMLElement | null>(null);

 const panelRef = useRef<HTMLDivElement>(null);

 useEffect(() => {
 if (!open) return;
 previousFocus.current = document.activeElement as HTMLElement | null;
 closeRef.current?.focus();
 const onKey = (e: KeyboardEvent) => {
 if (e.key === "Escape") {
 onClose();
 return;
 }
 if (e.key !== "Tab" || !panelRef.current) return;
 const focusable = panelRef.current.querySelectorAll<HTMLElement>(
 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
 );
 if (!focusable.length) return;
 const first = focusable[0];
 const last = focusable[focusable.length - 1];
 if (e.shiftKey && document.activeElement === first) {
 e.preventDefault();
 last.focus();
 } else if (!e.shiftKey && document.activeElement === last) {
 e.preventDefault();
 first.focus();
 }
 };
 window.addEventListener("keydown", onKey);
 return () => {
 window.removeEventListener("keydown", onKey);
 previousFocus.current?.focus();
 };
 }, [open, onClose]);

 if (!open) return null;

 const top = operators.filter((op) => op.countryEligible).slice(0, 3);

 return (
 <div
 className="fixed inset-0 z-50 flex items-end bg-[var(--backdrop)] md:hidden"
 role="dialog"
 aria-modal="true"
 aria-labelledby="operator-sheet-title"
 onMouseDown={(e) => {
 if (e.target === e.currentTarget) onClose();
 }}
 >
 <div
 ref={panelRef}
 className="sheet-enter max-h-[85vh] w-full overflow-auto rounded-t-[var(--radius-xl)] border border-border bg-[var(--canvas-secondary)] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-elevated"
 >
 <div className="mb-3 flex items-center justify-between">
 <h2 id="operator-sheet-title" className="font-display text-lg font-semibold">
 Operators
 </h2>
 <button
 ref={closeRef}
 type="button"
 onClick={onClose}
 className="min-h-12 min-w-12 rounded-md border border-border px-3 text-sm font-semibold"
 >
 Close
 </button>
 </div>
 <div className="space-y-3">
 {top.map((op) => (
 <ComboOperatorCard
 key={op.slug}
 operator={op}
 locale={locale}
 onView={() => {}}
 onCta={() => onOperatorClick(op)}
 />
 ))}
 </div>
 <button
 type="button"
 onClick={onCompare}
 className="mt-4 min-h-12 w-full rounded-md border border-border px-4 py-2 text-sm font-semibold"
 >
 Compare all operators
 </button>
 </div>
 </div>
 );
}

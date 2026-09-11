"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { trapTabKey } from "@/lib/ui/focusTrap";
import { Icon } from "@/components/v3/Icon";

/**
 * Accessible mobile bottom sheet — shared by Acca / future drawers.
 * Motion uses CSS; prefers-reduced-motion is handled in globals.css.
 */
export function BottomSheet({
 open,
 titleId,
 onClose,
 children,
}: {
 open: boolean;
 titleId: string;
 onClose: () => void;
 children: ReactNode;
}) {
 const panelRef = useRef<HTMLDivElement>(null);
 const closeRef = useRef<HTMLButtonElement>(null);
 const previousFocus = useRef<HTMLElement | null>(null);

 useEffect(() => {
 if (!open) return;
 previousFocus.current = document.activeElement as HTMLElement | null;
 closeRef.current?.focus();
 const prevOverflow = document.body.style.overflow;
 document.body.style.overflow = "hidden";

 const onKey = (e: KeyboardEvent) => {
 if (e.key === "Escape") {
 onClose();
 return;
 }
 if (panelRef.current) trapTabKey(e, panelRef.current);
 };
 window.addEventListener("keydown", onKey);
 return () => {
 window.removeEventListener("keydown", onKey);
 document.body.style.overflow = prevOverflow;
 previousFocus.current?.focus();
 };
 }, [open, onClose]);

 if (!open) return null;

 return (
 <div
 className="fixed inset-0 z-50 flex items-end bg-[var(--backdrop)] lg:hidden"
 role="dialog"
 aria-modal="true"
 aria-labelledby={titleId}
 onMouseDown={(e) => {
 if (e.target === e.currentTarget) onClose();
 }}
 >
 {/* Bible V3: no shadows, ever — the sheet separates with a `--line`
 border on `--surface`, radius 6 inline. */}
 <div
 ref={panelRef}
 className="sheet-enter relative max-h-[90vh] w-full overflow-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
 style={{
 border: "1px solid var(--line)",
 background: "var(--surface)",
 borderTopLeftRadius: 6,
 borderTopRightRadius: 6,
 }}
 >
 <div className="mb-3 flex items-center justify-between">
 <div
 className="mx-auto h-1 w-10"
 style={{ background: "var(--line)", borderRadius: 9999 }}
 aria-hidden
 />
 <button
 ref={closeRef}
 type="button"
 onClick={onClose}
 className="rw3-hoverable absolute right-3 top-3 inline-flex min-h-10 min-w-10 items-center justify-center border border-[var(--line)] text-[13px]"
 style={{ borderRadius: 6, color: "var(--muted)" }}
 aria-label="Close panel"
 >
 <Icon name="close" size={16} />
 </button>
 </div>
 {children}
 </div>
 </div>
 );
}

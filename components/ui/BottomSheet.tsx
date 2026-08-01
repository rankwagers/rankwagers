"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { trapTabKey } from "@/lib/ui/focusTrap";
import { X } from "lucide-react";

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
 <div
 ref={panelRef}
 className="sheet-enter relative max-h-[90vh] w-full overflow-auto rounded-t-[var(--radius-xl)] border border-border bg-[var(--canvas-secondary)] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-elevated"
 >
 <div className="mb-3 flex items-center justify-between">
 <div
 className="mx-auto h-1 w-10 rounded-full bg-[var(--border-strong)]"
 aria-hidden
 />
 <button
 ref={closeRef}
 type="button"
 onClick={onClose}
 className="absolute right-3 top-3 inline-flex min-h-10 min-w-10 items-center justify-center rounded-md border border-border text-sm text-muted-foreground transition-colors hover:bg-[var(--canvas-primary)] hover:text-foreground"
 aria-label="Close panel"
 >
 <X className="h-4 w-4" aria-hidden />
 </button>
 </div>
 {children}
 </div>
 </div>
 );
}

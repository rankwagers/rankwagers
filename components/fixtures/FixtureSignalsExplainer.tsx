"use client";

import { useEffect, useId, useRef, useState } from "react";

/**
 * The ⓘ beside the supporting signals — the homepage explainer's pattern, carrying the honest
 * ranking statement. Activates on click, tap or keyboard, never hover-only; Escape dismisses and
 * returns focus. The panel enters on the shared `.rw-explain` rise, which reduced motion strips
 * by name.
 */
export function FixtureSignalsExplainer({ label, body }: { label: string; body: string }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <span className="inline-flex items-start gap-2.5">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
        className={`rw-m inline-grid h-[18px] w-[18px] shrink-0 place-items-center border border-[var(--hero-ink)] font-bold leading-none transition-colors duration-[var(--dur-respond)] ease-[var(--ease-settle)] ${
          open
            ? "bg-[var(--hero-ink)] text-[var(--hero-canvas)]"
            : "text-[var(--hero-ink)] hover:bg-[var(--hero-ink)] hover:text-[var(--hero-canvas)] active:bg-[var(--hero-ink)] active:text-[var(--hero-canvas)]"
        }`}
      >
        i
      </button>
      {open ? (
        <span
          id={panelId}
          className="rw-explain block max-w-[52ch] border-l-2 border-[var(--hero-line)] pl-4 text-[13px] leading-relaxed text-[var(--hero-ink-2)]"
        >
          {body}
        </span>
      ) : (
        <span id={panelId} hidden />
      )}
    </span>
  );
}

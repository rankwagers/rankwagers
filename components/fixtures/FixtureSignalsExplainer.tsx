"use client";

import { useEffect, useId, useRef, useState } from "react";

/**
 * The ⓘ beside the supporting signals — the homepage explainer's pattern, carrying the honest
 * ranking statement. Activates on click, tap or keyboard, never hover-only; Escape dismisses and
 * returns focus. The panel appears without motion (Bible V3: motion explains a state change the
 * hover/press grammar already covers; a text reveal earns none).
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
        className="rw3-ghost inline-grid h-[18px] w-[18px] shrink-0 place-items-center font-bold leading-none"
        style={{
          padding: 0,
          fontSize: 11,
          ...(open
            ? { background: "var(--accent)", borderColor: "var(--accent)", color: "var(--accent-ink)" }
            : undefined),
        }}
      >
        i
      </button>
      {open ? (
        <span
          id={panelId}
          className="block max-w-[52ch] pl-4 text-[13px] leading-relaxed"
          style={{ borderLeft: "2px solid var(--line)", color: "var(--muted)" }}
        >
          {body}
        </span>
      ) : (
        <span id={panelId} hidden />
      )}
    </span>
  );
}

"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import type { RankedWhy } from "@/lib/homepage/rankedWhy";

/* ============================================================================
   THE ⓘ EXPLAINER — the map's info square beside the ranked numeral
   ----------------------------------------------------------------------------
   A small ink-bordered square "i" that ACTIVATES — click, tap or keyboard,
   never hover-only, because a hover explainer does not exist on the devices
   most readers hold. It toggles the Why panel: the map's quiet inset (2px
   left rule on a faint wash), carrying the sentence `rankedWhy.ts` built from
   this card's own venue facts, the bound, and the link out to the full
   research.

   Dismiss is symmetric: second activation, or Escape. `aria-expanded` and
   `aria-controls` wire the state; the panel enters on the shared rise and
   `prefers-reduced-motion` strips that by name (globals: `.rw-explain`), so
   the reveal still happens — instantly — for readers who asked for stillness.
   ========================================================================== */

export function RankedExplainer({
  why,
  href,
  linkLabel,
}: {
  why: RankedWhy;
  href: string;
  linkLabel: string;
}) {
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
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={why.title}
        onClick={() => setOpen((v) => !v)}
        className={`rw-m mt-0.5 inline-grid h-[18px] w-[18px] shrink-0 place-items-center border border-[var(--hero-ink)] font-bold leading-none transition-colors duration-[var(--dur-respond)] ease-[var(--ease-settle)] ${
          open
            ? "bg-[var(--hero-ink)] text-[var(--hero-canvas)]"
            : "text-[var(--hero-ink)] hover:bg-[var(--hero-ink)] hover:text-[var(--hero-canvas)]"
        }`}
      >
        i
      </button>

      {open ? (
        <div
          id={panelId}
          className="rw-explain rw-m mt-2.5 border-l-2 border-[var(--hero-ink)] bg-[rgb(32_30_29_/_0.04)] px-3 py-2.5 normal-case leading-[1.7] tracking-[0.04em] text-[var(--hero-ink-2)]"
        >
          <span className="font-bold text-[var(--hero-ink)]">{why.title}</span>{" "}
          {why.venueSentence ? <>{why.venueSentence} </> : null}
          {why.bound}{" "}
          {why.more}{" "}
          <Link href={href} className="font-bold text-[var(--hero-ink)]">
            {linkLabel} →
          </Link>
        </div>
      ) : null}
    </>
  );
}

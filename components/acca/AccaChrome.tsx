"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AccaProvider, useAcca } from "./AccaProvider";
import { AccaPanelBody } from "./AccaPanelBody";
import type { PredictionStrings } from "@/lib/translations/predictionsEn";
import { BottomSheet } from "@/components/ui/BottomSheet";

/**
 * The settled-record figures on the homepage. Nothing fixed may sit over them. This is the `<dl>`
 * of stat cards, not the enclosing `#verified-performance` section — that section also carries
 * recent-results and measures ~2260px at 390 wide, so yielding to it would blank the launcher for
 * most of the page rather than for the figures it must not cover.
 */
const PROOF_BAND_ID = "verified-performance-figures";

function AccaLauncher() {
 const { slip, panelOpen, setPanelOpen, ready, named } = useAcca();
 const count = slip.selections.length;
 const pillRef = useRef<HTMLButtonElement>(null);
 const [coversProofBand, setCoversProofBand] = useState(false);

 useEffect(() => {
  /*
   * Rect intersection rather than IntersectionObserver: what matters is whether the pill's own
   * corner footprint overlaps the band, not whether the band is anywhere in the viewport, and IO
   * reports the latter. Reads are rAF-throttled and happen on a passive scroll listener, so this
   * is one getBoundingClientRect pair per painted frame while scrolling and nothing at rest.
   * On every route but the homepage the band is absent, so this resolves to false and stays there.
   */
  let frame = 0;
  const measure = () => {
   frame = 0;
   /*
    * Resolved per measurement, never captured once. The homepage currently fails hydration
    * (React #418/#423, pre-existing and unrelated), and on that path React discards the server
    * DOM and rebuilds it — a node looked up at effect time is then detached, and a detached
    * node's rect is all zeros, which reads as "no overlap" forever. getElementById per frame is
    * a hash lookup and costs nothing next to the two rect reads it guards.
    */
   const band = document.getElementById(PROOF_BAND_ID);
   const pill = pillRef.current?.getBoundingClientRect();
   if (!band || !pill || pill.width === 0) {
    setCoversProofBand(false);
    return;
   }
   const b = band.getBoundingClientRect();
   setCoversProofBand(
    pill.left < b.right && pill.right > b.left && pill.top < b.bottom && pill.bottom > b.top,
   );
  };
  const schedule = () => {
   if (!frame) frame = window.requestAnimationFrame(measure);
  };
  measure();
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  /*
   * Scroll and resize alone left a stale result at rest. The homepage still shifts after mount
   * (Lighthouse reports CLS 0.338 on desktop), so the band can slide under a launcher that
   * measured clear a moment earlier and nothing would re-run the check — reproduced as a 98x31px
   * overlap of WON at 390x844, scrollY=0. Observing the body catches those reflows; `load` covers
   * late images that finish after the observer is wired.
   */
  const observer =
   typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
  observer?.observe(document.body);
  window.addEventListener("load", schedule);
  return () => {
   window.removeEventListener("scroll", schedule);
   window.removeEventListener("resize", schedule);
   window.removeEventListener("load", schedule);
   observer?.disconnect();
   if (frame) window.cancelAnimationFrame(frame);
  };
 }, [ready, count, named.length]);
 /*
  * The launcher is fixed to the bottom-right corner at z-40, so whatever sits in that corner is
  * covered. On a first visit — empty slip, nothing saved — it was covering the WON figure of the
  * homepage proof band outright at 390x844 (measured: a full 98x48px occlusion at scroll 0), which
  * put an empty workspace button on top of the settled record the page exists to show.
  *
  * It now appears once there is something to launch into: selections in the slip, or saved named
  * Accas the panel would list. Both conditions are checked because the panel body renders saved
  * Accas independently of the current slip, so slip-emptiness alone would strand a returning user
  * who had saved combinations but not yet re-picked any.
  *
  * That covered the first visit only. Once a selection exists — the ordinary case — the launcher
  * mounts and, being fixed, passes over the proof band again on scroll: re-measured at 98x48px of
  * the WON card at 390x844, 360x780 and 414x896. Emptiness was never the real condition; sitting
  * over the settled record was. So it also yields whenever its own footprint intersects the band,
  * which is the same rule the empty-slip check was reaching for, applied to every scroll position.
  */
 if (!ready) return null;
 if (count === 0 && named.length === 0) return null;
 return (
 <button
 ref={pillRef}
 type="button"
 /*
  * Yielding is opacity, not unmounting: the element keeps its box, so the effect above can go on
  * measuring it and cannot oscillate between hidden (rect collapses -> no overlap -> show) and
  * shown. `pointer-events-none` plus `aria-hidden`/`tabIndex=-1` take it out of pointer, screen
  * reader and keyboard reach together, so nothing invisible stays focusable.
  */
 className={`rw-hero fixed bottom-4 right-4 z-40 inline-flex min-h-12 items-center justify-center gap-1.5 rounded-full border border-[var(--hero-ink)] bg-[var(--hero-canvas)] px-4 text-sm font-semibold text-[var(--hero-ink)] shadow-elevated transition-opacity duration-fast hover:bg-[var(--hero-ink)] hover:text-[var(--hero-canvas)] lg:bottom-6 lg:right-6 ${
 coversProofBand ? "pointer-events-none opacity-0" : ""
 }`}
 aria-hidden={coversProofBand || undefined}
 tabIndex={coversProofBand ? -1 : undefined}
 aria-haspopup="dialog"
 aria-expanded={panelOpen}
 aria-controls="acca-workspace"
 onClick={() => setPanelOpen(!panelOpen)}
 >
 Acca
 <span
 className="inline-flex min-h-6 min-w-6 items-center justify-center rounded-full border border-[var(--hero-line)] px-1.5 font-mono text-xs"
 aria-label={`${count} selections`}
 >
 {count}
 </span>
 </button>
 );
}

function AccaDesktopPanel({ locale, p }: { locale: string; p: PredictionStrings }) {
 const { panelOpen, setPanelOpen } = useAcca();
 if (!panelOpen) return null;
 return (
 <aside
 id="acca-workspace"
 className="rw-hero panel-enter fixed bottom-0 right-0 top-14 z-40 hidden w-[min(100vw,380px)] overflow-y-auto border-l border-[var(--hero-line)] bg-[var(--hero-canvas)] p-4 shadow-elevated lg:block"
 aria-labelledby="acca-panel-title"
 role="complementary"
 >
 <AccaPanelBody locale={locale} p={p} onClose={() => setPanelOpen(false)} />
 </aside>
 );
}

function AccaMobileSheet({ locale, p }: { locale: string; p: PredictionStrings }) {
 const { panelOpen, setPanelOpen } = useAcca();
 return (
 <BottomSheet
 open={panelOpen}
 titleId="acca-panel-title"
 onClose={() => setPanelOpen(false)}
 >
 <div id="acca-workspace" className="rw-hero">
 <AccaPanelBody locale={locale} p={p} onClose={() => setPanelOpen(false)} />
 </div>
 </BottomSheet>
 );
}

function AccaShell({
 locale,
 p,
 children,
}: {
 locale: string;
 p: PredictionStrings;
 children: ReactNode;
}) {
 return (
 <>
 {children}
 <AccaLauncher />
 <AccaDesktopPanel locale={locale} p={p} />
 <AccaMobileSheet locale={locale} p={p} />
 </>
 );
}

/** Wraps locale tree so Add-to-Acca works on every page. */
export function AccaWorkspace({
 locale,
 p,
 children,
}: {
 locale: string;
 p: PredictionStrings;
 children: ReactNode;
}) {
 return (
 <AccaProvider locale={locale}>
 <AccaShell locale={locale} p={p}>{children}</AccaShell>
 </AccaProvider>
 );
}

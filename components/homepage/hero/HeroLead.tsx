"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import type { RateWithSample, VenueRates } from "@/lib/fixtures/evidenceView";
import type { HeroPick } from "@/lib/homepage/types";
import { SectionTrackLink } from "@/components/analytics/SectionTrackLink";
import { Crest } from "./Crest";
import { prefersReducedMotion } from "./motion";
import { splitRate } from "./heroModel";

/* ============================================================================
   THE LEAD — rebrand v2, per docs/design/motion-language-v2.md
   ----------------------------------------------------------------------------
   One enormous numeral with its market set beneath it, never separated. A figure
   alone is not a claim anyone can check: 148px of "82" says nothing until the
   line under it says what happened 82% of the time.

   THE NUMERAL IS THE PROVIDER POTENTIAL. It carries no sample, and the doc is
   explicit that this must be stated rather than implied — so the qualifier sits
   with it. The venue lines below are the figures that DO carry samples, and each
   states its own.

   NOTHING RAMPS. The numeral appears at its true value. A 0-to-82 count-up
   renders numbers the pipeline never observed (§3.2), and rule 5 governs a live
   reading moving to a new value, not a figure arriving for the first time.
   ========================================================================== */

const LINE_MS = 1100;
const STAGGER_MS = 140;

/**
 * A venue line: a rule drawn proportionally FROM ZERO, with its rate and sample beneath.
 *
 * `scaleX` on a fixed-width track, not an animated `width`. The track holds its full box from the
 * first frame, so a line that has not yet drawn costs no layout shift — the transform is the only
 * thing that moves.
 */
function VenueLine({
  label,
  rate,
  index,
  drawn,
}: {
  label: string;
  rate: RateWithSample;
  index: number;
  drawn: boolean;
}) {
  const { rate: value, sample } = splitRate(rate.display);
  const pct = Number.parseFloat(value);
  const proportion = Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) / 100 : 0;

  return (
    <div>
      <p className="rw-m text-[var(--hero-ink-2)]">{label}</p>
      <div
        className="mt-2 h-[2px] w-full origin-left bg-[var(--hero-line-2)]"
        aria-hidden
      >
        <div
          className="h-full origin-left bg-[var(--hero-ink)]"
          style={
            {
              width: `${proportion * 100}%`,
              transform: drawn ? "scaleX(1)" : "scaleX(0)",
              transition: `transform ${LINE_MS}ms cubic-bezier(.16,1,.3,1)`,
              transitionDelay: `${index * STAGGER_MS}ms`,
            } as CSSProperties
          }
        />
      </div>
      <p className="mt-2.5 flex flex-wrap items-baseline gap-x-2">
        <span className="rw-h rw-tnum text-[20px] text-[var(--hero-ink)]">{value}</span>
        {/* The sample never leaves the rate. */}
        {sample ? <span className="rw-m rw-tnum text-[var(--hero-ink-2)]">{sample}</span> : null}
      </p>
    </div>
  );
}

export function HeroLead({
  pick,
  rates,
  locale,
  copy,
}: {
  pick: HeroPick;
  rates: VenueRates | null;
  locale: string;
  copy: {
    /** The approved qualifier for the provider figure. Travels with it, always. */
    probabilityNote: string;
    venueHome: string;
    venueAway: string;
    venueLeague: string;
    openResearch: string;
  };
}) {
  const [drawn, setDrawn] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  const lines = [
    { label: copy.venueHome, rate: rates?.home ?? null },
    { label: copy.venueAway, rate: rates?.away ?? null },
    { label: copy.venueLeague, rate: rates?.league ?? null },
  ].filter((l): l is { label: string; rate: RateWithSample } => l.rate !== null);

  /*
   * EMPTY STATE, per the doc: with no venue samples the numeral and its market still render and
   * the lines block is OMITTED ENTIRELY. No skeleton, no zero-height placeholder, no dashes —
   * the absence is the design, and a row of empty rules would imply data we do not have.
   */
  const hasLines = lines.length > 0;

  useEffect(() => {
    if (!hasLines) return;
    if (prefersReducedMotion()) {
      setDrawn(true);
      return;
    }
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setDrawn(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setDrawn(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2, rootMargin: "0px 0px -4% 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasLines]);

  return (
    <div ref={ref} className="rw-lead group">
      <SectionTrackLink
        href={pick.matchHref}
        locale={locale}
        section="hero"
        className="block outline-none"
        aria-label={copy.openResearch
          .replaceAll("{home}", pick.home)
          .replaceAll("{away}", pick.away)}
      >
        {/* Crests: real, 36px, bare — no plate, no ring. They part on hover. */}
        <div className="flex items-center gap-3">
          <Crest src={pick.homeImage} name={pick.home} size={36} />
          <span
            className="block transition-[margin] duration-[520ms] ease-[cubic-bezier(.16,1,.3,1)] group-hover:ml-1"
            style={{ marginLeft: 0 }}
          >
            <Crest src={pick.awayImage} name={pick.away} size={36} />
          </span>
          <p className="rw-m ml-1 text-[var(--hero-ink-2)]">
            {pick.home} v {pick.away}
          </p>
        </div>

        {/* THE NUMERAL AND ITS MARKET — one block, never separated. */}
        <p className="rw-lead-numeral mt-6 text-[var(--hero-ink)] transition-colors duration-[520ms] ease-[cubic-bezier(.16,1,.3,1)]">
          {pick.probability}
          <span className="rw-h align-top text-[46px]">%</span>
        </p>
        <p className="rw-h mt-1 text-[34px] text-[var(--hero-ink)]">{pick.market}</p>
        <p className="rw-m mt-3 max-w-[52ch] normal-case tracking-normal text-[var(--hero-ink-2)]">
          {copy.probabilityNote}
        </p>

        {/* The rule extends on hover. */}
        <span
          aria-hidden
          className="mt-6 block h-[1.5px] w-16 origin-left bg-[var(--hero-ink)] transition-transform duration-[520ms] ease-[cubic-bezier(.16,1,.3,1)] group-hover:scale-x-[2.4]"
        />
      </SectionTrackLink>

      {hasLines ? (
        <div className="mt-8 grid gap-x-8 gap-y-6 sm:grid-cols-3">
          {lines.map((line, i) => (
            <VenueLine
              key={line.label}
              label={line.label}
              rate={line.rate}
              index={i}
              drawn={drawn}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

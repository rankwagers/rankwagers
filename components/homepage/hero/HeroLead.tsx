"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import type { RateWithSample, VenueRates } from "@/lib/fixtures/evidenceView";
import type { HeroPick } from "@/lib/homepage/types";
import { SectionTrackLink } from "@/components/analytics/SectionTrackLink";
import { Crest } from "./Crest";
import { prefersReducedMotion } from "./motion";
import { fill, splitRate } from "./heroModel";

/* ============================================================================
   THE LEAD — replicated from the map
   ----------------------------------------------------------------------------
   Two rows and a button:

     row 1   crests · fixture name in the HEADING face · mono meta
     row 2   the numeral on the left; three VERTICAL venue tracks beside it
     close   OPEN MATCH RESEARCH → , bordered mono, bottom right

   THE TRACKS ARE VERTICAL, AND THAT IS THE POINT. Three bars of different
   heights standing on one baseline can be compared at a glance; three
   horizontal rules stacked down the page cannot, because the eye has to carry
   each length to the next line. The middle track is the PROVIDER POTENTIAL —
   the figure the numeral states — so the lead shows the claim beside the two
   observations it is read against, in one picture.

   THE MIDDLE TRACK IS THICKER (6px against 2px). It is a different KIND of
   figure from its neighbours: a provider potential with no sample, standing
   between two venue records that both carry one. Drawing it identically would
   invite the reader to compare three things of the same kind.

   THE LEAGUE BASELINE IS NOT DRAWN HERE. The map's three tracks are home,
   potential and away; the league rate has no track in this composition. It is
   still resolved and still passed in — nothing about the data changed — but
   this surface no longer states it. Read `venueLeague` as available, not shown.

   NOTHING RAMPS. The numeral appears at its true value. A 0→100 count-up
   renders numbers the pipeline never observed (§3.2), and rule 5 governs a live
   reading moving to a new value, not a figure arriving for the first time. The
   TRACKS animate, because a bar growing from zero is the drawing of a length
   rather than the counting of a number — and they animate `scaleY` on a fixed
   track, so the block holds its final height from the first frame.
   ========================================================================== */

const LINE_MS = 1100;
const STAGGER_MS = 140;

/** The map's track box. Fixed, so a bar that has not drawn yet costs no layout. */
const TRACK_PX = 110;

type Track = {
  key: string;
  label: string;
  /** The published string — `82% (9/11)`, or `100%` for a figure that carries no sample. */
  display: string;
  /** 0–1. Drives `scaleY` only; never re-derived into a printed figure. */
  proportion: number;
  /** The potential is a different kind of figure from its neighbours and is drawn wider. */
  wide?: boolean;
};

/**
 * A track: a bar that grows from the baseline, with its label and figure beneath.
 *
 * The bar is `scaleY` on a fixed-height rail with `transform-origin: bottom`. Height itself never
 * animates — that would reflow the row on every frame — and the rail occupies its full box from
 * the first paint whether or not the bar has drawn.
 */
function VenueTrack({ track, index, drawn }: { track: Track; index: number; drawn: boolean }) {
  const { rate, sample } = splitRate(track.display);

  return (
    <div className="flex min-w-0 flex-col justify-end" style={{ height: TRACK_PX }}>
      <div
        aria-hidden
        className={`${track.wide ? "w-1.5" : "w-[2px]"} origin-bottom bg-[var(--hero-ink)]`}
        style={
          {
            height: `${track.proportion * 100}%`,
            transform: drawn ? "scaleY(1)" : "scaleY(0)",
            transition: `transform ${LINE_MS}ms cubic-bezier(.16,1,.3,1)`,
            transitionDelay: `${index * STAGGER_MS}ms`,
          } as CSSProperties
        }
      />
      <p className="rw-m mt-1.5 border-t-[0.5px] border-[var(--hero-line)] pt-1.5 tracking-[0.05em] text-[var(--hero-ink-2)]">
        {track.label}
        <br />
        {/* The sample never leaves the rate — it is set with it, at label weight. */}
        <span className="rw-tnum text-[var(--hero-ink)]">{rate}</span>
        {sample ? <span className="rw-tnum"> {sample}</span> : null}
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
    /** Resolved and passed, but not drawn by this composition — see the note above. */
    venueLeague: string;
    /** The middle track's label: the figure the numeral states. */
    venuePotential: string;
    openResearch: string;
    /** The bordered mono button, bottom right. */
    openResearchCta: string;
    /** `league · date · KO UTC`, already resolved by the server boundary. */
    meta: string;
  };
}) {
  const [drawn, setDrawn] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  const venue = (label: string, rate: RateWithSample | null): Track | null =>
    rate ? { key: label, label, display: rate.display, proportion: proportionOf(rate.display) } : null;

  const venueTracks = [
    venue(copy.venueHome, rates?.home ?? null),
    venue(copy.venueAway, rates?.away ?? null),
  ].filter((t): t is Track => t !== null);

  /*
   * THE EMPTY STATE, PER THE DOC: with no venue samples the numeral and its market still render
   * and the tracks block is OMITTED ENTIRELY. No skeleton, no zero-height placeholder.
   *
   * The potential track goes with them, even though its figure is always available. Alone it
   * compares nothing — it would be a single bar depicting the number already set at 148px directly
   * above it, which is decoration wearing the clothes of evidence. The tracks exist to put the
   * claim beside the observations it is read against; with no observations there is nothing to
   * put it beside.
   */
  const hasLines = venueTracks.length > 0;
  const tracks: Track[] = hasLines
    ? [
        venueTracks[0],
        {
          key: "potential",
          label: copy.venuePotential,
          /*
           * Built rather than split, and that is not a rebuilt rate: the provider potential has no
           * published string to split and no sample to lose. It is the same number the numeral
           * prints, formatted the same way.
           */
          display: `${pick.probability}%`,
          proportion: Math.max(0, Math.min(100, pick.probability)) / 100,
          wide: true,
        },
        ...venueTracks.slice(1),
      ]
    : [];

  useEffect(() => {
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
  }, []);

  return (
    <div ref={ref} className="rw-lead group">
      {/* The whole lead is one link. The button at its foot is a target, not a second destination. */}
      <SectionTrackLink
        href={pick.matchHref}
        locale={locale}
        section="hero"
        className="block outline-none"
        aria-label={fill(copy.openResearch, { home: pick.home, away: pick.away })}
      >
        {/* ---- row 1: crests · fixture in the heading face · mono meta ---- */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="flex shrink-0 items-center">
            <Crest src={pick.homeImage} name={pick.home} size={36} />
            <span
              className="ml-1.5 block transition-[margin] duration-[520ms] ease-[cubic-bezier(.16,1,.3,1)] group-hover:ml-3"
            >
              <Crest src={pick.awayImage} name={pick.away} size={36} />
            </span>
          </span>
          <p className="rw-h min-w-0 text-[clamp(1.5rem,3.4vw,2.125rem)] text-[var(--hero-ink)]">
            {pick.home} v {pick.away}
          </p>
          <p className="rw-m tracking-[0.08em] text-[var(--hero-ink-2)]">{copy.meta}</p>
        </div>

        {/* ---- row 2: the numeral, and the tracks beside it ---- */}
        <div className="mt-5 grid items-end gap-x-8 sm:grid-cols-[auto_minmax(0,1fr)] lg:gap-x-14">
          <div className="min-w-0">
            <p className="rw-lead-numeral text-[var(--hero-ink)]">
              {pick.probability}
              <span className="rw-mono align-baseline text-[30px] font-normal tracking-normal">%</span>
            </p>
            <p className="rw-h mt-2.5 text-[20px] tracking-[-0.02em] text-[var(--hero-ink)]">
              {pick.market}
            </p>
            {/* The rule draws in from the left on approach — scaleX(0) at rest, per the map. */}
            <span
              aria-hidden
              className="mt-2.5 block h-px w-full origin-left scale-x-0 bg-[var(--hero-ink)] transition-transform duration-[520ms] ease-[cubic-bezier(.16,1,.3,1)] group-hover:scale-x-100"
            />
            {/*
              THE QUALIFIER, AT THE MAP'S MEASURE. It sits directly under the numeral it bounds, so
              the figure cannot be encountered without it.
            */}
            <p className="rw-m mt-2 max-w-[52ch] normal-case tracking-[0.04em] text-[var(--hero-ink-2)]">
              {copy.probabilityNote}
            </p>
          </div>

          {hasLines ? (
            <div className="mt-8 grid grid-cols-3 gap-x-7 sm:mt-0">
              {tracks.map((track, i) => (
                <VenueTrack key={track.key} track={track} index={i} drawn={drawn} />
              ))}
            </div>
          ) : null}
        </div>

        {/* ---- the close: bordered mono, bottom right ---- */}
        <div className="mt-6 flex justify-end">
          <span className="rw-m inline-flex items-baseline gap-2.5 border border-[var(--hero-ink)] px-3.5 py-2 tracking-[0.1em] text-[var(--hero-ink)] transition-colors duration-[var(--dur-respond)] ease-[var(--ease-settle)] group-hover:bg-[var(--hero-ink)] group-hover:text-[var(--hero-canvas)]">
            {copy.openResearchCta}
            <span
              aria-hidden
              className="inline-block transition-transform duration-[var(--dur-respond)] ease-[var(--ease-settle)] group-hover:translate-x-1"
            >
              →
            </span>
          </span>
        </div>
      </SectionTrackLink>
    </div>
  );
}

/**
 * The bar's length, read from the published string.
 *
 * Parsed from the SAME string that is printed, never from a second source — so a bar can never
 * depict a figure the page does not also state. An unparseable string draws nothing rather than
 * guessing a length.
 */
function proportionOf(display: string): number {
  const pct = Number.parseFloat(splitRate(display).rate);
  return Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) / 100 : 0;
}

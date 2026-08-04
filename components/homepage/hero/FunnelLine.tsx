"use client";

import type { CSSProperties } from "react";
import type { HeroFunnel } from "@/lib/homepage/types";
import { funnelDescent, type HeroCopy } from "./heroModel";

/* ============================================================================
   THE FUNNEL — one hairline, read as a sentence
   ----------------------------------------------------------------------------
   The map sets the funnel as a ruled TEXT line, not a chart. Stages sit on a
   single hairline with their values in mono; the reader scans it the way they
   scan a scoreline.

   THE LEVELS ARE NOT RECOMPUTED. `funnelDescent` already decides which stages
   render, in what order, and which are emphasised — including the rule that a
   `null` stage is omitted entirely rather than drawn as zero. This composition
   consumes that verbatim. A second implementation of the descent would be a
   second definition of what the funnel means.

   "Cleared threshold" is the fourth stage's name. Nothing here calls a threshold
   pass a qualification; the internal `qualified` key is an identifier, not a
   claim, and the accent tick plus the † footnote are what carry the meaning.
   ========================================================================== */

/** One of the page's two permitted accent uses. */
export const FUNNEL_FOOTNOTE_ID = "funnel-cleared-threshold";

export function FunnelLine({
  funnel,
  copy,
}: {
  funnel: HeroFunnel;
  copy: HeroCopy;
}) {
  const descent = funnelDescent(funnel);
  if (descent.length === 0) return null;

  return (
    <div className="rw-funnel">
      {/* The hairline every stage sits on. */}
      <div className="h-px w-full bg-[var(--hero-ink)] opacity-40" aria-hidden />
      {/*
        ONE RULE, ONE LINE.

        This was `flex flex-wrap` with a fixed 40px gap, and at desktop width the fifth stage —
        FEATURED — dropped to a second row. A funnel printed on two lines is not a funnel: the
        claim is a single descent read left to right, and a wrapped stage reads as a separate
        statement about a different population.

        A grid of N equal tracks cannot wrap, because the track count IS the stage count. The
        stages shrink together instead, which is the correct failure — five narrow columns still
        read as one line, where four-plus-one does not. Below `sm` the row would be 60px per
        stage, so it becomes two columns there and the line is abandoned deliberately rather
        than broken accidentally.
      */}
      <dl
        className="mt-4 grid grid-cols-2 items-baseline gap-x-6 gap-y-4 sm:grid-cols-[repeat(var(--rw-funnel-cols),minmax(0,1fr))] sm:gap-x-4"
        style={{ "--rw-funnel-cols": String(descent.length) } as CSSProperties}
      >
        {descent.map((step) => {
          const cleared = step.stage === "qualified";
          return (
            <div key={step.stage} className="flex items-baseline gap-2.5">
              <dt className="rw-m text-[var(--hero-ink-2)]">
                {copy[step.label] ?? step.stage}
                {cleared ? (
                  <>
                    {/* The accent tick — one of two accent uses on the page. */}
                    <span
                      aria-hidden
                      className="ml-1 text-[var(--hero-accent)]"
                    >
                      †
                    </span>
                    <a
                      href={`#${FUNNEL_FOOTNOTE_ID}`}
                      className="sr-only"
                    >
                      See footnote
                    </a>
                  </>
                ) : null}
              </dt>
              <dd className="rw-h rw-tnum text-[20px] text-[var(--hero-ink)]">{step.value}</dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

/**
 * The † footnote, set at the foot of the page.
 *
 * Defined once and referenced from the funnel, so the qualifier travels with the figure without
 * repeating itself beside every stage.
 */
export function FunnelFootnote({ note }: { note: string }) {
  return (
    <p
      id={FUNNEL_FOOTNOTE_ID}
      className="rw-m max-w-[62ch] scroll-mt-24 normal-case tracking-normal text-[var(--hero-ink-2)]"
    >
      <span aria-hidden className="text-[var(--hero-accent)]">
        †
      </span>{" "}
      {note}
    </p>
  );
}

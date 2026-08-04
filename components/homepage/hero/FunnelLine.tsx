"use client";

import type { CSSProperties } from "react";
import type { HeroFunnel } from "@/lib/homepage/types";
import { funnelDescent, type HeroCopy } from "./heroModel";

/* ============================================================================
   THE FUNNEL DESCENT — replicated from the map
   ----------------------------------------------------------------------------
   Not a row of equal stages: a DESCENT. Equal counts share the top rule;
   a stage that actually rejected something drops to its own level, and the rule
   drops with it. The shape IS the claim — "hundreds became five" is a movement
   down the page, and a flat row states it as a list of statistics.

   Each stage is one column of an N-track grid, absolutely positioned at its own
   level inside a fixed-height box. So:

     · nothing wraps, because the track count IS the stage count;
     · nothing reflows, because the box holds its height from the first frame
       whatever the levels turn out to be.

   THE LEVELS ARE NOT RECOMPUTED HERE. `funnelDescent` already emits `offset`,
   keyed to the VALUE rather than to the index: equal counts stay level, and a
   drop marks a real rejection. This renders that number. A second implementation
   of the descent would be a second definition of what the funnel means, and the
   two would disagree on exactly the days that matter.

   VALUE THEN LABEL — "11  fixtures". The count is the observation and the word
   is its caption; putting the word first makes the reader parse a label before
   they are given anything to attach it to.

   THE ACCENT IS ON THE RULE, NOT ON THE MARKER. `cleared†` carries its dagger in
   plain ink as part of its name, and the accent is spent on the OVERLINE above
   it — the one stage whose rule is not ink. That keeps the page's two-accent
   budget intact: this overline, and the † on the footnote that defines it.
   ========================================================================== */

/** One of the page's two permitted accent uses. */
export const FUNNEL_FOOTNOTE_ID = "funnel-cleared-threshold";

/**
 * The top level, before any descent is applied.
 *
 * The stages hang BELOW their rules, so the first rule needs room above it inside the box for
 * nothing at all — this is the map's 18px, which keeps the top rule clear of the section label
 * above without a margin that would move when the descent deepens.
 */
const TOP_PX = 18;

/** Room under the deepest label, so the box never clips its own last line. */
const LABEL_PX = 26;

export function FunnelLine({
  funnel,
  copy,
}: {
  funnel: HeroFunnel;
  copy: HeroCopy;
}) {
  const descent = funnelDescent(funnel);
  if (descent.length === 0) return null;

  /*
   * The box is sized from the deepest level the data actually produced — not from a constant, so
   * a day whose stages never drop draws a short box rather than reserving space for a descent
   * that did not happen. It is still fixed for the whole render: zero CLS.
   */
  const deepest = Math.max(...descent.map((step) => step.offset));

  return (
    <div className="rw-funnel">
      <div
        className="relative grid grid-cols-2 gap-x-6 sm:grid-cols-[repeat(var(--rw-funnel-cols),minmax(0,1fr))] sm:gap-x-4"
        style={
          {
            "--rw-funnel-cols": String(descent.length),
            height: TOP_PX + deepest + LABEL_PX,
          } as CSSProperties
        }
      >
        {descent.map((step) => {
          const cleared = step.stage === "qualified";
          return (
            <div key={step.stage} className="rw-stage relative min-w-0">
              {/*
                The stage sits at its own level. `top` is the descent's own offset plus the shared
                top inset — the only arithmetic here, and it adds a constant rather than deriving
                a level.
              */}
              {/*
                The map's stage response: the text lifts 2px and its ink deepens; the RULE holds
                still, so the level — the funnel's actual claim — never appears to move, and
                neighbours are untouched because a transform costs no layout. The cleared stage's
                accent overline is not part of the response and does not change.
              */}
              <div className="absolute inset-x-0" style={{ top: TOP_PX + step.offset }}>
                <div
                  aria-hidden
                  className={`h-[2px] w-full ${
                    cleared ? "bg-[var(--hero-accent)]" : "bg-[var(--hero-ink)]"
                  }`}
                />
                <p className="rw-stage-text rw-m mt-[5px] whitespace-nowrap tracking-[0.08em] text-[var(--hero-ink)]">
                  <span className="rw-tnum">{step.value}</span>
                  {"\u00a0\u00a0"}
                  <span className="rw-stage-label text-[var(--hero-ink-2)]">
                    {copy[step.label] ?? step.stage}
                    {cleared ? (
                      <>
                        †
                        <a href={`#${FUNNEL_FOOTNOTE_ID}`} className="sr-only">
                          See footnote
                        </a>
                      </>
                    ) : null}
                  </span>
                </p>
              </div>
            </div>
          );
        })}
      </div>
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

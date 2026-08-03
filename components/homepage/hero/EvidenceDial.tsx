"use client";

import { useEffect, useId, useState } from "react";
import type { HeroSettledOutcome, HeroSignal } from "@/lib/homepage/types";
import { Crest } from "./Crest";
import { useResolve } from "./motion";

/* ============================================================================
   THE EVIDENCE DIAL
   ----------------------------------------------------------------------------
   One instrument that holds an entire piece of research. Read from the outside
   in:

     ring 1  history      · the last settled calls on this fixture's model
     ring 2  probability  · the model's forecast, drawn as an arc from the top
     ring 3  evidence     · one blade per signal, its length is the signal weight
     ring 4  confidence   · five segments, filled to the confidence band
     core    the fixture  · crests and the primary reading

   DATA GATING (Sprint 1)
   ----------------------
   Rings 1, 3 and 4 are drawn only when their data exists. Today only ring 2 has
   a production source — `probability` comes from the daily provider lists —
   so the dial arrives as a probability instrument and gains its outer and inner
   rings the moment the Sprint 23B evidence model is enabled. No geometry
   changes on activation: the radii, spans and easing below are already the
   approved values, and each ring is a pure function of the prop it draws.

   Nothing here substitutes one measure for another. When `evidence` is absent
   the core reads the probability under a `Probability` label rather than
   printing a probability beneath the word `Evidence`.
   ========================================================================== */

export type EvidenceDialProps = {
  home: { name: string; image?: string };
  away: { name: string; image?: string };
  /** 0–100. The one reading with a production source today. */
  probability: number;
  /** 0–10. Null until the Sprint 23B evidence model is enabled. */
  evidence: number | null;
  /** 1–5. Null until the Sprint 23B evidence model is enabled. */
  confidence: number | null;
  confidenceLabel: string | null;
  signals: HeroSignal[] | null;
  /** Oldest → newest settled outcomes for this model. */
  history: HeroSettledOutcome[] | null;
  /**
   * The product's approved qualifier for a model probability (`predictions.colPctTooltip`).
   * Surfaced as the reading's accessible description and as its native tooltip, so the figure
   * cannot be encountered — by eye or by screen reader — without the sentence that bounds it.
   */
  probabilityNote?: string;
  size?: number;
};

/* ------------------------------------------------------------- geometry */

const C = 200; // centre of the 400×400 viewBox

function polar(r: number, deg: number) {
  const a = ((deg - 90) * Math.PI) / 180;
  return [C + r * Math.cos(a), C + r * Math.sin(a)] as const;
}

function arcPath(r: number, from: number, to: number) {
  const [x0, y0] = polar(r, from);
  const [x1, y1] = polar(r, to);
  const large = to - from > 180 ? 1 : 0;
  return `M${x0.toFixed(2)},${y0.toFixed(2)} A${r},${r} 0 ${large} 1 ${x1.toFixed(2)},${y1.toFixed(2)}`;
}

/** A filled annular sector — the shape of an evidence blade. */
function bladePath(r0: number, r1: number, from: number, to: number) {
  const [ax, ay] = polar(r0, from);
  const [bx, by] = polar(r1, from);
  const [cx, cy] = polar(r1, to);
  const [dx, dy] = polar(r0, to);
  const large = to - from > 180 ? 1 : 0;
  return [
    `M${ax.toFixed(2)},${ay.toFixed(2)}`,
    `L${bx.toFixed(2)},${by.toFixed(2)}`,
    `A${r1},${r1} 0 ${large} 1 ${cx.toFixed(2)},${cy.toFixed(2)}`,
    `L${dx.toFixed(2)},${dy.toFixed(2)}`,
    `A${r0},${r0} 0 ${large} 0 ${ax.toFixed(2)},${ay.toFixed(2)}`,
    "Z",
  ].join(" ");
}

// rings — full geometry, used the moment the Sprint 23B evidence model supplies rings 1, 3 and 4.
const R_HISTORY = 186;
const R_PROB = 160;
const R_BLADE_BASE = 112;
const R_BLADE_MAX = 146;
const R_CONF = 96;

/*
 * SINGLE-RING GEOMETRY
 *
 * With only probability sourced, the full radii leave a 68-unit empty annulus between the core and
 * the probability arc — the negative space where rings 3 and 4 will eventually sit. Drawn, that void
 * reads as content that failed to load rather than as an instrument with one reading.
 *
 * The single-ring state therefore pulls the arc in to sit just outside the core, and drops the
 * hairline that exists only to tie the core to the inner rings. Nothing is faked and nothing is
 * substituted: the same arc draws the same number. It is a deliberate compact state, not a
 * degraded one, and the full geometry above is restored verbatim on activation.
 */
const R_PROB_SOLO = 124;

// evidence blades occupy the lower 268°, leaving the crown for probability
const SPAN = 268;
const START = 46;
const GAP = 4;

export function EvidenceDial({
  home,
  away,
  probability,
  evidence,
  confidence,
  confidenceLabel,
  signals,
  history,
  probabilityNote,
  size = 440,
}: EvidenceDialProps) {
  const [reading, setReading] = useState<number | null>(null);
  const noteId = useId();

  const probabilityValue = useResolve(probability, 2600, 400);
  const evidenceValue = useResolve(evidence ?? 0, 2400, 620);
  const bladeGrowth = useResolve(1, 2200, 900);
  const confidenceValue = useResolve(confidence ?? 0, 1600, 760);

  // A new fixture is read as a summary first, not mid-signal.
  useEffect(() => setReading(null), [home.name, away.name]);

  const hasSignals = signals !== null && signals.length > 0;
  /*
   * True when probability is the only sourced reading — the production state today. Drives the
   * compact geometry and suppresses the core hairline, whose only job is to bridge the core to
   * rings that are not being drawn.
   */
  const singleRing =
    !hasSignals && confidence === null && (history === null || history.length < 2);
  const rProb = singleRing ? R_PROB_SOLO : R_PROB;
  const active = reading === null || !hasSignals ? null : (signals[reading] ?? null);
  const dimmed = active !== null;

  return (
    <figure
      className="relative m-0"
      style={{ width: size, maxWidth: "100%" }}
      aria-label={
        `${home.name} versus ${away.name}: model probability ${Math.round(probability)}%` +
        (probabilityNote ? `. ${probabilityNote}` : "")
      }
    >
      <svg viewBox="0 0 400 400" className="w-full overflow-visible" role="presentation">
        {/* ---------------------------------------------- ring 1 · history */}
        {history !== null &&
          history.length > 1 &&
          history.map((outcome, i) => {
            const deg = -128 + (i / (history.length - 1)) * 256;
            const [x, y] = polar(R_HISTORY, deg);
            return (
              <circle
                key={`history-${i}`}
                cx={x}
                cy={y}
                r={outcome === "void" ? 2 : 3.2}
                fill={
                  outcome === "win"
                    ? "var(--hero-pos)"
                    : outcome === "loss"
                      ? "rgb(11 12 14 / 0.2)"
                      : "rgb(11 12 14 / 0.1)"
                }
                style={{
                  opacity: dimmed ? 0.25 : 1,
                  transition: "opacity var(--dur-respond) var(--ease-respond)",
                }}
              />
            );
          })}

        {/* ------------------------------------------ ring 2 · probability */}
        <path
          d={arcPath(rProb, -150, 150)}
          fill="none"
          strokeWidth="1"
          stroke="rgb(11 12 14 / 0.09)"
        />
        {/* tick fan */}
        {Array.from({ length: 61 }).map((_, i) => {
          const t = i / 60;
          const deg = -150 + t * 300;
          const on = t <= probabilityValue / 100;
          const major = i % 15 === 0;
          const [x0, y0] = polar(rProb + (major ? 9 : 6), deg);
          const [x1, y1] = polar(rProb, deg);
          return (
            <line
              key={`tick-${i}`}
              x1={x0}
              y1={y0}
              x2={x1}
              y2={y1}
              strokeWidth={major ? 1.3 : 0.7}
              stroke={on ? "rgb(11 12 14 / 0.4)" : "rgb(11 12 14 / 0.08)"}
              style={{ transition: "stroke var(--dur-respond) linear" }}
            />
          );
        })}
        <path
          d={arcPath(rProb, -150, -150 + (probabilityValue / 100) * 300)}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          stroke="var(--hero-accent)"
          style={{
            opacity: dimmed ? 0.3 : 1,
            transition: "opacity var(--dur-respond) var(--ease-respond)",
          }}
        />
        {(() => {
          const [x, y] = polar(rProb, -150 + (probabilityValue / 100) * 300);
          return (
            <circle
              cx={x}
              cy={y}
              r="4.5"
              strokeWidth="2.5"
              fill="var(--hero-canvas)"
              stroke="var(--hero-accent)"
            />
          );
        })()}

        {/* -------------------------------------------- ring 3 · evidence */}
        {hasSignals &&
          signals.map((signal, i) => {
            const step = SPAN / signals.length;
            const from = START + i * step + GAP / 2;
            const to = START + (i + 1) * step - GAP / 2;
            const reach =
              R_BLADE_BASE +
              (R_BLADE_MAX - R_BLADE_BASE) * Math.min(1, signal.weight / 0.4) * bladeGrowth;
            const isRead = reading === i;
            return (
              <g
                key={signal.name}
                tabIndex={0}
                role="button"
                aria-label={`${signal.name}, weight ${signal.weight}`}
                onMouseEnter={() => setReading(i)}
                onMouseLeave={() => setReading(null)}
                onFocus={() => setReading(i)}
                onBlur={() => setReading(null)}
                className="cursor-pointer"
              >
                {/* the track the blade grows along */}
                <path
                  d={bladePath(R_BLADE_BASE, R_BLADE_MAX, from, to)}
                  fill="rgb(11 12 14 / 0.04)"
                />
                <path
                  d={bladePath(R_BLADE_BASE, reach, from, to)}
                  fill={
                    isRead
                      ? "var(--hero-accent)"
                      : reading === null
                        ? "rgb(11 12 14 / 0.7)"
                        : "rgb(11 12 14 / 0.2)"
                  }
                  style={{ transition: "fill var(--dur-respond) var(--ease-respond)" }}
                />
                {/* a wider invisible target so the blade is easy to catch */}
                <path d={bladePath(R_CONF, R_BLADE_MAX + 10, from, to)} fill="transparent" />
              </g>
            );
          })}

        {/* ------------------------------------------ ring 4 · confidence */}
        {confidence !== null &&
          [0, 1, 2, 3, 4].map((i) => {
            const from = -150 + i * 61;
            const to = from + 55;
            return (
              <path
                key={`confidence-${i}`}
                d={arcPath(R_CONF, from, to)}
                fill="none"
                strokeWidth="3"
                strokeLinecap="round"
                stroke={
                  i < Math.round(confidenceValue) ? "var(--hero-ink)" : "rgb(11 12 14 / 0.12)"
                }
                style={{
                  opacity: dimmed ? 0.25 : 1,
                  transition: `opacity var(--dur-respond) var(--ease-respond) ${i * 60}ms`,
                }}
              />
            );
          })}

        {/* Ties the core to rings 3 and 4. With those absent it is an orphan circle floating in an
            empty annulus, so the solo state omits it entirely. */}
        {singleRing ? null : (
          <circle cx={C} cy={C} r="84" fill="none" strokeWidth="1" stroke="rgb(11 12 14 / 0.07)" />
        )}
      </svg>

      {/* ------------------------------------------------------- the core */}
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <div className="w-[46%] text-center">
          {/* summary */}
          <div
            className="transition-opacity duration-[var(--dur-respond)] ease-[var(--ease-respond)]"
            style={{ opacity: active ? 0 : 1 }}
          >
            <div
              key={`${home.name}-${away.name}`}
              className="rw-fade flex items-center justify-center gap-2"
            >
              <Crest src={home.image} name={home.name} size={26} />
              <span className="rw-mono text-[9px] text-[var(--hero-ink-3)]">V</span>
              <Crest src={away.image} name={away.name} size={26} />
            </div>

            {evidence !== null ? (
              <>
                <p className="rw-tnum rw-display mt-3 text-[clamp(2.2rem,3.4vw,2.9rem)] text-[var(--hero-accent)]">
                  {evidenceValue.toFixed(1)}
                </p>
                <p className="rw-label mt-1 text-[var(--hero-ink-3)]">Evidence</p>
                <p className="rw-tnum mt-3 text-[13px] font-medium">
                  {Math.round(probabilityValue)}%
                  {confidenceLabel ? (
                    <>
                      {" · "}
                      <span key={confidenceLabel} className="rw-fade inline-block">
                        {confidenceLabel}
                      </span>
                    </>
                  ) : null}
                </p>
              </>
            ) : (
              /*
               * No evidence score in production yet. The slot keeps its scale and rhythm and
               * states the reading it actually has — it does not print the probability under an
               * `Evidence` label, which would be a different claim.
               */
              <>
                {/*
                  The reading is a model estimate, and at 100% the interface must not be readable as
                  a promise. Three things bound it, none of which touch the backend value:
                  the numeral steps down from display scale so it no longer dominates the core, the
                  label sits directly beneath it in full, and the approved qualifier is attached as
                  both the native tooltip and the accessible description of the figure.
                */}
                <p
                  className="rw-tnum rw-display mt-3 text-[clamp(1.9rem,2.8vw,2.35rem)] text-[var(--hero-accent)]"
                  title={probabilityNote}
                  aria-describedby={probabilityNote ? noteId : undefined}
                >
                  {Math.round(probabilityValue)}
                  <span className="align-super text-[0.4em] text-[var(--hero-ink-3)]">%</span>
                </p>
                <p className="rw-label mt-2 text-[var(--hero-ink-2)]">Model probability</p>
                {probabilityNote ? (
                  <p id={noteId} className="sr-only">
                    {probabilityNote}
                  </p>
                ) : null}
              </>
            )}
          </div>

          {/* signal reading, occupying the same space */}
          {hasSignals ? (
            <div
              className="absolute inset-0 grid place-items-center px-[18%] transition-opacity duration-[var(--dur-respond)] ease-[var(--ease-respond)]"
              style={{ opacity: active ? 1 : 0 }}
            >
              <div>
                <p className="rw-label text-[var(--hero-accent)]">Signal</p>
                <p className="mt-2 text-[15px] font-medium leading-tight tracking-[-0.02em]">
                  {active?.name}
                </p>
                <p className="rw-tnum rw-mono mt-2 text-[12px] text-[var(--hero-ink-2)]">
                  weight +{active?.weight.toFixed(2)}
                </p>
                <p className="mt-2 text-[11px] leading-4 text-[var(--hero-ink-3)]">
                  {active?.detail}
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </figure>
  );
}

import { useEffect, useState } from "react";
import Crest from "./Crest";
import { useResolve } from "./motion";

/* ============================================================================
   THE EVIDENCE DIAL
   ----------------------------------------------------------------------------
   One instrument that holds an entire piece of RankWagers research.
   Read from the outside in:

     ring 1  history      · the last ten settled calls on this fixture's model
     ring 2  probability  · the model's forecast, drawn as an arc from the top
     ring 3  evidence     · one blade per signal, its length is the signal weight
     ring 4  confidence   · five segments, filled to the confidence band
     core    the fixture  · crests, evidence score, and whichever signal is read

   Touch a blade and the whole dial reads that signal instead of the summary.
   ========================================================================== */

export type DialSignal = { name: string; weight: number; detail: string };

export type EvidenceDialProps = {
  home: { id: number; name: string; short: string };
  away: { id: number; name: string; short: string };
  league: { id: number; name: string };
  kickoff: string;
  probability: number;
  evidence: number;
  confidence: number; // 1–5
  confidenceLabel: string;
  signals: DialSignal[];
  /** Oldest → newest settled outcomes for this model. */
  history: ("win" | "loss" | "void")[];
  size?: number;
  /** The dial names its own fixture unless the surrounding composition already does. */
  caption?: boolean;
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

/* ------------------------------------------------------------- component */

export default function EvidenceDial(props: EvidenceDialProps) {
  const { home, away, league, kickoff, signals, history, size = 400, caption = true } = props;
  const [reading, setReading] = useState<number | null>(null);

  const probability = useResolve(props.probability, 2600, 400);
  const evidence = useResolve(props.evidence, 2400, 620);
  const bladeGrowth = useResolve(1, 2200, 900);
  const conf = useResolve(props.confidence, 1600, 760);

  // A new fixture is read as a summary first, not mid-signal.
  useEffect(() => setReading(null), [home.id, away.id]);

  const active = reading === null ? null : signals[reading];
  const wins = history.filter((h) => h === "win").length;

  // rings
  const R_HISTORY = 186;
  const R_PROB = 160;
  const R_BLADE_BASE = 112;
  const R_BLADE_MAX = 146;
  const R_CONF = 96;

  // evidence blades occupy the lower 260°, leaving the crown for probability
  const SPAN = 268;
  const START = 46;
  const gap = 4;
  const step = SPAN / signals.length;

  return (
    <figure
      className="relative m-0"
      style={{ width: size, maxWidth: "100%" }}
      aria-label={`Evidence dial: ${home.name} versus ${away.name}`}
    >
      <svg viewBox="0 0 400 400" className="w-full overflow-visible">
        {/* ---------------------------------------------- ring 1 · history */}
        {history.map((h, i) => {
          const deg = -128 + (i / (history.length - 1)) * 256;
          const [x, y] = polar(R_HISTORY, deg);
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={h === "void" ? 2 : 3.2}
              className={
                h === "win" ? "fill-pos" : h === "loss" ? "fill-ink/20" : "fill-ink/10"
              }
              style={{ opacity: reading === null ? 1 : 0.25, transition: "opacity var(--dur-respond) var(--ease-respond)" }}
            >
              <title>{`Settled ${i + 1}: ${h}`}</title>
            </circle>
          );
        })}

        {/* ------------------------------------------ ring 2 · probability */}
        <path d={arcPath(R_PROB, -150, 150)} fill="none" strokeWidth="1" className="stroke-ink/[0.09]" />
        {/* tick fan */}
        {Array.from({ length: 61 }).map((_, i) => {
          const t = i / 60;
          const deg = -150 + t * 300;
          const on = t <= probability / 100;
          const major = i % 15 === 0;
          const [x0, y0] = polar(R_PROB + (major ? 9 : 6), deg);
          const [x1, y1] = polar(R_PROB, deg);
          return (
            <line
              key={i}
              x1={x0}
              y1={y0}
              x2={x1}
              y2={y1}
              strokeWidth={major ? 1.3 : 0.7}
              className={on ? "stroke-ink/40" : "stroke-ink/[0.08]"}
              style={{ transition: "stroke var(--dur-respond) linear" }}
            />
          );
        })}
        <path
          d={arcPath(R_PROB, -150, -150 + (probability / 100) * 300)}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          className="stroke-accent"
          style={{ opacity: reading === null ? 1 : 0.3, transition: "opacity var(--dur-respond) var(--ease-respond)" }}
        />
        {(() => {
          const [x, y] = polar(R_PROB, -150 + (probability / 100) * 300);
          return <circle cx={x} cy={y} r="4.5" strokeWidth="2.5" className="fill-canvas stroke-accent" />;
        })()}

        {/* -------------------------------------------- ring 3 · evidence */}
        {signals.map((s, i) => {
          const from = START + i * step + gap / 2;
          const to = START + (i + 1) * step - gap / 2;
          const reach = R_BLADE_BASE + (R_BLADE_MAX - R_BLADE_BASE) * (s.weight / 0.4) * bladeGrowth;
          const isRead = reading === i;
          return (
            <g
              key={s.name}
              tabIndex={0}
              role="button"
              aria-label={`${s.name}, weight ${s.weight}`}
              onMouseEnter={() => setReading(i)}
              onMouseLeave={() => setReading(null)}
              onFocus={() => setReading(i)}
              onBlur={() => setReading(null)}
              className="cursor-pointer outline-none"
            >
              {/* the track the blade grows along */}
              <path d={bladePath(R_BLADE_BASE, R_BLADE_MAX, from, to)} className="fill-ink/[0.04]" />
              <path
                d={bladePath(R_BLADE_BASE, reach, from, to)}
                className={isRead ? "fill-accent" : reading === null ? "fill-ink/70" : "fill-ink/20"}
                style={{ transition: "fill var(--dur-respond) var(--ease-respond)" }}
              />
              {/* a wider invisible target so the blade is easy to catch */}
              <path d={bladePath(R_CONF, R_BLADE_MAX + 10, from, to)} fill="transparent" />
            </g>
          );
        })}

        {/* ------------------------------------------ ring 4 · confidence */}
        {[0, 1, 2, 3, 4].map((i) => {
          const from = -150 + i * 61;
          const to = from + 55;
          return (
            <path
              key={i}
              d={arcPath(R_CONF, from, to)}
              fill="none"
              strokeWidth="3"
              strokeLinecap="round"
              className={i < Math.round(conf) ? "stroke-ink" : "stroke-ink/[0.12]"}
              style={{
                opacity: reading === null ? 1 : 0.25,
                transition: `opacity var(--dur-respond) var(--ease-respond) ${i * 60}ms`,
              }}
            />
          );
        })}

        {/* hairline that ties the core to the dial */}
        <circle cx={C} cy={C} r="84" fill="none" strokeWidth="1" className="stroke-ink/[0.07]" />
      </svg>

      {/* ------------------------------------------------------- the core */}
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <div className="w-[46%] text-center">
          {/* summary */}
          <div
            className="transition-opacity duration-[var(--dur-respond)] ease-[var(--ease-respond)]"
            style={{ opacity: active ? 0 : 1 }}
          >
            <div key={`${home.id}-${away.id}`} className="m-fade flex items-center justify-center gap-2">
              <Crest id={home.id} name={home.name} size={26} />
              <span className="font-mono text-[9px] text-ink-3">V</span>
              <Crest id={away.id} name={away.name} size={26} />
            </div>
            <p className="tnum display mt-3 text-[clamp(2.2rem,3.4vw,2.9rem)] text-accent">{evidence.toFixed(1)}</p>
            <p className="label mt-1 text-ink-3">Evidence</p>
            <p className="tnum mt-3 text-[13px] font-medium">
              {Math.round(probability)}% ·{" "}
              <span key={props.confidenceLabel} className="m-fade inline-block">{props.confidenceLabel}</span>
            </p>
          </div>

          {/* signal reading, occupying the same space */}
          <div
            className="absolute inset-0 grid place-items-center px-[18%] transition-opacity duration-[var(--dur-respond)] ease-[var(--ease-respond)]"
            style={{ opacity: active ? 1 : 0 }}
          >
            <div>
              <p className="label text-accent">Signal</p>
              <p className="mt-2 text-[15px] font-medium leading-tight tracking-[-0.02em]">{active?.name}</p>
              <p className="tnum mt-2 font-mono text-[12px] text-ink-2">weight +{active?.weight.toFixed(2)}</p>
              <p className="mt-2 text-[11px] leading-4 text-ink-3">{active?.detail}</p>
            </div>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------- legends */}
      {caption && (
      <figcaption className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-center">
        <span className="flex items-center gap-2 text-[12px] text-ink-2">
          <Crest id={league.id} name={league.name} kind="league" size={14} />
          {league.name}
        </span>
        <span className="label tnum text-ink-3">KO {kickoff}</span>
        <span className="label tnum text-ink-3">
          History {wins}/{history.length} settled
        </span>
      </figcaption>
      )}
    </figure>
  );
}

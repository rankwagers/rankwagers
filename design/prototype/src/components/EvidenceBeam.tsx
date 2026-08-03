import { useState } from "react";
import Crest from "./Crest";
import { LeagueCue } from "./LeagueMark";
import { useResolve } from "./motion";

/* ============================================================================
   THE EVIDENCE BEAM
   ----------------------------------------------------------------------------
   A balance, not a chart.

   The two clubs sit at the ends of a beam. Every published signal is a weight
   resting on it, placed where that signal leans and sized by how much it
   carries. The beam tilts to the sum of them, and the marker settles at the
   probability that tilt produces.

   The interaction is the argument: lift a weight off the beam — hover it —
   and the beam re-settles to what the model would have said WITHOUT that
   evidence. A ghost marker holds the published value so the difference is
   impossible to miss.

   Fixture · Probability · Evidence · Confidence · History · Signals
   ========================================================================== */

export type BeamSignal = {
  name: string;
  /** Points of probability this signal contributes. Positive leans home. */
  delta: number;
  /** Where the signal itself points, 0 (away) → 100 (home). */
  lean: number;
  detail: string;
};

export type EvidenceBeamProps = {
  home: { id: number; name: string; short: string };
  away: { id: number; name: string; short: string };
  league: { id: number; name: string };
  kickoff: string;
  /** Published probability of the home side, 0–100. */
  probability: number;
  evidence: number;
  confidence: number; // 1–5
  confidenceLabel: string;
  signals: BeamSignal[];
  /** Past settled calls by this model: where it landed, and whether it was right. */
  history: { at: number; result: "win" | "loss" }[];
};

/* ------------------------------------------------------------- geometry */

const W = 900;
const H = 430;
const X0 = 96;
const X1 = 804;
const BEAM_Y = 296;
const PIVOT_X = (X0 + X1) / 2;

const x = (p: number) => X0 + (p / 100) * (X1 - X0);
const MAX_TILT = 3.4; // degrees — a balance, not a see-saw

export default function EvidenceBeam(props: EvidenceBeamProps) {
  const { home, away, league, kickoff, signals, history } = props;
  const [lifted, setLifted] = useState<number | null>(null);

  const settle = useResolve(1, 2600, 260); // the beam loading itself on arrival
  const evidence = useResolve(props.evidence, 2400, 520);

  const removed = lifted === null ? 0 : signals[lifted].delta;
  const target = props.probability - removed;
  const shown = 50 + (target - 50) * settle;
  const tilt = ((shown - 50) / 50) * MAX_TILT;

  // confidence narrows the interval the model is willing to stand behind
  const band = (6 - props.confidence) * 2.4;
  const wins = history.filter((h) => h.result === "win").length;

  const ease = "var(--dur-expand) var(--ease-respond)";

  return (
    <figure
      className="relative m-0 w-full"
      aria-label={`Evidence beam: ${home.name} versus ${away.name}, ${props.probability}% probability`}
    >
      {/* ---------------------------------------------------------- header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-3">
          <LeagueCue id={league.id} />
          <Crest id={league.id} name={league.name} kind="league" size={16} />
          <span className="text-[12px] text-ink-2">{league.name}</span>
          <span className="label tnum text-ink-3">KO {kickoff}</span>
        </div>
        <div className="flex items-baseline gap-6">
          <span className="label text-ink-3">
            Evidence <span className="tnum ml-2 text-[15px] font-semibold text-accent">{evidence.toFixed(1)}</span>
          </span>
          <span className="label text-ink-3">
            History <span className="tnum ml-2 text-[15px] font-semibold text-ink">{wins}/{history.length}</span>
          </span>
        </div>
      </div>

      {/* ------------------------------------------------------- the number */}
      <div className="mt-6 flex flex-wrap items-end gap-x-6 gap-y-2">
        <p className="tnum display text-[clamp(3.4rem,7vw,5.6rem)]">
          {Math.round(shown)}
          <span className="text-[0.4em] align-super text-ink-3">%</span>
        </p>
        <div className="pb-3">
          <p className="label text-ink-3">{home.name} to win</p>
          <p
            className="mt-1 text-[13px] font-medium transition-colors duration-[var(--dur-respond)]"
            style={{ color: lifted === null ? "var(--color-ink-2)" : "var(--color-accent)" }}
          >
            {lifted === null
              ? `${props.confidenceLabel} confidence · ±${band.toFixed(1)} pts`
              : `${removed > 0 ? "−" : "+"}${Math.abs(removed).toFixed(1)} pts without "${signals[lifted].name}"`}
          </p>
        </div>
      </div>

      {/* --------------------------------------------------------- the beam */}
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-4 w-full overflow-visible">
        {/* the probability scale the beam is read against */}
        {Array.from({ length: 51 }).map((_, i) => {
          const p = i * 2;
          const major = p % 25 === 0;
          return (
            <line
              key={i}
              x1={x(p)}
              y1={BEAM_Y + 34}
              x2={x(p)}
              y2={BEAM_Y + (major ? 46 : 40)}
              strokeWidth={major ? 1.2 : 0.6}
              className="stroke-ink/[0.14]"
            />
          );
        })}
        {[0, 25, 50, 75, 100].map((p) => (
          <text
            key={p}
            x={x(p)}
            y={BEAM_Y + 64}
            textAnchor="middle"
            className="fill-ink/35 font-mono text-[11px]"
          >
            {p}
          </text>
        ))}

        {/* history: where this model landed before, and whether it was right */}
        {history.map((h, i) => (
          <g key={i} style={{ opacity: lifted === null ? 1 : 0.3, transition: `opacity ${ease}` }}>
            <line
              x1={x(h.at)}
              y1={BEAM_Y + 76}
              x2={x(h.at)}
              y2={BEAM_Y + 88}
              strokeWidth="2"
              strokeLinecap="round"
              className={h.result === "win" ? "stroke-pos" : "stroke-ink/20"}
            >
              <title>{`Settled at ${h.at}% — ${h.result}`}</title>
            </line>
          </g>
        ))}

        {/* confidence: the interval the model stands behind */}
        <g
          style={{
            transform: `translateX(${x(shown) - x(50)}px)`,
            transition: `transform ${ease}`,
          }}
        >
          <rect
            x={x(50) - ((band / 100) * (X1 - X0)) / 2}
            y={BEAM_Y + 4}
            width={((band / 100) * (X1 - X0))}
            height={26}
            rx={13}
            className="fill-accent/[0.09]"
          />
        </g>

        {/* the ghost of the published value, revealed only while a weight is lifted */}
        <g style={{ opacity: lifted === null ? 0 : 1, transition: `opacity ${ease}` }}>
          <line
            x1={x(props.probability)}
            y1={BEAM_Y - 18}
            x2={x(props.probability)}
            y2={BEAM_Y + 30}
            strokeWidth="1"
            strokeDasharray="3 4"
            className="stroke-ink/35"
          />
          <text x={x(props.probability)} y={BEAM_Y + 46} textAnchor="middle" className="fill-ink/45 font-mono text-[10px]">
            published
          </text>
        </g>

        {/* the beam itself, tilting to the weight it carries */}
        <g
          style={{
            transform: `rotate(${-tilt}deg)`,
            transformOrigin: `${PIVOT_X}px ${BEAM_Y}px`,
            transition: `transform ${ease}`,
          }}
        >
          <line x1={X0} y1={BEAM_Y} x2={X1} y2={BEAM_Y} strokeWidth="2" strokeLinecap="round" className="stroke-ink" />

          {/* the weights resting on it */}
          {signals.map((s, i) => {
            const isLifted = lifted === i;
            const w = 34 + Math.abs(s.delta) * 7;
            const h = 10 + Math.abs(s.delta) * 2.2;
            return (
              <g
                key={s.name}
                tabIndex={0}
                role="button"
                aria-label={`${s.name}, ${s.delta > 0 ? "+" : ""}${s.delta} points. Lift to see the model without it.`}
                onMouseEnter={() => setLifted(i)}
                onMouseLeave={() => setLifted(null)}
                onFocus={() => setLifted(i)}
                onBlur={() => setLifted(null)}
                className="cursor-pointer outline-none"
                style={{
                  transform: `translate(${x(s.lean)}px, ${BEAM_Y - h / 2 - 1 - (isLifted ? 46 : 0)}px)`,
                  transition: `transform ${ease}`,
                }}
              >
                <rect
                  x={-w / 2}
                  y={-h / 2}
                  width={w}
                  height={h}
                  rx={h / 2}
                  className={isLifted ? "fill-accent" : "fill-ink"}
                  style={{ transition: `fill var(--dur-respond) var(--ease-respond)` }}
                />
                {/* a generous invisible target above the weight */}
                <rect x={-w / 2 - 12} y={-h / 2 - 30} width={w + 24} height={h + 52} fill="transparent" />
              </g>
            );
          })}
        </g>

        {/* fulcrum */}
        <path
          d={`M${PIVOT_X - 16},${BEAM_Y + 26} L${PIVOT_X},${BEAM_Y + 2} L${PIVOT_X + 16},${BEAM_Y + 26} Z`}
          className="fill-ink"
        />

        {/* the marker the beam settles to */}
        <g style={{ transform: `translateX(${x(shown)}px)`, transition: `transform ${ease}` }}>
          <line x1={0} y1={BEAM_Y - 96} x2={0} y2={BEAM_Y + 30} strokeWidth="2" className="stroke-accent" />
          <circle cx={0} cy={BEAM_Y - 96} r="5" strokeWidth="2.5" className="fill-canvas stroke-accent" />
        </g>
      </svg>

      {/* ------------------------------------------------------- the clubs */}
      <div className="-mt-6 flex items-start justify-between gap-6">
        <div className="flex items-center gap-3">
          <Crest id={home.id} name={home.name} size={54} className="m-breathe" />
          <div>
            <p className="text-[16px] font-medium tracking-[-0.02em]">{home.name}</p>
            <p className="label mt-1 text-ink-3">Home</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-right">
          <div>
            <p className="text-[16px] font-medium tracking-[-0.02em] text-ink-2">{away.name}</p>
            <p className="label mt-1 text-ink-3">Away</p>
          </div>
          <Crest id={away.id} name={away.name} size={54} className="m-breathe-slow" />
        </div>
      </div>

      {/* --------------------------------------------------------- the keys */}
      <ul className="mt-12 grid gap-x-10 gap-y-8 sm:grid-cols-3">
        {signals.map((s, i) => {
          const on = lifted === i;
          return (
            <li
              key={s.name}
              onMouseEnter={() => setLifted(i)}
              onMouseLeave={() => setLifted(null)}
              className="group relative cursor-pointer pt-5"
            >
              <span className="absolute left-0 top-0 h-px w-full bg-line" />
              <span
                className="absolute left-0 top-0 h-px w-full origin-left bg-accent transition-transform duration-[var(--dur-expand)] ease-[var(--ease-settle)]"
                style={{ transform: on ? "scaleX(1)" : "scaleX(0)" }}
              />
              <span
                className="absolute left-0 top-0 w-px bg-ink transition-all duration-[var(--dur-respond)]"
                style={{ height: on ? 18 : 9 }}
              />
              <div className="flex items-baseline justify-between pl-4">
                <span className="label text-ink-3">{s.lean >= 50 ? home.short : away.short}</span>
                <span
                  className="tnum font-mono text-[12px] transition-colors duration-[var(--dur-respond)]"
                  style={{ color: on ? "var(--color-accent)" : "var(--color-ink-2)" }}
                >
                  {s.delta > 0 ? "+" : ""}
                  {s.delta.toFixed(1)} pts
                </span>
              </div>
              <p className="mt-4 pl-4 text-[16px] font-medium tracking-[-0.025em]">{s.name}</p>
              <p className="mt-2 pl-4 text-[13px] leading-5 text-ink-2">{s.detail}</p>
            </li>
          );
        })}
      </ul>
    </figure>
  );
}

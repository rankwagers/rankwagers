import { useEffect, useRef, useState } from "react";
import Crest from "./Crest";
import EvidenceDial from "./EvidenceDial";
import { tinted } from "./leagues";
import { useIntent } from "./motion";

/* ============================================================================
   TODAY'S SELECTION
   ----------------------------------------------------------------------------
   The hero no longer stages one fixture. It stages the act of choosing.

     left    the funnel — everything analysed, what qualified, what published —
             and beneath it the ranked selection, strongest evidence first
     right   the Evidence Dial, which reads whichever selection is being held
     back    the two clubs of the held selection, crossfading behind it all

   Nothing here is decorative. Moving down the list moves the instrument.
   ========================================================================== */

const FUNNEL = { analysed: 132, qualified: 18, published: 5 };

type Pick = {
  league: { id: number; name: string };
  home: { id: number; name: string; short: string };
  away: { id: number; name: string; short: string };
  kickoff: string;
  venue: string;
  round: string;
  evidence: number;
  probability: number;
  confidence: number;
  confidenceLabel: string;
  lean: string;
  summary: string;
  reasons: [string, string, string];
  signals: { name: string; weight: number; detail: string }[];
  history: ("win" | "loss" | "void")[];
};

const PICKS: Pick[] = [
  {
    league: { id: 39, name: "Premier League" },
    home: { id: 42, name: "Arsenal", short: "ARS" },
    away: { id: 34, name: "Newcastle United", short: "NEW" },
    kickoff: "20:00",
    venue: "Emirates Stadium",
    round: "Matchday 32",
    evidence: 9.5,
    probability: 72,
    confidence: 5,
    confidenceLabel: "Very high",
    lean: "Arsenal",
    reasons: ["Left-side overload", "Away block conceding", "Set-piece edge"],
    summary: "Arsenal generate 41% of their chances down the left, into a Newcastle block that has conceded 2.1 xG per away match since December. The set-piece edge is the tiebreak.",
    signals: [
      { name: "Left-side overload", weight: 0.34, detail: "41% of Arsenal chances arrive from the left half-space." },
      { name: "Rest-defence exposure", weight: 0.27, detail: "Newcastle concede 2.1 xG per away match since December." },
      { name: "Set-piece delta", weight: 0.19, detail: "A +0.41 dead-ball xG advantage over ten rounds." },
    ],
    history: ["win", "win", "loss", "win", "void", "win", "win", "loss", "win", "win"],
  },
  {
    league: { id: 88, name: "Eredivisie" },
    home: { id: 197, name: "PSV Eindhoven", short: "PSV" },
    away: { id: 202, name: "FC Utrecht", short: "UTR" },
    kickoff: "18:45",
    venue: "Philips Stadion",
    round: "Matchday 29",
    evidence: 9.4,
    probability: 71,
    confidence: 5,
    confidenceLabel: "Very high",
    lean: "PSV",
    reasons: ["Territorial control", "Away chance quality", "Turnover volume"],
    summary: "PSV take 68% of the final-third touches at home and force nine high turnovers a match. Utrecht build slowly and concede 1.9 xG on the road.",
    signals: [
      { name: "Territorial dominance", weight: 0.31, detail: "PSV average 68% of the final-third touches at home." },
      { name: "Away chance quality", weight: 0.25, detail: "Utrecht concede 1.9 xG per match on the road this season." },
      { name: "Transition volume", weight: 0.21, detail: "Nine high turnovers per match against a slow build-up." },
    ],
    history: ["win", "loss", "win", "win", "win", "loss", "win", "win", "void", "win"],
  },
  {
    league: { id: 94, name: "Primeira Liga" },
    home: { id: 211, name: "Benfica", short: "BEN" },
    away: { id: 212, name: "Porto", short: "POR" },
    kickoff: "21:15",
    venue: "Estádio da Luz",
    round: "Matchday 27",
    evidence: 9.3,
    probability: 58,
    confidence: 4,
    confidenceLabel: "High",
    lean: "Benfica",
    reasons: ["Dead-ball volume", "Press resistance", "Home record"],
    summary: "A Clássico decided at dead balls — twelve set-piece chances per meeting over five years. Porto resist the press better than anyone, so open play stays level.",
    signals: [
      { name: "Derby set-piece volume", weight: 0.29, detail: "Twelve dead-ball chances per Clássico across five years." },
      { name: "Press resistance", weight: 0.24, detail: "Porto's build-up completes 84% under pressure — the league's best." },
      { name: "Home record", weight: 0.18, detail: "Benfica have dropped points once at the Luz since August." },
    ],
    history: ["win", "win", "win", "loss", "win", "void", "loss", "win", "win", "loss"],
  },
  {
    league: { id: 135, name: "Serie A" },
    home: { id: 505, name: "Inter", short: "INT" },
    away: { id: 497, name: "Roma", short: "ROM" },
    kickoff: "19:45",
    venue: "San Siro",
    round: "Matchday 31",
    evidence: 9.2,
    probability: 64,
    confidence: 4,
    confidenceLabel: "High",
    lean: "Inter",
    reasons: ["Ball progression", "Compact mid-block", "Rest advantage"],
    summary: "Inter carry the ball 41 metres per possession into the league's most compact mid-block, with four days more recovery than a Roma side back from Europe.",
    signals: [
      { name: "Wing-back progression", weight: 0.28, detail: "Inter carry the ball forward 41 metres per possession." },
      { name: "Mid-block compactness", weight: 0.22, detail: "Roma allow the fewest touches in the box in Serie A." },
      { name: "Rest advantage", weight: 0.16, detail: "Four days more recovery after a European midweek." },
    ],
    history: ["win", "loss", "win", "win", "loss", "win", "win", "win", "loss", "win"],
  },
  {
    league: { id: 113, name: "Allsvenskan" },
    home: { id: 377, name: "Malmö FF", short: "MFF" },
    away: { id: 375, name: "AIK", short: "AIK" },
    kickoff: "17:00",
    venue: "Eleda Stadion",
    round: "Matchday 8",
    evidence: 9.1,
    probability: 69,
    confidence: 4,
    confidenceLabel: "High",
    lean: "Malmö",
    reasons: ["Squad quality gap", "Away scoring drought", "xG difference"],
    summary: "A four-fold squad-value gap, the best xG difference in the division, and an AIK side that has scored twice in six matches away from Solna.",
    signals: [
      { name: "Squad quality gap", weight: 0.3, detail: "Malmö out-spend the away side by a factor of four." },
      { name: "Away scoring drought", weight: 0.23, detail: "AIK have scored twice in six matches away from Solna." },
      { name: "Early-season form", weight: 0.15, detail: "Seven points from nine, with the best xG difference." },
    ],
    history: ["win", "win", "void", "win", "loss", "win", "win", "loss", "win", "win"],
  },
];

/**
 * THE LEDGER
 * One hairline per fixture analysed today — all 132 of them. Eighteen stand
 * taller because they cleared the qualifying threshold; five are struck in the
 * accent because they were published. No number here is new: it is the funnel
 * above, drawn at full resolution. The sweep is the engine passing over the
 * slate again, which it does continuously.
 */
const QUALIFIED = Array.from({ length: FUNNEL.qualified }, (_, i) =>
  Math.round((i * (FUNNEL.analysed - 6)) / (FUNNEL.qualified - 1)) + 3,
);
/** The five struck ticks, in the order the five published fixtures are ranked. */
const PUBLISHED_AT = [1, 4, 8, 12, 16].map((i) => QUALIFIED[i]);
const PUBLISHED = new Map(PUBLISHED_AT.map((tick, rank) => [tick, rank]));
const QUALIFIED_SET = new Set(QUALIFIED);

/** Where a tick sits across the slate, as a percentage — the connector reads this. */
const tickX = (i: number) => (i / (FUNNEL.analysed - 1)) * 100;

function Ledger({ held }: { held: number }) {
  return (
    <div
      className="relative overflow-hidden"
      role="img"
      aria-label={`${FUNNEL.analysed} fixtures analysed, ${FUNNEL.qualified} qualified, ${FUNNEL.published} published`}
    >
      <div className="flex h-5 items-end justify-between">
        {Array.from({ length: FUNNEL.analysed }).map((_, i) => {
          const rank = PUBLISHED.get(i);
          const published = rank !== undefined;
          const qualified = QUALIFIED_SET.has(i);
          const reading = rank === held;
          return (
            <span
              key={i}
              className={`m-live block w-px ${published ? "bg-accent" : qualified ? "bg-pos" : "bg-ink/[0.13]"}`}
              style={{
                height: published ? (reading ? 20 : 14) : qualified ? 10 : 5,
                opacity: published && !reading ? 0.4 : 1,
              }}
            />
          );
        })}
      </div>
      {/* the engine, passing over the slate */}
      <span
        aria-hidden="true"
        className="m-sweep pointer-events-none absolute inset-y-0 left-0 w-[16%] mix-blend-multiply"
        style={{ background: "linear-gradient(90deg, transparent, rgb(42 85 224 / 0.16), transparent)" }}
      />
    </div>
  );
}

/** A measure in the funnel: a numeral hung under a hairline, never a stat card. */
type Stage = "analysed" | "qualified" | "published";

const STAGE = {
  analysed: { tick: "h-2 bg-ink/25", value: "text-ink-3" },
  qualified: { tick: "h-3 bg-pos", value: "text-ink" },
  published: { tick: "h-4 bg-accent", value: "text-ink" },
} satisfies Record<Stage, { tick: string; value: string }>;

function Measure({ value, label, stage }: { value: number; label: string; stage: Stage }) {
  const tone = STAGE[stage];
  return (
    <div className="relative min-w-[96px] pt-5">
      {/* the measure hangs from the rule above it, marked in its own stage colour */}
      <span className={`absolute left-0 top-0 w-px ${tone.tick}`} />
      <p className={`tnum display text-[32px] leading-none ${tone.value}`}>{value}</p>
      <p className="label mt-2 text-ink-3">{label}</p>
    </div>
  );
}

/* ----------------------------------------------------------------------------
   FEATURED RESEARCH
   Five fixtures, but not five equal cards. The strongest piece of research is
   set as the lead — larger crests, its reasoning stated, its evidence read at
   display size. The other four are supporting research, set compactly beneath
   a rule. Rank is permanent and comes from the evidence score; holding a row
   only moves the instrument. The two signals never compete.
   -------------------------------------------------------------------------- */

/** The rule a group of research sits under. */
function GroupRule({ title, note, tone = "quiet" }: { title: string; note: string; tone?: "published" | "quiet" }) {
  return (
    <div
      className={`flex items-baseline justify-between gap-4 border-t pt-3 ${
        tone === "published" ? "border-accent/35" : "border-ink/[0.16]"
      }`}
    >
      <span className="label text-ink">{title}</span>
      <span className="label text-ink-3">{note}</span>
    </div>
  );
}

/**
 * THE DESCENT
 * The one gesture that joins the two halves: a hairline dropping out of the
 * held fixture's struck tick in the ledger and landing on the rule the
 * published research sits under. It travels when the selection travels, so the
 * list below is read as what the slate above produced.
 */
function Descent({ held }: { held: number }) {
  return (
    <div aria-hidden="true" className="relative h-9">
      <span
        className="absolute top-0 w-px bg-gradient-to-b from-accent/55 to-accent/15 transition-[left] duration-[var(--dur-expand)] ease-[var(--ease-settle)]"
        style={{ left: `${tickX(PUBLISHED_AT[held])}%`, height: 22 }}
      />
      <span
        className="absolute h-px bg-accent/25 transition-[left,width] duration-[var(--dur-expand)] ease-[var(--ease-settle)]"
        style={{
          top: 22,
          left: 0,
          width: `${tickX(PUBLISHED_AT[held])}%`,
        }}
      />
      <span className="absolute left-0 w-px bg-accent/25" style={{ top: 22, height: 14 }} />
    </div>
  );
}

function PickRow({
  pick,
  rank,
  held,
  lead = false,
  onHold,
}: {
  pick: Pick;
  rank: number;
  held: boolean;
  lead?: boolean;
  onHold: () => void;
}) {
  const intent = useIntent(onHold, 90);
  const colour = tinted(pick.league.id, 1);
  const crest = lead ? 40 : 24;

  return (
    <button
      onMouseEnter={intent.enter}
      onMouseLeave={intent.cancel}
      onFocus={onHold}
      onClick={onHold}
      aria-pressed={held}
      className="group relative block w-full overflow-hidden border-b border-line-2 text-left outline-none transition-[border-color,box-shadow] duration-[var(--dur-respond)] ease-[var(--ease-respond)] hover:border-line"
      style={{
        boxShadow: held
          ? `inset 0 1px 0 rgb(255 255 255 / 0.9), 0 8px 28px -22px ${tinted(pick.league.id, 0.95)}`
          : "none",
      }}
    >
      {/* the competition's colour, felt across the held row and nowhere else */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 transition-opacity duration-[var(--dur-expand)] ease-[var(--ease-settle)]"
        style={{
          opacity: held || lead ? 1 : 0,
          background: lead
            ? `linear-gradient(to right, ${tinted(pick.league.id, held ? 0.16 : 0.11)} 0%, ${tinted(
                pick.league.id,
                held ? 0.07 : 0.05,
              )} 24%, transparent 54%)`
            : `linear-gradient(to right, ${tinted(pick.league.id, 0.05)}, transparent 62%)`,
        }}
      />

      {/* ------------------------------------------------------------------
          THE COMPETITION, ON THE LEAD CARD ONLY
          Two layers and no more: the competition's colour banked against the
          left margin, and its official mark set large enough to be read as a
          mark — cropped by a third at the edge, hung above centre, and behind
          everything. The wash is spent before the fixture title begins, so the
          text column is set on paper rather than on colour.
          ------------------------------------------------------------------ */}
      {lead && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 transition-opacity duration-[var(--dur-expand)] ease-[var(--ease-settle)]"
          style={{
            // 40% of the mark falls outside the card: enough to read as a crop,
            // not so much that the crown and mane go with it
            left: -66,
            transform: "translateY(-55%)",
            opacity: held ? 0.115 : 0.095,
          }}
        >
          <Crest id={pick.league.id} name={pick.league.name} kind="league" size={164} />
        </span>
      )}

      {/* the rail that marks the held selection */}
      <span
        className={`absolute left-0 top-0 h-full w-[2px] origin-top transition-transform duration-[var(--dur-expand)] ease-[var(--ease-respond)] ${
          held ? "scale-y-100" : "scale-y-0"
        }`}
        style={{ background: colour }}
      />

      <div
        className={`relative flex gap-4 transition-[padding] duration-[var(--dur-expand)] ease-[var(--ease-respond)] ${
          lead ? "items-start py-6" : "items-center py-3.5"
        } ${held ? "pl-5" : "pl-0 group-hover:pl-2"}`}
      >
        <span
          className={`tnum shrink-0 font-mono transition-colors duration-[var(--dur-respond)] ${
            lead ? "w-8 pt-1 text-[13px]" : "w-6 text-[12px]"
          }`}
          style={{ color: held || lead ? colour : "var(--color-ink-3)" }}
        >
          {String(rank).padStart(2, "0")}
        </span>

        {/* the two clubs, overlapped at rest and parting when held */}
        <span
          className="flex shrink-0 items-center transition-opacity duration-[var(--dur-expand)] ease-[var(--ease-respond)]"
          style={{ opacity: held || lead ? 1 : 0.6 }}
        >
          <Crest id={pick.home.id} name={pick.home.name} size={crest} />
          <span
            className="transition-[margin] duration-[var(--dur-expand)] ease-[var(--ease-respond)]"
            style={{ marginLeft: held ? crest * 0.16 : -crest * 0.3 }}
          >
            <Crest id={pick.away.id} name={pick.away.name} size={crest} />
          </span>
        </span>

        <span className="min-w-0 flex-1">
          <span
            className={`block truncate font-medium ${
              lead ? "text-[22px] tracking-[-0.03em]" : "text-[15px] tracking-[-0.02em]"
            }`}
          >
            {pick.home.name} <span className="text-ink-3">v</span> {pick.away.name}
          </span>
          <span className="mt-1.5 flex items-center gap-2 text-[13px] text-ink-3">
            <Crest id={pick.league.id} name={pick.league.name} kind="league" size={14} />
            <span className="truncate">{pick.league.name}</span>
            {lead && <span className="tnum">· {pick.round} · KO {pick.kickoff}</span>}
          </span>

          {/* the lead states its reasoning; the supporting research does not */}
          {lead && (
            <span className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              {pick.reasons.map((reason, i) => (
                <span key={reason} className="flex items-center gap-3 text-[13px] text-ink-2">
                  {i > 0 && <span className="block h-2.5 w-px bg-line" aria-hidden="true" />}
                  {reason}
                </span>
              ))}
            </span>
          )}
        </span>

        <span className={`shrink-0 text-right ${lead ? "pt-0.5" : ""}`}>
          <span
            className={`tnum block font-medium tracking-[-0.03em] ${lead ? "display text-[36px]" : "text-[17px]"}`}
          >
            {pick.evidence.toFixed(1)}
          </span>
          <span
            className={`mt-2 block h-px bg-ink/[0.12] ${lead ? "w-16" : "w-9"}`}
            aria-hidden="true"
          >
            <span
              className="block h-px origin-right transition-transform duration-[var(--dur-expand)] ease-[var(--ease-settle)]"
              style={{ background: colour, transform: `scaleX(${held || lead ? pick.evidence / 10 : 0})` }}
            />
          </span>
          <span className="tnum mt-2 block whitespace-nowrap text-[13px] text-ink-3">
            {pick.probability}%{lead && ` · ${pick.confidenceLabel.toLowerCase()}`}
          </span>
        </span>
      </div>
    </button>
  );
}

export default function Hero() {
  const stage = useRef<HTMLDivElement | null>(null);
  const [held, setHeld] = useState(0);
  const [seconds, setSeconds] = useState(3);
  const pick = PICKS[held];

  useEffect(() => {
    const id = window.setInterval(() => setSeconds((s) => (s >= 14 ? 1 : s + 1)), 2000);
    return () => window.clearInterval(id);
  }, []);

  // Two planes drift at two rates. Depth, never tilt.
  function handleMove(e: React.MouseEvent<HTMLElement>) {
    const node = stage.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    node.style.setProperty("--px", ((e.clientX - rect.left) / rect.width - 0.5).toFixed(3));
    node.style.setProperty("--py", ((e.clientY - rect.top) / rect.height - 0.5).toFixed(3));
  }
  function handleLeave() {
    stage.current?.style.setProperty("--px", "0");
    stage.current?.style.setProperty("--py", "0");
  }

  const drift = (x: number, y: number) => ({
    transform: `translate3d(calc(var(--px) * ${x}px), calc(var(--py) * ${y}px), 0)`,
    transition: "transform 1600ms var(--ease-respond)",
  });

  return (
    <section
      id="top"
      ref={stage}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      style={{ ["--px" as string]: 0, ["--py" as string]: 0 }}
      className="relative overflow-hidden border-b border-line"
    >
      {/* ------------------------------------------------ plane 1 · ground */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(11,12,14,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(11,12,14,0.04) 1px, transparent 1px)",
          backgroundSize: "112px 112px",
          maskImage: "radial-gradient(80% 70% at 50% 48%, #000 0%, transparent 76%)",
        }}
      />

      {/* the competition's light, felt across the whole stage */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 transition-[background] duration-[var(--dur-resolve)] ease-[var(--ease-settle)]"
        style={{
          background: `radial-gradient(72% 58% at 78% 22%, ${tinted(pick.league.id, 0.075)} 0%, transparent 68%)`,
        }}
      />

      {/* the stage falls away at its edges */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(88% 78% at 50% 44%, transparent 42%, rgb(11 12 14 / 0.05) 100%)" }}
      />

      {/* fine grain, so the surface reads as paper rather than screen */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.035] mix-blend-multiply"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      {/* the clubs of the held selection, crossfading behind the stage */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden lg:block" style={drift(24, 14)}>
        {PICKS.map((p, i) => (
          <div
            key={p.home.id}
            className="absolute inset-0 transition-opacity duration-[var(--dur-reveal)] ease-[var(--ease-settle)]"
            style={{ opacity: i === held ? 1 : 0 }}
          >
            <Crest
              id={p.home.id}
              name={p.home.name}
              size={560}
              className="absolute -right-[10%] top-[6%] opacity-[0.07]"
            />
            <Crest
              id={p.away.id}
              name={p.away.name}
              size={440}
              className="absolute right-[26%] bottom-[2%] opacity-[0.05]"
            />
          </div>
        ))}
      </div>

      <div className="relative mx-auto flex min-h-[86vh] max-w-[1240px] flex-col px-5 pb-16 pt-12 lg:px-8 lg:pb-24 lg:pt-14">
        {/* ------------------------------------------------- the top line */}
        <div className="rise flex flex-wrap items-center gap-x-6 gap-y-2" style={{ animationDelay: "var(--lead)" }}>
          <span className="label flex items-center gap-2.5 text-ink-3">
            <span className="pulse-ring relative inline-flex h-1.5 w-1.5 rounded-full bg-current text-accent" />
            Football, read as evidence
          </span>
          <p className="tnum label ml-auto flex items-center gap-2 text-ink-3">
            Model refreshed <span key={seconds} className="m-tick inline-block">{seconds}</span>s ago
          </p>
        </div>

        {/* --------------------------------------- plane 2 + 3 · the stage */}
        <div className="mt-12 grid items-start gap-x-16 gap-y-16 lg:mt-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.92fr)]">
          {/* the selection */}
          <div style={drift(-6, -4)}>
            <h1
              className="rise display max-w-[13ch] text-[clamp(2.25rem,4.4vw,3.5rem)] font-bold"
              style={{ animationDelay: "260ms" }}
            >
              Today's football has already been researched.
            </h1>

            {/* the standfirst: the first sentence carries, the second explains */}
            <p
              className="rise mt-6 max-w-[46ch] text-[18px] leading-8 text-ink-2"
              style={{ animationDelay: "380ms" }}
            >
              <span className="text-ink">Every fixture kicking off today was scored against the model.</span>{" "}
              Only those that clear the qualification threshold are published — today, five of them.
            </p>

            {/* ----------------------------------------------------------------
                THE PROCESS
                The funnel, the slate and the published research are one block,
                read top to bottom: what we looked at, what survived, what came
                out. Nothing separates them but their own rhythm.
                ---------------------------------------------------------------- */}
            <div className="mt-16">
              <div className="rise" style={{ animationDelay: "500ms" }}>
                <GroupRule title="Today's research funnel" note={`${FUNNEL.analysed} fixtures`} />
              </div>

              <div className="rise mt-6 flex flex-wrap items-start gap-x-12 gap-y-6" style={{ animationDelay: "560ms" }}>
                <Measure value={FUNNEL.analysed} label="Analysed" stage="analysed" />
                <Measure value={FUNNEL.qualified} label="Qualified" stage="qualified" />
                <Measure value={FUNNEL.published} label="Published" stage="published" />
              </div>

              <div className="rise mt-8" style={{ animationDelay: "640ms" }}>
                <Ledger held={held} />
              </div>

              <div className="rise" style={{ animationDelay: "740ms" }}>
                <Descent held={held} />

                <GroupRule
                  tone="published"
                  title="Today's strongest research"
                  note={`1 of ${FUNNEL.published} published`}
                />
                <PickRow pick={PICKS[0]} rank={1} held={held === 0} lead onHold={() => setHeld(0)} />

                <div className="mt-10">
                  <GroupRule
                    title="Supporting research"
                    note={`${PICKS.length - 1} of ${FUNNEL.published} published · ${PICKS[PICKS.length - 1].evidence.toFixed(1)}–${PICKS[1].evidence.toFixed(1)}`}
                  />
                  {PICKS.slice(1).map((p, i) => (
                    <PickRow
                      key={p.home.id}
                      pick={p}
                      rank={i + 2}
                      held={held === i + 1}
                      onHold={() => setHeld(i + 1)}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* the close: the same left-title, right-note balance the rules keep */}
            <div
              className="rise mt-16 flex flex-wrap items-center justify-between gap-x-6 gap-y-4"
              style={{ animationDelay: "860ms" }}
            >
              <a
                href="#today"
                className="m-press inline-flex h-12 max-w-[220px] flex-1 items-center justify-center gap-2.5 rounded-xl bg-ink px-6 text-[15px] font-medium tracking-[-0.01em] text-white outline-none hover:bg-ink/90"
              >
                Explore today's research
                <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
                  <path d="M2.5 8h11m0 0L9.5 4m4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
              <p className="label text-ink-3">
                {FUNNEL.qualified} qualified · {FUNNEL.analysed - FUNNEL.qualified} set aside
              </p>
            </div>
          </div>

          {/* the instrument, reading whichever selection is held */}
          <div className="relative z-10 flex justify-center lg:pt-8" style={drift(8, 5)}>
            {/* the instrument arrives after the narrative has been read, not during it */}
            <div className="rise w-full max-w-[520px]" style={{ animationDelay: "940ms" }}>
              <EvidenceDial
                home={pick.home}
                away={pick.away}
                league={pick.league}
                kickoff={pick.kickoff}
                probability={pick.probability}
                evidence={pick.evidence}
                confidence={pick.confidence}
                confidenceLabel={pick.confidenceLabel}
                signals={pick.signals}
                history={pick.history}
                size={520}
                caption={false}
              />
              {/* the reading, in a slot sized for the longest of them so nothing below ever moves */}
              <div className="relative mx-auto mt-8 min-h-[200px] max-w-[46ch] border-t border-line pt-6">
                <div key={pick.home.id} className="m-fade">
                  <p className="label flex items-center gap-2 text-ink-3">
                    <Crest id={pick.league.id} name={pick.league.name} kind="league" size={13} />
                    {pick.league.name} · {pick.round} · KO {pick.kickoff}
                  </p>

                  {/* why the score is what it is — three reasons, no more */}
                  <ul className="mt-4 grid grid-cols-3 gap-x-4">
                    {pick.reasons.map((reason, i) => (
                      <li key={reason} className="relative pt-3">
                        <span className="absolute left-0 top-0 h-px w-full bg-line-2" />
                        <span
                          className="absolute left-0 top-0 h-1.5 w-px"
                          style={{
                            background: tinted(pick.league.id, 1),
                            opacity: 1 - i * 0.28,
                          }}
                        />
                        <span className="block text-[13px] leading-5 text-ink-2">{reason}</span>
                      </li>
                    ))}
                  </ul>

                  <p className="mt-4 text-[13px] leading-6 text-ink-2">{pick.summary}</p>
                </div>
              </div>

              <a
                href="#today"
                className="group relative mt-6 inline-flex items-center gap-2.5 pb-2.5 text-[13px] font-medium outline-none"
              >
                Open {pick.home.short} v {pick.away.short} research
                <svg viewBox="0 0 16 16" width="13" height="13" fill="none" className="transition-transform duration-[var(--dur-respond)] ease-[var(--ease-respond)] group-hover:translate-x-1.5">
                  <path d="M2.5 8h11m0 0L9.5 4m4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="absolute bottom-0 left-0 h-px w-full bg-line" />
                <span className="absolute bottom-0 left-0 h-px w-full origin-left scale-x-0 bg-accent transition-transform duration-[var(--dur-expand)] ease-[var(--ease-settle)] group-hover:scale-x-100" />
              </a>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}

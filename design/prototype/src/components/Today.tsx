import { useState } from "react";
import Crest from "./Crest";
import { LeagueCue, LeagueWatermark } from "./LeagueMark";
import { toggleFollow, useIsFollowing } from "./follow";
import { tinted, wash } from "./leagues";
import { useReveal, useResolve } from "./motion";

export type TodayFixture = {
  league: { id: number; name: string };
  home: { id: number; name: string; short: string };
  away: { id: number; name: string; short: string };
  kickoff: string;
  score: number;
  probability: number;
  confidence: string;
  status: string;
  signals: number;
  read: string;
};

/* ============================================================================
   TODAY'S INTELLIGENCE
   ----------------------------------------------------------------------------
   Not a board of equal fixtures. A day's research, edited: the strongest piece
   of work in the current view is set as the lead story — competition
   atmosphere, both clubs, the reading in full, its figures hung on a spine —
   and everything else follows as compact entries carrying one fact and one
   line each. The lead is chosen by evidence, exactly as it is upstairs, so the
   two sections are governed by the same rule.
   ========================================================================== */

/** Confidence read as steps on a five-notch scale. */
function confidenceSteps(label: string) {
  switch (label) {
    case "Very High":
      return 5;
    case "High":
      return 4;
    case "Moderate":
      return 3;
    default:
      return 2;
  }
}

/** A figure that is never allowed to appear without saying what it is. */
function Reading({ label, value, tone = "" }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <dt className="label text-ink-3">{label}</dt>
      <dd className={`tnum mt-1.5 text-[22px] font-medium tracking-[-0.03em] ${tone}`}>{value}</dd>
    </div>
  );
}

/** The follow mark: the reader keeps a match, and nothing is asked in return. */
function Follow({ id, compact = false }: { id: string; compact?: boolean }) {
  const following = useIsFollowing(id);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        toggleFollow(id);
      }}
      aria-pressed={following}
      aria-label={following ? "Following this match" : "Follow this match"}
      className="group/f relative flex items-center gap-2.5 outline-none"
    >
      <span
        className={`block h-2 w-2 rotate-45 transition-colors duration-[var(--dur-respond)] ease-[var(--ease-respond)] ${
          following ? "bg-accent" : "bg-ink/20 group-hover/f:bg-ink/45"
        }`}
      />
      {!compact && <span className="label text-ink-2">{following ? "Following" : "Follow"}</span>}
    </button>
  );
}

/* -------------------------------------------------------------- the lead ---
   One story, given the room to be read. No container, no border box: the
   hierarchy is made by the competition's atmosphere, the scale of the type
   and the space around it.
   -------------------------------------------------------------------------- */

function LeadStory({ f }: { f: TodayFixture }) {
  const evidence = useResolve(f.score, 2000, 200);
  const probability = useResolve(f.probability, 2000, 320);
  const id = `${f.home.id}-${f.away.id}`;

  return (
    <article className="relative overflow-hidden border-t border-ink/[0.16] pt-9">
      {/* atmosphere: the competition's colour, then its mark, then the reading */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: wash(f.league.id, 0.09, "56%") }}
      />
      <LeagueWatermark id={f.league.id} name={f.league.name} size={176} opacity={0.1} />

      <div className="relative grid gap-x-12 gap-y-9 lg:grid-cols-[minmax(0,1fr)_212px]">
        <div className="pl-6 lg:pl-10">
          <p className="label flex items-center gap-2.5 text-ink-3">
            <LeagueCue id={f.league.id} />
            <Crest id={f.league.id} name={f.league.name} kind="league" size={14} />
            {f.league.name}
            <span className="tnum">· KO {f.kickoff}</span>
            <span className="flex items-center gap-1.5">
              ·
              <span className={`block h-1.5 w-1.5 rotate-45 ${f.status === "Published" ? "bg-pos" : "bg-ink/30"}`} />
              {f.status}
            </span>
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-4">
            <span className="flex items-center">
              <Crest id={f.home.id} name={f.home.name} size={52} />
              <Crest id={f.away.id} name={f.away.name} size={52} className="ml-2.5" />
            </span>
            <h3 className="display text-[clamp(1.6rem,3vw,2.4rem)]">
              {f.home.name} <span className="text-ink-3">v</span> {f.away.name}
            </h3>
          </div>

          <p className="mt-6 max-w-[64ch] text-[16px] leading-8 text-ink-2">{f.read}</p>

          <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-4 pb-10">
            <a
              href="#featured"
              className="group relative inline-flex items-center gap-2.5 pb-2.5 text-[14px] font-medium outline-none"
            >
              Open {f.home.short} v {f.away.short} research
              <svg viewBox="0 0 16 16" width="13" height="13" fill="none" aria-hidden="true" className="transition-transform duration-[var(--dur-respond)] ease-[var(--ease-respond)] group-hover:translate-x-1.5">
                <path d="M2.5 8h11m0 0L9.5 4m4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="absolute bottom-0 left-0 h-px w-full bg-line" />
              <span
                className="absolute bottom-0 left-0 h-px w-full origin-left scale-x-0 transition-transform duration-[var(--dur-expand)] ease-[var(--ease-settle)] group-hover:scale-x-100"
                style={{ background: tinted(f.league.id, 1) }}
              />
            </a>
            <Follow id={id} />
          </div>
        </div>

        {/* the figures, hung from a spine rather than boxed */}
        <dl className="ml-6 flex flex-col gap-6 self-start border-l border-line pl-6 lg:ml-0 lg:mt-1">
          <Reading label="Evidence" value={evidence.toFixed(1)} tone="text-accent" />
          <Reading label="Probability" value={`${Math.round(probability)}%`} />
          <div>
            <dt className="label text-ink-3">Confidence</dt>
            <dd className="mt-2.5 flex items-center gap-1">
              {[0, 1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className={`block h-[3px] w-4 ${i < confidenceSteps(f.confidence) ? "bg-ink" : "bg-ink/12"}`}
                />
              ))}
              <span className="ml-2 text-[12px] text-ink-2">{f.confidence}</span>
            </dd>
          </div>
          <div>
            <dt className="label text-ink-3">Signals cited</dt>
            <dd className="mt-2.5 flex items-end gap-[3px]">
              {Array.from({ length: f.signals }).map((_, i) => (
                <span key={i} className="block h-3.5 w-[2px] bg-ink" />
              ))}
              <span className="tnum ml-2 font-mono text-[11px] leading-none text-ink-2">{f.signals}</span>
            </dd>
          </div>
        </dl>
      </div>
    </article>
  );
}

/* ------------------------------------------------------- the supporting ---
   One competition, one fixture, one fact, one line, one way in.
   -------------------------------------------------------------------------- */

function Entry({ f }: { f: TodayFixture }) {
  const id = `${f.home.id}-${f.away.id}`;

  return (
    <a
      href="#featured"
      className="group relative block border-b border-line-2 outline-none transition-colors duration-[var(--dur-respond)] ease-[var(--ease-respond)] hover:border-line"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-[var(--dur-expand)] ease-[var(--ease-settle)] group-hover:opacity-100"
        style={{ background: wash(f.league.id, 0.045, "48%") }}
      />
      <span
        aria-hidden="true"
        className="absolute left-0 top-0 h-full w-[2px] origin-top scale-y-0 transition-transform duration-[var(--dur-expand)] ease-[var(--ease-respond)] group-hover:scale-y-100"
        style={{ background: tinted(f.league.id, 1) }}
      />

      <div className="relative grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-6 gap-y-2 py-6 pl-0 pr-1 transition-[padding] duration-[var(--dur-expand)] ease-[var(--ease-respond)] group-hover:pl-4">
        <span className="flex shrink-0 items-center">
          <Crest id={f.home.id} name={f.home.name} size={30} />
          <Crest id={f.away.id} name={f.away.name} size={30} className="ml-1.5" />
        </span>

        <div className="min-w-0">
          <p className="truncate text-[17px] font-medium tracking-[-0.025em]">
            {f.home.name} <span className="text-ink-3">v</span> {f.away.name}
          </p>
          <p className="mt-1.5 flex items-center gap-2 text-[12px] text-ink-3">
            <LeagueCue id={f.league.id} on={false} />
            <Crest id={f.league.id} name={f.league.name} kind="league" size={12} />
            <span className="truncate">{f.league.name}</span>
            <span className="tnum">· KO {f.kickoff}</span>
          </p>
          {/* the one contextual line, kept to a line */}
          <p className="mt-2 max-w-[68ch] truncate text-[13px] leading-6 text-ink-2">{f.read}</p>
        </div>

        <div className="flex shrink-0 items-center gap-6">
          <span className="text-right">
            <span className="label block text-ink-3">Evidence</span>
            <span className="tnum mt-1 block text-[19px] font-medium tracking-[-0.03em]">{f.score.toFixed(1)}</span>
          </span>
          <Follow id={id} compact />
          <svg
            viewBox="0 0 16 16"
            width="14"
            height="14"
            fill="none"
            aria-hidden="true"
            className="text-ink-3 transition-transform duration-[var(--dur-respond)] ease-[var(--ease-respond)] group-hover:translate-x-1"
          >
            <path d="M5.5 3l5 5-5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    </a>
  );
}

export default function Today({ fixtures }: { fixtures: TodayFixture[] }) {
  const [league, setLeague] = useState("All");
  const listRef = useReveal<HTMLDivElement>();

  const tabs = ["All", ...Array.from(new Set(fixtures.map((f) => f.league.name)))];
  const rows = fixtures.filter((f) => league === "All" || f.league.name === league);

  // the lead is the strongest research in view — the same rule as upstairs
  const ordered = [...rows].sort((a, b) => b.score - a.score);
  const [lead, ...rest] = ordered;
  const published = rows.filter((f) => f.status === "Published").length;

  return (
    <section id="today" className="bg-surface">
      <div className="mx-auto max-w-[1240px] px-5 py-24 lg:px-8 lg:py-36">
        <div className="grid gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <h2 className="display text-[clamp(2.2rem,4.4vw,3.4rem)]">Today's intelligence</h2>
            <p className="mt-5 max-w-[52ch] text-[16px] leading-8 text-ink-2">
              The research day as it stands: {rows.length} fixtures in view, {published} of them published, led by the
              strongest evidence on the board.
            </p>
          </div>

          {/* the competition register — crests struck through by a rule */}
          <div className="flex flex-wrap items-end gap-x-7 gap-y-3 lg:justify-end">
            {tabs.map((name) => {
              const on = league === name;
              const crest = fixtures.find((f) => f.league.name === name)?.league;
              return (
                <button
                  key={name}
                  onClick={() => setLeague(name)}
                  aria-pressed={on}
                  className="group relative flex items-center gap-2 pb-2.5 outline-none"
                >
                  {crest ? (
                    <Crest
                      id={crest.id}
                      name={crest.name}
                      kind="league"
                      size={16}
                      className={`transition-opacity duration-[var(--dur-respond)] ${on ? "opacity-100" : "opacity-45 group-hover:opacity-80"}`}
                    />
                  ) : (
                    <span className={`block h-1.5 w-1.5 rotate-45 transition-colors ${on ? "bg-accent" : "bg-ink/25"}`} />
                  )}
                  <span
                    className={`text-[12px] transition-colors duration-[var(--dur-respond)] ${
                      on ? "text-ink" : "text-ink-3 group-hover:text-ink-2"
                    }`}
                  >
                    {name}
                  </span>
                  {/* the register underlines each competition in its own colour */}
                  <span
                    className={`absolute bottom-0 left-0 h-px w-full origin-left transition-transform duration-[var(--dur-expand)] ease-[var(--ease-respond)] ${
                      on ? "scale-x-100" : "scale-x-0"
                    }`}
                    style={{ background: crest ? tinted(crest.id, 1) : "var(--color-ink)" }}
                  />
                </button>
              );
            })}
          </div>
        </div>

        <div ref={listRef} className="reveal mt-14">
          <p className="label mb-4 text-ink-3">The lead story</p>
          <LeadStory key={lead.home.id} f={lead} />

          {rest.length > 0 && (
            <div className="mt-16">
              <div className="flex items-baseline justify-between gap-4 border-t border-ink/[0.16] pt-3">
                <span className="label text-ink">Also under research</span>
                <span className="label text-ink-3">{rest.length} fixtures</span>
              </div>
              {rest.map((f) => (
                <Entry key={f.home.id} f={f} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

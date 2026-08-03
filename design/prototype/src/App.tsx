import Crest from "./components/Crest";
import EvidenceBeam from "./components/EvidenceBeam";
import Hero from "./components/Hero";
import Kickoff from "./components/Kickoff";
import { LeagueCue, LeagueWatermark } from "./components/LeagueMark";
import Today from "./components/Today";
import { useFollowing } from "./components/follow";
import { tinted, wash } from "./components/leagues";
import { DUR, useReveal, useResolveOnView } from "./components/motion";

/* ------------------------------------------------------------------ data */

type Team = { id: number; name: string; short: string };

const T: Record<string, Team> = {
  arsenal: { id: 42, name: "Arsenal", short: "ARS" },
  newcastle: { id: 34, name: "Newcastle United", short: "NEW" },
  city: { id: 50, name: "Manchester City", short: "MCI" },
  brighton: { id: 51, name: "Brighton", short: "BHA" },
  liverpool: { id: 40, name: "Liverpool", short: "LIV" },
  chelsea: { id: 49, name: "Chelsea", short: "CHE" },
  madrid: { id: 541, name: "Real Madrid", short: "RMA" },
  atletico: { id: 530, name: "Atletico Madrid", short: "ATM" },
  barcelona: { id: 529, name: "Barcelona", short: "BAR" },
  bayern: { id: 157, name: "Bayern Munich", short: "BAY" },
  leverkusen: { id: 168, name: "Bayer Leverkusen", short: "B04" },
  inter: { id: 505, name: "Inter", short: "INT" },
  napoli: { id: 492, name: "Napoli", short: "NAP" },
  juventus: { id: 496, name: "Juventus", short: "JUV" },
  psg: { id: 85, name: "Paris Saint Germain", short: "PSG" },
  dortmund: { id: 165, name: "Borussia Dortmund", short: "BVB" },
};

type Fixture = {
  league: { id: number; name: string };
  home: Team;
  away: Team;
  kickoff: string;
  score: number;
  probability: number;
  confidence: "Very High" | "High" | "Moderate";
  status: "Published" | "In review" | "Live";
  signals: number;
  read: string;
};

const FIXTURES: Fixture[] = [
  {
    league: { id: 39, name: "Premier League" },
    home: T.arsenal,
    away: T.newcastle,
    kickoff: "20:00",
    score: 9.4,
    probability: 72,
    confidence: "Very High",
    status: "Published",
    signals: 3,
    read: "Arsenal's left-side overloads meet a Newcastle block that has conceded 2.1 xG per away match since December.",
  },
  {
    league: { id: 140, name: "La Liga" },
    home: T.madrid,
    away: T.atletico,
    kickoff: "21:00",
    score: 8.7,
    probability: 64,
    confidence: "High",
    status: "Published",
    signals: 4,
    read: "Derby set-piece volume is the decisive variable — Atletico rank first for dead-ball xG across the last ten rounds.",
  },
  {
    league: { id: 135, name: "Serie A" },
    home: T.inter,
    away: T.napoli,
    kickoff: "19:45",
    score: 8.2,
    probability: 58,
    confidence: "High",
    status: "In review",
    signals: 3,
    read: "Inter's wing-back progression is being met by the league's most compact mid-block. Chance quality falls for both sides.",
  },
  {
    league: { id: 78, name: "Bundesliga" },
    home: T.leverkusen,
    away: T.dortmund,
    kickoff: "18:30",
    score: 7.9,
    probability: 61,
    confidence: "High",
    status: "Published",
    signals: 2,
    read: "Leverkusen press triggers have forced 14 high turnovers per match; Dortmund's build-up remains the league's most error-prone.",
  },
  {
    league: { id: 2, name: "Champions League" },
    home: T.city,
    away: T.psg,
    kickoff: "20:00",
    score: 7.4,
    probability: 55,
    confidence: "Moderate",
    status: "In review",
    signals: 3,
    read: "Two sides that dominate possession volume. The model resolves this on rest-defence quality rather than attacking output.",
  },
];

const LIVE = [
  {
    league: { id: 39, name: "Premier League" },
    home: T.liverpool,
    away: T.chelsea,
    minute: 67,
    hs: 2,
    as: 1,
    hxg: 1.84,
    axg: 0.92,
    momentum: 68,
    live: 71,
    shift: 14,
    read: "Chelsea's line has dropped 8 metres since the hour. The model now expects the third goal to come from Liverpool's right.",
  },
  {
    league: { id: 140, name: "La Liga" },
    home: T.barcelona,
    away: T.atletico,
    minute: 34,
    hs: 0,
    as: 0,
    hxg: 0.61,
    axg: 0.44,
    momentum: 57,
    live: 48,
    shift: -9,
    read: "Nine shots, none from inside the six-yard box. Barcelona are dominating territory the model does not value.",
  },
  {
    league: { id: 135, name: "Serie A" },
    home: T.juventus,
    away: T.napoli,
    minute: 81,
    hs: 1,
    as: 2,
    hxg: 0.98,
    axg: 1.77,
    momentum: 29,
    live: 12,
    shift: -38,
    read: "Napoli have out-created Juventus by 0.79 xG since the break. The published call is losing, and stays published.",
  },
];

const FEATURED = [
  { fixture: FIXTURES[0], ev: "+8.4%", odds: "1.72", angle: "Arsenal draw no bet", published: "6 days ago", then: "2.10" },
  { fixture: FIXTURES[1], ev: "+6.1%", odds: "2.05", angle: "Over 2.5 goals", published: "4 days ago", then: "2.38" },
  { fixture: FIXTURES[3], ev: "+5.3%", odds: "1.88", angle: "Leverkusen to win", published: "9 days ago", then: "2.25" },
];

const METRICS = [
  { label: "Published", value: 4218, decimals: 0, suffix: "", note: "Research notes since 2020", audit: "2,106 on European league football. The oldest note is still online, unedited." },
  { label: "Settled", value: 3964, decimals: 0, suffix: "", note: "Outcomes archived in full", audit: "254 fixtures are still open. Every settlement is timestamped against the closing price." },
  { label: "Win rate", value: 58.4, decimals: 1, suffix: "%", note: "Rolling 12 months", audit: "2,314 won · 1,650 lost. The losing 1,650 are linked from this page." },
  { label: "ROI", value: 11.7, decimals: 1, suffix: "%", note: "Level stakes, after closing", audit: "Worst month: −6.2%, November 2024. It is in the log with the rest." },
  { label: "Average odds", value: 1.94, decimals: 2, suffix: "", note: "Across settled research", audit: "We publish the price we could actually get, not the best in the market." },
];

/* ------------------------------------------------------------------------
   ELEMENTS
   Nothing here is a card, a badge, a pill or a button. Every element is a
   drawn instrument: hairlines, ticks, tallies, numerals hung off a rule.
   ------------------------------------------------------------------------ */

function Arrow({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true" className={className}>
      <path d="M2.5 8h11m0 0L9.5 4m4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Scroll entrance. `i` staggers siblings by one rhythm unit. */
function Reveal({ children, i = 0, className = "" }: { children: React.ReactNode; i?: number; className?: string }) {
  const ref = useReveal<HTMLDivElement>();
  return (
    <div ref={ref} className={`reveal ${className}`} style={{ ["--i" as string]: i }}>
      {children}
    </div>
  );
}

function Pulse({ tone = "live" }: { tone?: "live" | "accent" }) {
  const color = tone === "live" ? "text-live" : "text-accent";
  return <span className={`relative inline-flex h-1.5 w-1.5 shrink-0 rounded-full bg-current ${color} pulse-ring`} />;
}

/**
 * An action, drawn rather than boxed: a struck rule that the accent redraws
 * from the left, with a plumb tick anchoring it to the grid.
 */
function Trigger({
  href,
  children,
  dark = false,
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  dark?: boolean;
  className?: string;
}) {
  return (
    <a
      href={href}
      className={`group relative inline-flex items-center gap-3 pb-3 pr-1 pt-1 outline-none ${className}`}
    >
      <span
        className={`h-2.5 w-px transition-colors duration-[var(--dur-respond)] ${
          dark ? "bg-white/30 group-hover:bg-accent" : "bg-line group-hover:bg-accent"
        }`}
      />
      <span className={`label ${dark ? "text-white" : "text-ink"}`}>{children}</span>
      <Arrow className="transition-transform duration-[var(--dur-respond)] ease-[var(--ease-respond)] group-hover:translate-x-1.5" />
      <span className={`absolute bottom-0 left-0 h-px w-full ${dark ? "bg-white/20" : "bg-line"}`} />
      <span className="absolute bottom-0 left-0 h-px w-full origin-left scale-x-0 bg-accent transition-transform duration-[var(--dur-expand)] ease-[var(--ease-settle)] group-hover:scale-x-100" />
    </a>
  );
}

/**
 * The reader's own matchday, counted in the header. It appears only once they
 * have marked something — the page never asks, it just starts keeping.
 */
function FollowingCount() {
  const following = useFollowing();
  if (following.length === 0) return null;
  return (
    <a href="#next" className="group flex items-center gap-2.5 text-[13px] text-ink-2 transition-colors duration-[var(--dur-respond)] hover:text-ink">
      <span className="flex items-end gap-[3px]" aria-hidden="true">
        {following.slice(0, 6).map((id, i) => (
          <span key={id} className="block w-px bg-accent" style={{ height: i % 2 ? 13 : 9 }} />
        ))}
      </span>
      <span className="tnum">
        {following.length} match{following.length === 1 ? "" : "es"} followed
      </span>
    </a>
  );
}

/** A counted quantity, notched rather than written. */
function Tally({ n, tone = "ink" }: { n: number; tone?: "ink" | "white" }) {
  return (
    <span className="flex items-end gap-[3px]" aria-hidden="true">
      {Array.from({ length: n }).map((_, i) => (
        <span
          key={i}
          className={`block w-px transition-all duration-[var(--dur-expand)] ease-[var(--ease-respond)] ${
            tone === "white" ? "bg-white/35" : "bg-ink/25"
          }`}
          style={{ height: i % 5 === 4 ? 14 : 9, transitionDelay: `${i * 48}ms` }}
        />
      ))}
    </span>
  );
}

/** Momentum as a lit fan of ticks — the shape a stadium reads at a glance. */
function Fan({ value, count = 26 }: { value: number; count?: number }) {
  const lit = Math.round((value / 100) * count);
  return (
    <span className="flex items-end gap-[3px]" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className={`block w-[2px] rounded-full transition-colors duration-[var(--dur-live)] ease-[var(--ease-glide)] ${
            i < lit ? "bg-white" : "bg-white/15"
          }`}
          style={{ height: 6 + Math.sin((i / count) * Math.PI) * 12, transitionDelay: `${i * 42}ms` }}
        />
      ))}
    </span>
  );
}

/**
 * A live match row. It is a door, not a readout: the score and the momentum
 * are free, but the model's in-play call is withheld until you reach for it.
 */
function LiveRow({ m }: { m: (typeof LIVE)[number] }) {
  const clock = useResolveOnView(m.minute / 90, 4, DUR.resolve);
  const swingRamp = useResolveOnView(1, 4, DUR.resolve);
  const fanRamp = useResolveOnView(m.momentum, 0, DUR.resolve);

  const run = parseFloat(clock.text);
  const swing = (m.hxg - m.axg) * parseFloat(swingRamp.text);
  const reach = Math.min(48, Math.abs(swing) * 22);

  return (
    <a
      href="#today"
      className="group relative block border-b border-white/12 pl-0 pr-1 transition-[padding] duration-[var(--dur-expand)] ease-[var(--ease-respond)] hover:pl-6"
    >
      <span className="absolute left-0 top-0 h-full w-px origin-top scale-y-0 bg-live transition-transform duration-[var(--dur-expand)] ease-[var(--ease-respond)] group-hover:scale-y-100" />

      <div className="grid items-center gap-6 py-8 lg:grid-cols-[132px_1fr_190px_200px]">
        {/* the clock, drawn as a run of ninety */}
        <div>
          <p className="tnum flex items-center gap-2 font-mono text-[13px] text-live">
            <Pulse /> <span ref={clock.ref}>{m.minute}</span>&apos;
          </p>
          <span className="mt-3 flex h-px w-full bg-white/15">
            <span className="m-live block h-px bg-live" style={{ width: `${run * 100}%` }} />
          </span>
          {/* on the dark plate a wash would go muddy, so identity stays a cue */}
          <p className="label mt-3 flex items-center gap-2 text-white/35">
            <span
              aria-hidden="true"
              className="block h-2.5 w-[2px] shrink-0"
              style={{ background: tinted(m.league.id, 1), filter: "brightness(2.2) saturate(1.4)" }}
            />
            <Crest id={m.league.id} name={m.league.name} kind="league" size={12} className="opacity-70 invert" />
            {m.league.name}
          </p>
        </div>

        {/* the fixture, scoreline set as the largest thing on the row */}
        <div className="flex items-center gap-5">
          <Crest id={m.home.id} name={m.home.name} size={38} className="m-breathe" />
          <p className="tnum display text-[34px] leading-none">
            <span key={`h${m.hs}`} className="m-tick inline-block">{m.hs}</span>
            <span className="mx-3 align-middle text-[18px] text-white/25">—</span>
            <span key={`a${m.as}`} className="m-tick inline-block">{m.as}</span>
          </p>
          <Crest id={m.away.id} name={m.away.name} size={38} className="m-breathe-slow" />
          <p className="hidden text-[15px] font-medium tracking-[-0.02em] text-white/70 xl:block">
            {m.home.short} <span className="text-white/30">v</span> {m.away.short}
          </p>
        </div>

        {/* chance quality, hung off a centre line */}
        <div>
          <span ref={swingRamp.ref} className="sr-only" aria-hidden="true" />
          <p className="label flex justify-between text-white/35">
            <span className="tnum">{m.hxg.toFixed(2)}</span>
            <span>xG</span>
            <span className="tnum">{m.axg.toFixed(2)}</span>
          </p>
          <div className="relative mt-3 h-[3px] w-full bg-white/12">
            <span className="absolute left-1/2 top-[-4px] h-[11px] w-px bg-white/30" />
            <span
              className="m-live absolute top-0 h-[3px] bg-white"
              style={{ left: swing >= 0 ? "50%" : `${50 - reach}%`, width: `${reach}%` }}
            />
          </div>
        </div>

        {/* momentum */}
        <div className="lg:justify-self-end lg:text-right">
          <p className="label mb-3 text-white/35">
            Momentum <span className="tnum ml-2 text-white/70">{m.momentum}%</span>
          </p>
          <span ref={fanRamp.ref} className="inline-block">
            <Fan value={parseFloat(fanRamp.text)} />
          </span>
        </div>
      </div>

      {/* the withheld part: the model's live call, and what it has done since KO */}
      <div className="grid transition-[grid-template-rows,opacity] duration-[var(--dur-expand)] ease-[var(--ease-respond)] grid-rows-[0fr] opacity-0 group-hover:mb-8 group-hover:grid-rows-[1fr] group-hover:opacity-100 group-focus-visible:mb-8 group-focus-visible:grid-rows-[1fr] group-focus-visible:opacity-100">
        <div className="overflow-hidden">
          <div className="flex flex-wrap items-end gap-x-10 gap-y-5 border-t border-white/12 pt-6">
            <span>
              <span className="label block text-white/35">In-play call</span>
              <span className="tnum display mt-2 block text-[30px]">
                {m.live}
                <span className="text-[0.45em] align-super text-white/40">%</span>
              </span>
            </span>
            <span>
              <span className="label block text-white/35">Since kickoff</span>
              <span
                className={`tnum mt-2 block text-[18px] font-medium ${m.shift >= 0 ? "text-white" : "text-live"}`}
              >
                {m.shift > 0 ? "+" : ""}
                {m.shift} pts
              </span>
            </span>
            <p className="max-w-[52ch] flex-1 text-[14px] leading-6 text-white/60">{m.read}</p>
            <span className="label flex items-center gap-2 text-white">
              Follow live
              <Arrow className="transition-transform duration-[var(--dur-respond)] ease-[var(--ease-respond)] group-hover:translate-x-1.5" />
            </span>
          </div>
        </div>
      </div>
    </a>
  );
}

/**
 * A record figure. The number is a claim; touching it produces the evidence
 * behind the claim, including the part that doesn't flatter us.
 */
function Figure({ metric, index }: { metric: (typeof METRICS)[number]; index: number }) {
  const { ref, text } = useResolveOnView(metric.value, metric.decimals);
  return (
    <a href="#today" className="group relative block flex-1 pt-6 outline-none">
      <span className="absolute left-0 top-0 h-px w-full bg-line" />
      <span className="absolute left-0 top-0 h-px w-full origin-left scale-x-0 bg-ink transition-transform duration-[var(--dur-reveal)] ease-[var(--ease-settle)] group-hover:scale-x-100" />
      <span
        className="absolute left-0 top-0 w-px bg-ink transition-all duration-[var(--dur-respond)] group-hover:h-4"
        style={{ height: 9 }}
      />
      <p className="tnum label pl-4 text-ink-3">
        {metric.label}
      </p>
      <p className="tnum display mt-6 pl-4 text-[clamp(2.4rem,4.4vw,3.6rem)] transition-transform duration-[var(--dur-expand)] ease-[var(--ease-respond)] group-hover:-translate-y-0.5">
        <span ref={ref}>{text}</span>
        <span className="text-ink-3">{metric.suffix}</span>
      </p>

      {/* the claim, and beneath it the audit — swapped in the same space */}
      <div className="relative mt-3 pl-4">
        <p className="max-w-[18ch] text-[13px] leading-5 text-ink-2 transition-opacity duration-[var(--dur-respond)] group-hover:opacity-0">
          {metric.note}
        </p>
        <p className="pointer-events-none absolute inset-0 max-w-[26ch] text-[13px] leading-5 text-ink opacity-0 transition-opacity duration-[var(--dur-expand)] ease-[var(--ease-settle)] group-hover:opacity-100">
          {metric.audit}
        </p>
      </div>

    </a>
  );
}

/* ------------------------------------------------------------------ page */

export default function App() {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      {/* nav — a rule, a register of destinations, one struck action */}
      <header className="sticky top-0 z-50 border-b border-line/80 bg-canvas/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between px-5 lg:px-8">
          <a href="#top" className="group flex items-center gap-2.5 text-[15px] font-semibold tracking-[-0.03em]">
            <span className="flex h-4 items-end gap-[2px]" aria-hidden="true">
              <span className="block w-[2px] bg-ink transition-all duration-[var(--dur-respond)] group-hover:h-4" style={{ height: 7 }} />
              <span className="block w-[2px] bg-ink transition-all duration-[var(--dur-respond)] group-hover:h-2.5" style={{ height: 12 }} />
              <span className="block w-[2px] bg-accent transition-all duration-[var(--dur-respond)] group-hover:h-4" style={{ height: 16 }} />
            </span>
            RankWagers
          </a>
          <nav aria-label="Primary" className="hidden items-center gap-8 text-[13px] text-ink-2 md:flex">
            {[
              ["Today", "#today"],
              ["Live", "#live"],
              ["Record", "#performance"],
            ].map(([label, href]) => (
              <a
                key={href}
                href={href}
                className="relative py-1 transition-colors duration-[var(--dur-respond)] hover:text-ink"
              >
                {label}
                <span className="absolute -bottom-0.5 left-0 h-px w-full origin-left scale-x-0 bg-ink transition-transform duration-[var(--dur-respond)] ease-[var(--ease-respond)] hover:scale-x-100" />
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-7">
            <FollowingCount />
            <Trigger href="#next" className="-mb-2">The next match</Trigger>
          </div>
        </div>
      </header>

      <Hero />

      <Today fixtures={FIXTURES} />

      {/* 03 — live: one continuous wire, not three cards */}
      <section id="live" className="bg-ink text-white">
        <div className="mx-auto max-w-[1240px] px-5 py-16 lg:px-8 lg:py-24">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="label flex items-center gap-2 text-white/45">
                <Pulse /> Live now
              </p>
              <h2 className="display mt-4 text-[clamp(2.2rem,4.4vw,3.4rem)]">Live football</h2>
            </div>
            <p className="max-w-[36ch] text-[14px] leading-6 text-white/55">
              The score is free. Reach for a match and it gives up the model’s in-play call, and how far it has moved since kickoff.
            </p>
          </div>

          <Reveal className="mt-14">
            <div className="border-t border-white/12">
              {LIVE.map((m) => (
                <LiveRow key={m.home.id} m={m} />
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* 04 — featured research: three plates, each one a full-width reading */}
      <section id="featured">
        <div className="mx-auto max-w-[1240px] px-5 py-24 lg:px-8 lg:py-36">
          <p className="label text-ink-3">Featured research</p>
          <h2 className="display mt-4 max-w-[18ch] text-[clamp(2.2rem,4.4vw,3.4rem)]">
            Three matches worth your attention
          </h2>

          <div className="mt-14 border-t border-line">
            {FEATURED.map(({ fixture: f, ev, odds, angle, published, then }, fi) => (
              <Reveal key={f.home.id} i={fi}>
                <article className="group relative grid gap-8 overflow-hidden border-b border-line py-12 lg:grid-cols-[64px_1fr_300px] lg:gap-12">
                  {/* the competition, cropped by the left margin of the plate */}
                  <LeagueWatermark id={f.league.id} name={f.league.name} size={340} opacity={0.055} />

                  {/* its colour, arriving only when the plate is approached */}
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-[var(--dur-expand)] ease-[var(--ease-settle)] group-hover:opacity-100"
                    style={{ background: wash(f.league.id, 0.05) }}
                  />

                  {/* the plumb line that draws down the plate, in the competition's colour */}
                  <span
                    className="absolute left-0 top-0 h-full w-px origin-top scale-y-0 transition-transform duration-[var(--dur-expand)] ease-[var(--ease-respond)] group-hover:scale-y-100"
                    style={{ background: tinted(f.league.id, 1) }}
                  />

                  <p className="tnum display relative pl-5 text-[34px] text-ink-3 transition-colors duration-[var(--dur-respond)] group-hover:text-ink lg:pl-6">
                    {String(fi + 1).padStart(2, "0")}
                  </p>

                  <div className="relative pl-5 lg:pl-0">
                    <p className="label flex items-center gap-2 text-ink-3">
                      <LeagueCue id={f.league.id} />
                      <Crest id={f.league.id} name={f.league.name} kind="league" size={13} />
                      {f.league.name} · KO {f.kickoff}
                    </p>

                    {/* crests overlap at rest and part on approach */}
                    <div className="mt-6 flex items-center gap-6">
                      <span className="flex items-center">
                        <Crest
                          id={f.home.id}
                          name={f.home.name}
                          size={56}
                          className="m-breathe relative z-10 transition-transform duration-[var(--dur-expand)] ease-[var(--ease-respond)] group-hover:-translate-x-1"
                        />
                        <Crest
                          id={f.away.id}
                          name={f.away.name}
                          size={56}
                          className="m-breathe-slow -ml-4 transition-transform duration-[var(--dur-expand)] ease-[var(--ease-respond)] group-hover:translate-x-2"
                        />
                      </span>
                      <h3 className="display text-[clamp(1.5rem,2.6vw,2rem)]">
                        {f.home.name} <span className="text-ink-3">v</span> {f.away.name}
                      </h3>
                    </div>

                    <p className="mt-6 max-w-[62ch] text-[15px] leading-7 text-ink-2">{f.read}</p>

                    <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3">
                      <Trigger href="#today">Open research</Trigger>
                      <p className="label text-ink-3">
                        Angle <span className="ml-2 text-[13px] normal-case tracking-normal text-ink-2">{angle}</span>
                        <span className="tnum ml-2 text-[13px] tracking-normal text-ink-3">@ {odds}</span>
                      </p>
                    </div>

                    {/* the quiet thrill of having been early */}
                    <p className="tnum mt-6 border-l border-line pl-4 text-[13px] leading-6 text-ink-2">
                      Published <span className="text-ink">{published}</span>, when the price was {then}. It is{" "}
                      {odds} now.
                    </p>
                  </div>

                  {/* the reading, hung from a hairline spine */}
                  <dl className="relative ml-5 border-l border-line pl-6 lg:ml-0">
                    {[
                      { k: "Evidence", v: f.score.toFixed(1), tone: "text-accent" },
                      { k: "Probability", v: `${f.probability}%`, tone: "" },
                      { k: "Expected value", v: ev, tone: "text-pos" },
                    ].map((row, ri) => (
                      <div key={row.k} className={ri === 0 ? "" : "mt-6"}>
                        <dt className="label text-ink-3">{row.k}</dt>
                        <dd className={`tnum display mt-1.5 text-[30px] ${row.tone}`}>{row.v}</dd>
                      </div>
                    ))}
                    <div className="mt-6">
                      <dt className="label text-ink-3">Signals cited</dt>
                      <dd className="mt-2.5">
                        <Tally n={f.signals} />
                      </dd>
                    </div>
                  </dl>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 05 — the evidence beam */}
      <section id="dial" className="border-t border-line bg-canvas">
        <div className="mx-auto max-w-[1240px] px-5 py-20 lg:px-8 lg:py-28">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="label text-ink-3">The instrument</p>
              <h2 className="display mt-4 max-w-[20ch] text-[clamp(2.2rem,4.4vw,3.4rem)]">
                Every match is a balance
              </h2>
            </div>
            <p className="max-w-[42ch] text-[14px] leading-6 text-ink-2">
              Signals are weights on a beam. Lift one — hover it — and the beam re-settles to what the model would have said
              without that evidence.
            </p>
          </div>

          <Reveal className="mt-14">
            <EvidenceBeam
              home={T.arsenal}
              away={T.newcastle}
              league={{ id: 39, name: "Premier League" }}
              kickoff="20:00"
              probability={72}
              evidence={9.4}
              confidence={4}
              confidenceLabel="Very high"
              signals={[
                { name: "Left-side overload", delta: 6.4, lean: 84, detail: "41% of Arsenal chances arrive from the left half-space." },
                { name: "Rest-defence exposure", delta: 4.8, lean: 71, detail: "Newcastle concede 2.1 xG per away match since December." },
                { name: "Set-piece delta", delta: -2.1, lean: 38, detail: "Newcastle hold a dead-ball edge worth 0.41 xG per match." },
              ]}
              history={[
                { at: 61, result: "win" },
                { at: 44, result: "loss" },
                { at: 70, result: "win" },
                { at: 55, result: "win" },
                { at: 38, result: "loss" },
                { at: 66, result: "win" },
                { at: 74, result: "win" },
                { at: 49, result: "win" },
              ]}
            />
          </Reveal>
        </div>
      </section>

      {/* 06 — performance: figures measured off a shared rule */}
      <section id="performance" className="border-t border-line bg-surface">
        <div className="mx-auto max-w-[1240px] px-5 py-16 lg:px-8 lg:py-24">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="label text-ink-3">Performance</p>
              <h2 className="display mt-4 text-[clamp(2.2rem,4.4vw,3.4rem)]">The whole record</h2>
            </div>
            <p className="max-w-[38ch] text-[14px] leading-6 text-ink-2">
              Every figure here is a claim. Touch one and it shows you its working — including the 1,650 notes that lost.
            </p>
          </div>

          <div className="mt-14 flex flex-col gap-10 sm:flex-row sm:flex-wrap sm:gap-x-8 lg:flex-nowrap">
            {METRICS.map((m, i) => (
              <Reveal key={m.label} i={i} className="min-w-[168px] flex-1">
                <Figure metric={m} index={i} />
              </Reveal>
            ))}
          </div>

          <p className="mt-16 max-w-[62ch] text-[15px] leading-7 text-ink-2">
            Nothing here is edited after kickoff. The 1,650 notes that lost are online in the same form they were
            published, alongside the 2,314 that won.
          </p>
          <Trigger href="#today" className="mt-2">Open the settled log</Trigger>
        </div>
      </section>

      <Kickoff
        home={T.city}
        away={T.psg}
        league={{ id: 2, name: "Champions League" }}
        kickoff="20:00"
        venue="Etihad Stadium"
        round="Quarter-final, first leg"
      />

      {/* footer — a wordmark and one sentence. Nothing to index. */}
      <footer className="bg-ink text-white">
        <div className="mx-auto max-w-[1240px] px-5 py-16 lg:px-8 lg:py-20">
          <p className="display text-[clamp(3rem,11vw,9rem)] leading-[0.86]">RankWagers</p>

          <div className="mt-14 flex flex-wrap items-end justify-between gap-8 border-t border-white/10 pt-8 text-[12px] text-white/40">
            <p className="max-w-[40ch] leading-6">
              Research, not betting advice. Every probability, signal and settled result is published in the open. 18+.
            </p>
            <p className="tnum flex items-center gap-2">
              <Pulse tone="accent" /> Data refreshed 12 seconds ago
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

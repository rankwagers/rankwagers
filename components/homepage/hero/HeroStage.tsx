"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import type { Locale } from "@/lib/i18n";
import type { HeroFunnel, HeroPick, HomepageHeroModel } from "@/lib/homepage/types";
import type { ResearchStage } from "@/lib/research/researchRun";
import { SectionTrackLink } from "@/components/analytics/SectionTrackLink";
import { Crest } from "./Crest";
import { EvidenceDial } from "./EvidenceDial";
import { tinted } from "./leagueTint";
import { useIntent, usePointerDrift } from "./motion";

/* ============================================================================
   TODAY'S SELECTION
   ----------------------------------------------------------------------------
   The hero does not stage one fixture. It stages the act of choosing.

     left    the funnel — what qualified — and beneath it the ranked selection
     right   the Evidence Dial, which reads whichever selection is being held
     back    the two clubs of the held selection, crossfading behind it all

   Nothing here is decorative. Moving down the list moves the instrument.

   DATA GATING (Sprint 1)
   ----------------------
   Three elements of the approved composition need a backend that does not
   exist yet and are therefore not drawn:

     · the ledger (one hairline per fixture analysed) and the descent that
       connects it to the list — both are the `analysed` population at full
       resolution, and that population is not observable from the daily lists
     · the evidence score, its bar and the lead's three stated reasons
     · the reading summary beneath the dial

   Every one is a `null` on `HeroPick`, and every surrounding measurement —
   grid, rhythm, the dial's reserved reading slot — is unchanged, so enabling
   the Sprint 23B evidence model fills them in without moving anything.
   ========================================================================== */

type Copy = {
  eyebrow: string;
  updated: string;
  title: string;
  lede: string;
  ledeRest: string;
  funnelTitle: string;
  funnelNote: string;
  funnelAnalysed: string;
  funnelValidated: string;
  funnelInScope: string;
  funnelQualified: string;
  funnelFeatured: string;
  leadTitle: string;
  leadNote: string;
  supportingTitle: string;
  supportingNote: string;
  cta: string;
  empty: string;
  /** Template carrying `{home}` and `{away}`. */
  openResearch: string;
  /**
   * The product's approved qualifier for a model probability. Travels with the figure so the
   * reading cannot be encountered without the sentence that bounds it.
   */
  probabilityNote: string;
};

/**
 * The one template this component resolves itself, because the label depends on which fixture is
 * held. Deliberately not `formatDict`: that helper lives in the dictionary module, and importing
 * it here would pull every locale's strings into the client bundle for a two-token substitution.
 */
function fill(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce((out, [key, value]) => out.replaceAll(`{${key}}`, value), template);
}

/** Two planes drift at two rates. Depth, never tilt. */
function drift(x: number, y: number): CSSProperties {
  return {
    transform: `translate3d(calc(var(--px, 0) * ${x}px), calc(var(--py, 0) * ${y}px), 0)`,
    transition: "transform 1600ms var(--ease-respond)",
  };
}

/** The rule a group of research sits under. */
function GroupRule({
  title,
  note,
  tone = "quiet",
}: {
  title: string;
  note: string;
  tone?: "published" | "quiet";
}) {
  return (
    <div
      className="flex items-baseline justify-between gap-4 border-t pt-3"
      style={{
        borderColor: tone === "published" ? "rgb(42 85 224 / 0.35)" : "rgb(11 12 14 / 0.16)",
      }}
    >
      <span className="rw-label text-[var(--hero-ink)]">{title}</span>
      <span className="rw-label text-[var(--hero-ink-3)]">{note}</span>
    </div>
  );
}

/**
 * The funnel's steps, in pipeline order, paired with the copy key that labels each.
 *
 * Declared as data so the row is built by filtering observations rather than by a chain of
 * conditionals — which is what keeps "omit a null stage" a single rule with one implementation
 * instead of one `&&` per stage that a later edit can get wrong.
 */
const FUNNEL_STEPS = [
  { stage: "analysed", label: "funnelAnalysed" },
  { stage: "validated", label: "funnelValidated" },
  { stage: "inScope", label: "funnelInScope" },
  { stage: "qualified", label: "funnelQualified" },
  { stage: "featured", label: "funnelFeatured" },
] as const satisfies ReadonlyArray<{
  stage: keyof HeroFunnel & ResearchStage;
  label: keyof Copy;
}>;

/** A measure in the funnel: a numeral hung under a hairline, never a stat card. */
function Measure({ value, label }: { value: number; label: string }) {
  return (
    <div className="relative min-w-[96px] pt-5">
      {/* the measure hangs from the rule above it, marked in its own stage colour */}
      <span className="absolute left-0 top-0 h-3 w-px bg-[var(--hero-pos)]" />
      <p className="rw-tnum rw-display text-[32px] leading-none text-[var(--hero-ink)]">{value}</p>
      <p className="rw-label mt-2 text-[var(--hero-ink-3)]">{label}</p>
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
  pick: HeroPick;
  rank: number;
  held: boolean;
  lead?: boolean;
  onHold: () => void;
}) {
  const intent = useIntent(onHold, 90);
  const colour = tinted(pick.leagueKey, 1);
  const crest = lead ? 40 : 24;

  return (
    <button
      type="button"
      onMouseEnter={intent.enter}
      onMouseLeave={intent.cancel}
      onFocus={onHold}
      onClick={onHold}
      aria-pressed={held}
      className="group relative block w-full overflow-hidden border-b border-[var(--hero-line-2)] text-left transition-[border-color,box-shadow] duration-[var(--dur-respond)] ease-[var(--ease-respond)] hover:border-[var(--hero-line)]"
      style={{
        boxShadow: held
          ? `inset 0 1px 0 rgb(255 255 255 / 0.9), 0 8px 28px -22px ${tinted(pick.leagueKey, 0.95)}`
          : "none",
      }}
    >
      {/* the competition's colour, felt across the held row and nowhere else */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 transition-opacity duration-[var(--dur-expand)] ease-[var(--ease-settle)]"
        style={{
          opacity: held || lead ? 1 : 0,
          background: lead
            ? `linear-gradient(to right, ${tinted(pick.leagueKey, held ? 0.16 : 0.11)} 0%, ${tinted(
                pick.leagueKey,
                held ? 0.07 : 0.05
              )} 24%, transparent 54%)`
            : `linear-gradient(to right, ${tinted(pick.leagueKey, 0.05)}, transparent 62%)`,
        }}
      />

      {/*
        THE COMPETITION, ON THE LEAD CARD ONLY
        Two layers and no more: the competition's colour banked against the left margin, and its
        mark set large enough to be read as a mark — cropped by a third at the edge, hung above
        centre, and behind everything. The wash is spent before the fixture title begins, so the
        text column is set on paper rather than on colour.
      */}
      {lead && pick.leagueImage ? (
        <span
          aria-hidden
          className="pointer-events-none absolute top-1/2 transition-opacity duration-[var(--dur-expand)] ease-[var(--ease-settle)]"
          style={{
            left: -66,
            transform: "translateY(-55%)",
            opacity: held ? 0.115 : 0.095,
          }}
        >
          <Crest src={pick.leagueImage} name={pick.league} size={164} />
        </span>
      ) : null}

      {/* the rail that marks the held selection */}
      <span
        aria-hidden
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
          className={`rw-tnum rw-mono shrink-0 transition-colors duration-[var(--dur-respond)] ${
            lead ? "w-8 pt-1 text-[13px]" : "w-6 text-[12px]"
          }`}
          style={{ color: held || lead ? colour : "var(--hero-ink-3)" }}
        >
          {String(rank).padStart(2, "0")}
        </span>

        {/* the two clubs, overlapped at rest and parting when held */}
        <span
          className="flex shrink-0 items-center transition-opacity duration-[var(--dur-expand)] ease-[var(--ease-respond)]"
          style={{ opacity: held || lead ? 1 : 0.6 }}
        >
          <Crest src={pick.homeImage} name={pick.home} size={crest} />
          <span
            className="transition-[margin] duration-[var(--dur-expand)] ease-[var(--ease-respond)]"
            style={{ marginLeft: held ? crest * 0.16 : -crest * 0.3 }}
          >
            <Crest src={pick.awayImage} name={pick.away} size={crest} />
          </span>
        </span>

        <span className="min-w-0 flex-1">
          <span
            className={`block truncate font-medium ${
              lead ? "text-[22px] tracking-[-0.03em]" : "text-[15px] tracking-[-0.02em]"
            }`}
          >
            {pick.home} <span className="text-[var(--hero-ink-3)]">v</span> {pick.away}
          </span>
          <span className="mt-1.5 flex items-center gap-2 text-[13px] text-[var(--hero-ink-3)]">
            <Crest src={pick.leagueImage} name={pick.league} size={14} />
            <span className="truncate">{pick.league}</span>
            {/* `round` has no production source; the kickoff it sits beside does. */}
            <span className="rw-tnum whitespace-nowrap">· {pick.kickoff}</span>
          </span>
        </span>

        <span className={`shrink-0 text-right ${lead ? "pt-0.5" : ""}`}>
          {/*
            The approved composition sets the evidence score here. Until Sprint 23B derives one,
            the slot carries the reading this fixture actually has, marked with a percent sign so
            it can never be misread as a 0–10 evidence score. Scale, rule and rhythm are unchanged.
          */}
          <span
            className={`rw-tnum block font-medium tracking-[-0.03em] ${
              lead ? "rw-display text-[36px]" : "text-[17px]"
            }`}
          >
            {pick.probability}
            <span className="align-super text-[0.45em] text-[var(--hero-ink-3)]">%</span>
          </span>
          <span
            className={`mt-2 block h-px bg-[rgb(11_12_14_/_0.12)] ${lead ? "w-16" : "w-9"}`}
            aria-hidden
          >
            <span
              className="block h-px origin-right transition-transform duration-[var(--dur-expand)] ease-[var(--ease-settle)]"
              style={{
                background: colour,
                transform: `scaleX(${held || lead ? pick.probability / 100 : 0})`,
              }}
            />
          </span>
          <span className="rw-tnum mt-2 block whitespace-nowrap text-[13px] text-[var(--hero-ink-3)]">
            {pick.market}
          </span>
        </span>
      </div>
    </button>
  );
}

export function HeroStage({
  model,
  copy,
  locale,
  headingId,
}: {
  model: HomepageHeroModel;
  copy: Copy;
  locale: Locale;
  headingId: string;
}) {
  const [held, setHeld] = useState(0);
  const stage = usePointerDrift<HTMLElement>();

  const { picks, funnel } = model;
  const pick = picks[held] ?? picks[0] ?? null;
  const [leadPick, ...supporting] = picks;

  return (
    <section
      id="today"
      ref={stage.ref}
      onPointerMove={stage.onPointerMove}
      onPointerLeave={stage.onPointerLeave}
      data-analytics-section="hero"
      aria-labelledby={headingId}
      className="rw-hero relative -mx-4 overflow-hidden border-b border-[var(--hero-line)] sm:-mx-6 lg:-mx-10"
    >
      {/* ------------------------------------------------ plane 1 · ground */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(11,12,14,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(11,12,14,0.04) 1px, transparent 1px)",
          backgroundSize: "112px 112px",
          maskImage: "radial-gradient(80% 70% at 50% 48%, #000 0%, transparent 76%)",
          WebkitMaskImage: "radial-gradient(80% 70% at 50% 48%, #000 0%, transparent 76%)",
        }}
      />

      {/* the competition's light, felt across the whole stage */}
      {pick ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 transition-[background] duration-[var(--dur-resolve)] ease-[var(--ease-settle)]"
          style={{
            background: `radial-gradient(72% 58% at 78% 22%, ${tinted(pick.leagueKey, 0.075)} 0%, transparent 68%)`,
          }}
        />
      ) : null}

      {/* the stage falls away at its edges */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(88% 78% at 50% 44%, transparent 42%, rgb(11 12 14 / 0.05) 100%)",
        }}
      />

      {/* fine grain, so the surface reads as paper rather than screen */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.035] mix-blend-multiply"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      {/* the clubs of the held selection, crossfading behind the stage */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 hidden lg:block"
        style={drift(24, 14)}
      >
        {picks.map((entry, index) => (
          <div
            key={entry.matchId}
            className="absolute inset-0 transition-opacity duration-[var(--dur-reveal)] ease-[var(--ease-settle)]"
            style={{ opacity: index === held ? 1 : 0 }}
          >
            <Crest
              src={entry.homeImage}
              name={entry.home}
              size={560}
              className="absolute -right-[10%] top-[6%] opacity-[0.07]"
            />
            <Crest
              src={entry.awayImage}
              name={entry.away}
              size={440}
              className="absolute bottom-[2%] right-[26%] opacity-[0.05]"
            />
          </div>
        ))}
      </div>

      <div className="relative mx-auto flex min-h-[86vh] max-w-[1240px] flex-col px-5 pb-16 pt-12 lg:px-8 lg:pb-24 lg:pt-14">
        {/* ------------------------------------------------- the top line */}
        <div
          className="rw-enter flex flex-wrap items-center gap-x-6 gap-y-2"
          style={{ animationDelay: "var(--lead)" }}
        >
          <span className="rw-label flex items-center gap-2.5 text-[var(--hero-ink-3)]">
            <span className="rw-pulse-ring relative inline-flex h-1.5 w-1.5 rounded-full bg-current text-[var(--hero-accent)]" />
            {copy.eyebrow}
          </span>
          {/*
            The approved composition runs a ticking "model refreshed Ns ago" counter here. That
            counter is not bound to anything. This states the provider's actual retrieval stamp,
            which is the only freshness fact this page holds.
          */}
          <p className="rw-tnum rw-label ml-auto text-[var(--hero-ink-3)]">{copy.updated}</p>
        </div>

        {/* --------------------------------------- plane 2 + 3 · the stage */}
        <div className="mt-12 grid items-start gap-x-16 gap-y-16 lg:mt-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.92fr)]">
          {/* the selection */}
          <div style={drift(-6, -4)}>
            <h1
              id={headingId}
              className="rw-enter rw-display max-w-[13ch] text-[clamp(2.25rem,4.4vw,3.5rem)] font-bold"
              style={{ animationDelay: "260ms" }}
            >
              {copy.title}
            </h1>

            {/* the standfirst: the first sentence carries, the second explains */}
            <p
              className="rw-enter mt-6 max-w-[46ch] text-[18px] leading-8 text-[var(--hero-ink-2)]"
              style={{ animationDelay: "380ms" }}
            >
              <span className="text-[var(--hero-ink)]">{copy.lede}</span> {copy.ledeRest}
            </p>

            {picks.length === 0 ? (
              /*
                The approved composition has no empty state — it destructures a lead fixture
                unconditionally. An empty day is a real and unremarkable outcome here, so it is
                stated rather than crashed on.
              */
              <p
                className="rw-enter mt-16 max-w-[52ch] border-l-2 border-[var(--hero-line)] pl-5 text-[15px] leading-7 text-[var(--hero-ink-2)]"
                style={{ animationDelay: "500ms" }}
                role="status"
              >
                {copy.empty}
              </p>
            ) : (
              <>
                {/*
                  THE PROCESS
                  The funnel and the published research are one block, read top to bottom: what
                  survived, and what came out.
                */}
                <div className="mt-16">
                  <div className="rw-enter" style={{ animationDelay: "500ms" }}>
                    <GroupRule title={copy.funnelTitle} note={copy.funnelNote} />
                  </div>

                  <div
                    className="rw-enter mt-6 flex flex-wrap items-start gap-x-12 gap-y-6"
                    style={{ animationDelay: "560ms" }}
                  >
                    {/*
                      The descent (rwdesign §6), drawn from observations only.

                      A stage whose count is `null` is OMITTED — no zero, no skeleton, no dash.
                      A rendered `0` would claim nothing survived that stage, and a skeleton would
                      promise a number that is not coming; both are assertions this product cannot
                      evidence (§3.2, §3.8). The row simply contains fewer steps, and the steps it
                      does contain are all real.

                      `published` therefore never renders today: there is no publication state
                      distinct from qualification. `analysed`, `validated` and `inScope` render on
                      a live run and drop out when the day is served from an archive.
                    */}
                    {FUNNEL_STEPS.map(({ stage, label }) => {
                      const value = funnel[stage];
                      if (value === null) return null;
                      return <Measure key={stage} value={value} label={copy[label]} />;
                    })}
                  </div>

                  {/*
                    The ledger and its descent belong here, between the funnel and the list. Both
                    draw the `analysed` population at full resolution and neither can be drawn
                    from a subset of it, so both wait for Sprint 23B.
                  */}

                  <div className="rw-enter mt-8" style={{ animationDelay: "740ms" }}>
                    <GroupRule tone="published" title={copy.leadTitle} note={copy.leadNote} />
                    {leadPick ? (
                      <PickRow
                        pick={leadPick}
                        rank={1}
                        held={held === 0}
                        lead
                        onHold={() => setHeld(0)}
                      />
                    ) : null}

                    {supporting.length > 0 ? (
                      <div className="mt-10">
                        <GroupRule title={copy.supportingTitle} note={copy.supportingNote} />
                        {supporting.map((entry, index) => (
                          <PickRow
                            key={entry.matchId}
                            pick={entry}
                            rank={index + 2}
                            held={held === index + 1}
                            onHold={() => setHeld(index + 1)}
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* the close: the same left-title, right-note balance the rules keep */}
                <div
                  className="rw-enter mt-16 flex flex-wrap items-center justify-between gap-x-6 gap-y-4"
                  style={{ animationDelay: "860ms" }}
                >
                  <SectionTrackLink
                    href={`/${locale}#top-picks`}
                    section="hero"
                    locale={locale}
                    className="rw-press inline-flex h-12 max-w-[220px] flex-1 items-center justify-center gap-2.5 rounded-xl bg-[var(--hero-ink)] px-6 text-[15px] font-medium tracking-[-0.01em] text-white hover:bg-[rgb(11_12_14_/_0.9)]"
                  >
                    {copy.cta}
                    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden>
                      <path
                        d="M2.5 8h11m0 0L9.5 4m4 4-4 4"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </SectionTrackLink>
                  {/*
                    The approved note reads "{qualified} qualified · {n} set aside". The set-aside
                    count is `analysed − qualified`, so it waits with `analysed`.
                  */}
                  {funnel.qualified !== null ? (
                    <p className="rw-label text-[var(--hero-ink-3)]">{copy.funnelNote}</p>
                  ) : null}
                </div>
              </>
            )}
          </div>

          {/* the instrument, reading whichever selection is held */}
          {pick ? (
            <div className="relative z-10 flex justify-center lg:pt-8" style={drift(8, 5)}>
              {/* the instrument arrives after the narrative has been read, not during it */}
              <div className="rw-enter w-full max-w-[520px]" style={{ animationDelay: "940ms" }}>
                <EvidenceDial
                  home={{ name: pick.home, ...(pick.homeImage ? { image: pick.homeImage } : {}) }}
                  away={{ name: pick.away, ...(pick.awayImage ? { image: pick.awayImage } : {}) }}
                  probability={pick.probability}
                  evidence={pick.evidence}
                  confidence={pick.confidence}
                  confidenceLabel={pick.confidenceLabel}
                  signals={pick.signals}
                  history={pick.history}
                  probabilityNote={copy.probabilityNote}
                  size={440}
                />

                {/*
                  The reading, in a slot sized for the longest of them so nothing below ever moves.
                  The three stated reasons and the summary paragraph that fill it belong to the
                  Sprint 23B evidence model; the height is held so that enabling them moves
                  nothing on this page.
                */}
                <div className="relative mx-auto mt-8 min-h-[200px] max-w-[46ch] border-t border-[var(--hero-line)] pt-6">
                  <div key={pick.matchId} className="rw-fade">
                    <p className="rw-label flex items-center gap-2 text-[var(--hero-ink-3)]">
                      <span className="shrink-0">
                        <Crest src={pick.leagueImage} name={pick.league} size={13} />
                      </span>
                      <span className="min-w-0 truncate">{pick.league}</span>
                      <span className="shrink-0">· {pick.kickoff}</span>
                    </p>
                    <p className="mt-4 text-[13px] leading-6 text-[var(--hero-ink-2)]">
                      {pick.market}
                    </p>
                  </div>
                </div>

                <SectionTrackLink
                  href={pick.matchHref}
                  section="hero"
                  locale={locale}
                  className="group relative mt-6 inline-flex max-w-[46ch] items-center gap-2.5 pb-2.5 text-left text-[13px] font-medium"
                >
                  <span className="min-w-0">
                    {fill(copy.openResearch, { home: pick.home, away: pick.away })}
                  </span>
                  <svg
                    viewBox="0 0 16 16"
                    width="13"
                    height="13"
                    fill="none"
                    aria-hidden
                    className="shrink-0 transition-transform duration-[var(--dur-respond)] ease-[var(--ease-respond)] group-hover:translate-x-1.5"
                  >
                    <path
                      d="M2.5 8h11m0 0L9.5 4m4 4-4 4"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span
                    aria-hidden
                    className="absolute bottom-0 left-0 h-px w-full bg-[var(--hero-line)]"
                  />
                  <span
                    aria-hidden
                    className="absolute bottom-0 left-0 h-px w-full origin-left scale-x-0 bg-[var(--hero-accent)] transition-transform duration-[var(--dur-expand)] ease-[var(--ease-settle)] group-hover:scale-x-100"
                  />
                </SectionTrackLink>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

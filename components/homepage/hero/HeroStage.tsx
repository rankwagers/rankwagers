"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import type { Locale } from "@/lib/i18n";
import type { RateWithSample, VenueRates } from "@/lib/fixtures/evidenceView";
import type { HeroFunnel, HeroPick, HomepageHeroModel } from "@/lib/homepage/types";
import type { ResearchStage } from "@/lib/research/researchRun";
import { SectionTrackLink } from "@/components/analytics/SectionTrackLink";
import { Crest } from "./Crest";
import { FunnelLine } from "./FunnelLine";
import { HeroLead } from "./HeroLead";
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
  /** Venue-split labels for the three rates set around the dial. */
  venueHome: string;
  venueAway: string;
  venueLeague: string;
};

/**
 * A rate, split into its two weights.
 *
 * The model publishes ONE string — `82% (9/11)` — and this composition sets the rate and its
 * sample at different weights. It SPLITS that string rather than rebuilding it from the parts:
 * re-deriving a football figure for presentation is the same class of mistake as inventing one
 * (§3.2), and a split cannot disagree with what was scored. A string carrying no sample is
 * returned whole, so nothing is silently dropped.
 */
export function splitRate(display: string): { rate: string; sample: string | null } {
  const at = display.indexOf(" (");
  if (at === -1) return { rate: display, sample: null };
  return { rate: display.slice(0, at), sample: display.slice(at + 1) };
}

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

/** Vertical drop between consecutive measures, and the left indent that replaces it when stacked. */
export const FUNNEL_STEP_PX = 16;

/**
 * The descent, resolved from the funnel.
 *
 * The offset is keyed to the VALUE, not to the position. A stage drops one step only when its
 * count is strictly lower than the previous rendered stage; an equal count stays level with it.
 *
 *   step = previous.step + (value < previous.value ? FUNNEL_STEP_PX : 0)
 *
 * Live data is what settled this. Today reads 32 / 32 / 32 / 8 / 5: an index-keyed staircase put
 * three identical numbers at three different heights, promising narrowing on a day where the first
 * three stages narrowed by nothing. It looked broken precisely because it was accurate. Under the
 * value rule that day reads 0/0/0/16/32 — a flat run stating "nothing was removed here", which is
 * the observation, and a drop stating an actual rejection.
 *
 * The rendered sequence still governs which stages appear: a `null` stage is omitted entirely, so
 * the run compares each stage against the previous one that RENDERED, never against a stage the
 * page declined to name.
 *
 * `emphasised` marks the two stages that survived. Colour means one thing here (brief, COLOUR
 * SYSTEM): green is Qualified, so only `qualified` and `featured` carry it. Marking the population
 * the model REJECTED in the colour reserved for what it accepted is colour without meaning.
 */
export function funnelDescent(funnel: HeroFunnel): Array<{
  stage: ResearchStage;
  label: keyof Copy;
  value: number;
  offset: number;
  emphasised: boolean;
}> {
  const rendered: Array<{
    stage: ResearchStage;
    label: keyof Copy;
    value: number;
    offset: number;
    emphasised: boolean;
  }> = [];

  for (const { stage, label } of FUNNEL_STEPS) {
    const value = funnel[stage];
    if (value === null) continue;

    const previous = rendered[rendered.length - 1];
    const offset = previous
      ? previous.offset + (value < previous.value ? FUNNEL_STEP_PX : 0)
      : 0;

    rendered.push({
      stage,
      label,
      value,
      offset,
      emphasised: stage === "qualified" || stage === "featured",
    });
  }

  return rendered;
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

  /*
   * THE CARD.
   *
   * Card ground, not page ground: every pick sits on `--hero-surface` inside a `--hero-line`
   * hairline, so the list reads as a stack of objects on the canvas rather than as rules drawn
   * across it.
   *
   * SELECTION IS STATED BY GROUND AND EDGE. The held card keeps the same surface and the same
   * hairline and gains a 2px strip of its competition's colour down the left edge. There is no
   * shadow and no scale: a card that grows or lifts on selection makes the choice feel like an
   * effect, and a raised card at rest leaves nowhere for hover to go. Hover is `.m-lift` — the
   * −3px rise the motion language reserves for surfaces — and `prefers-reduced-motion` removes it.
   */
  return (
    <button
      type="button"
      onMouseEnter={intent.enter}
      onMouseLeave={intent.cancel}
      onFocus={onHold}
      onClick={onHold}
      aria-pressed={held}
      className={`m-lift group relative mt-2 block w-full overflow-hidden rounded-xl border bg-[var(--hero-surface)] text-left ${
        held ? "border-[var(--hero-line)]" : "border-[var(--hero-line-2)] hover:border-[var(--hero-line)]"
      }`}
    >
      {/*
        THE EDGE THAT MARKS THE HELD SELECTION.
        Always 2px wide, so nothing reflows and no geometry animates; only its presence changes.
        The competition supplies the colour, which is the one place its identity is stated at full
        strength anywhere in this hero.
      */}
      <span
        aria-hidden
        className="absolute left-0 top-0 h-full w-[2px] transition-opacity duration-[var(--dur-expand)] ease-[var(--ease-respond)]"
        style={{ background: colour, opacity: held ? 1 : 0 }}
      />

      {/*
        Fixed padding. The previous row shifted its contents 5px right when held; with the edge
        stating selection that shift is a second signal for the same fact, and it moved every
        line of type on the card to say something the 2px strip already says.
      */}
      <div
        className={`relative flex gap-4 px-5 ${lead ? "items-start py-6" : "items-center py-4"}`}
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
  venueRates,
}: {
  model: HomepageHeroModel;
  copy: Copy;
  locale: Locale;
  headingId: string;
  /**
   * Venue rates by fixture, resolved on the server. A fixture absent from the map, or present
   * with null sides, renders its slots empty — the space is held, the figure is not invented.
   */
  venueRates?: Record<number, VenueRates>;
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
      className="rw-hero relative -mx-4 overflow-hidden border-b border-[var(--hero-line)] bg-[var(--hero-canvas)] sm:-mx-6 lg:-mx-10"
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

      {/*
        LEAGUE ATMOSPHERE — TINT, NOT LOGO.
        The competition's own colour, washed across the stage at very low alpha. This is the only
        thing that carries which football is being looked at; it replaces the crest wallpaper
        entirely.

        It never carries text contrast. Every figure and every line of type in this hero is set
        either on the page canvas or on an opaque `--hero-surface` card, both of which sit ABOVE
        this plane — so removing the wash changes no contrast ratio anywhere. The alpha stays
        inside what the tint table was calibrated for (`leagueTint.ts`: "a rail, a wash, an
        atmosphere"), which is why it is stated once, broadly, rather than repeated per element.
      */}
      {pick ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 transition-[background] duration-[var(--dur-resolve)] ease-[var(--ease-settle)]"
          style={{
            background: `radial-gradient(88% 72% at 74% 18%, ${tinted(pick.leagueKey, 0.055)} 0%, transparent 72%)`,
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

      {/*
        NO WATERMARK.
        The held selection's clubs used to be blown up to 560px and laid behind the stage at 5–7%
        opacity. A crest at that scale is a logo used as wallpaper: it says nothing the pick rows
        do not already say, and it competes with the one thing the composition is for. The
        competition's presence is carried by the tint wash above instead — colour, not a mark.
        Crests now appear only where they identify something: sharp and small, in the dial's core
        and on the pick rows.
      */}

      {/*
        THE RHYTHM ABOVE THIS BLOCK BELONGS TO THE PAGE SHELL — `Section rhythm="heavy"` — and the
        hero adds none of its own. Two owners produced ~150px of dead air between the sticky header
        and the first line; there is one owner now, and it is the one pacing every other section.
      */}
      <div className="relative mx-auto flex min-h-[86vh] max-w-[1240px] flex-col px-5 pb-16 lg:px-8 lg:pb-24">
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

                  {/*
                    THE DESCENT (rwdesign §6), drawn from observations only.

                    Five equal numerals at equal spacing read as five statistics, which is a
                    dashboard. The product's single claim is that hundreds became five, so the
                    composition states it: a staircase that steps down and narrows, connected by
                    one hairline, ending on the two stages drawn in the colour reserved for what
                    survived.

                    A stage whose count is `null` is OMITTED — no zero, no skeleton, no dash. A
                    rendered `0` would claim nothing survived that stage, and a skeleton would
                    promise a number that is not coming; both are assertions this product cannot
                    evidence (§3.2, §3.8). The staircase closes up around the omission rather than
                    leaving a hole, because the offset is keyed to the rendered index.

                    `published` therefore never renders today: there is no publication state
                    distinct from qualification. `analysed`, `validated` and `inScope` render on
                    a live run and drop out when the day is served from an archive.
                  */}
                  {/*
                    THE FUNNEL LINE (rebrand v2). The staircase that stood here is replaced, not
                    supplemented. `FunnelLine` consumes the same `funnel` this component already
                    holds and calls `funnelDescent` itself, so the omission rule the staircase
                    enforced — a null stage is dropped, never drawn as zero — is unchanged because
                    it is the same function deciding it.
                  */}
                  <FunnelLine funnel={funnel} copy={copy as unknown as Record<string, string>} />

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

          {/*
            THE LEAD (rebrand v2). Substitution, not addition: the dial-and-flanks instrument that
            stood here is replaced outright rather than left beside the new composition, or the
            page would ship two visual languages at once — the exact fault this rebrand exists to
            end. It is fed from the SAME `pick` and `venueRates` the instrument read; no value is
            derived here that was not already on this page.
          */}
          {pick ? (
            <div className="relative z-10 lg:pt-8">
              <HeroLead
                pick={pick}
                rates={venueRates?.[pick.matchId] ?? null}
                locale={locale}
                copy={{
                  probabilityNote: copy.probabilityNote,
                  venueHome: copy.venueHome,
                  venueAway: copy.venueAway,
                  venueLeague: copy.venueLeague,
                  openResearch: copy.openResearch,
                }}
              />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

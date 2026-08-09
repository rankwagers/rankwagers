"use client";

import type { Locale } from "@/lib/i18n";
import type { VenueRates } from "@/lib/fixtures/evidenceView";
import type { HomepageHeroModel } from "@/lib/homepage/types";
import { SectionTrackLink } from "@/components/analytics/SectionTrackLink";
import { V2ArrowLabel } from "@/components/homepage/v2Chrome";
import { FunnelLine } from "./FunnelLine";
import { HeroLead } from "./HeroLead";
import { SupportingTable } from "./SupportingTable";
import type { HeroCopy } from "./heroModel";

/* ============================================================================
   TODAY'S RESEARCH — rebrand v2, per docs/design/motion-language-v2.md
   ----------------------------------------------------------------------------
   The stage is a printed page now, read top to bottom on one left axis:

     the edition line     what was retrieved, and when
     the headline         what this page claims, in one sentence
     the funnel           what was looked at, stage by stage, on one rule
     the lead             No. 01 — the strongest fixture, full width
     the supporting table Nos. 02+ — dense ruled rows

   WHAT THIS REPLACED. v1 set the headline in a two-column grid with an
   instrument beside it, so the eye started in two places and the page had no
   axis. The map has one: everything hangs off the left edge, and width is used
   for measure rather than for a second column. The lead is no longer a right-
   hand panel — it is a full-width row beneath the funnel, which is what makes
   it read as the top of a ranking rather than as a widget.

   DATA GATING. The evidence score, the lead's three stated reasons and the
   reading summary need the Sprint 23B model and are not drawn. Every one is a
   `null` on `HeroPick`, and nothing here invents a value in their place.
   ========================================================================== */

export function HeroStage({
  model,
  copy,
  locale,
  headingId,
  venueRates,
}: {
  model: HomepageHeroModel;
  copy: HeroCopy;
  locale: Locale;
  headingId: string;
  /**
   * Venue rates by fixture, resolved on the server. A fixture absent from the map, or present with
   * null sides, omits those cells — the figure is never invented and never placeheld.
   */
  venueRates?: Record<number, VenueRates>;
}) {
  const { picks, funnel } = model;
  const [leadPick, ...supporting] = picks;

  return (
    <section
      id="today"
      data-analytics-section="hero"
      aria-labelledby={headingId}
      className="rw-hero relative -mx-4 border-b border-[var(--hero-line)] bg-[var(--hero-canvas)] sm:-mx-6 lg:-mx-10"
    >
      <div className="relative mx-auto w-full max-w-[1240px] px-5 pb-16 lg:px-8 lg:pb-24">
        {/*
          THE EDITION LINE IS NOT HERE ANY MORE.

          This block printed an eyebrow and the retrieval stamp, above the same 2px/1px rule the
          masthead draws. Both are masthead facts, and the masthead now states them — so the page
          was saying "lists retrieved 08:31 UTC" twice, forty pixels apart, under two identical
          rules. A repeated fact reads as two different facts that happen to agree.

          `copy.eyebrow` and `copy.updated` stay on the copy contract: `SiteTopChrome` builds the
          masthead line from the same dictionary entry (`heroStageUpdated`), so there is still one
          wording for one fact.
        */}

        {/* ------------------------------------------------ the left axis */}
        <div className="lg:grid lg:grid-cols-[minmax(0,78%)_1fr] lg:gap-x-10">
          <div className="min-w-0">
            <h1
              id={headingId}
              className="rw-enter rw-h mt-8 max-w-[16ch] text-[clamp(2.125rem,5.2vw,3.625rem)] leading-[0.97] tracking-[-0.035em]"
              style={{ animationDelay: "260ms" }}
            >
              {copy.title}
            </h1>

            {/* The standfirst: the first sentence carries, the second explains. */}
            <p
              className="rw-enter mt-3.5 max-w-[58ch] text-[15px] leading-[1.55] text-[var(--hero-ink-2)]"
              style={{ animationDelay: "380ms" }}
            >
              <span className="text-[var(--hero-ink)]">{copy.lede}</span> {copy.ledeRest}
            </p>

            {/*
              THE FUNNEL — kept on an empty day.

              The doc is explicit: an empty day keeps the funnel line and the edition line, because
              the page still owes the reader what was looked at and when. Only the ranking below
              is replaced by the stated empty state.
            */}
            <div className="rw-enter mt-10" style={{ animationDelay: "500ms" }}>
              <p className="rw-label border-b-[0.5px] border-[var(--hero-ink-2)] pb-2 text-[var(--hero-ink-2)]">
                {copy.funnelTitle}
              </p>
              <FunnelLine funnel={funnel} copy={copy} />
            </div>

            {picks.length === 0 ? (
              <p
                className="rw-enter mt-12 max-w-[52ch] border-l-2 border-[var(--hero-ink)] pl-5 text-[15px] leading-7 text-[var(--hero-ink-2)]"
                style={{ animationDelay: "620ms" }}
                role="status"
              >
                {copy.empty}
              </p>
            ) : (
              <>
                {/*
                  THE LEAD — No. 01, full width.

                  The heavy 5px rule above it is the map's way of saying a movement opens here; the
                  number sits in its own gutter so the ranking is stated by position rather than by
                  a badge. `HeroLead` is fed the SAME pick and rates it has always been fed.
                */}
                {leadPick ? (
                  /*
                    THE LEAD SITS ON LIFTED PAPER. The map sets it on #ffffff against the canvas,
                    bleeding 20px past the text column, opened by the heavy 5px rule and closed by
                    a hairline — no shadow, because a surface change IS the lift and a shadow
                    would state it twice. One note against the brief's wording: the map's TOP edge
                    is the 5px rule, not a hairline, and the map wins where recollection differs.
                  */
                  <div className="-mx-5 mt-14 border-b-[0.5px] border-t-[5px] border-b-[var(--hero-line)] border-t-[var(--hero-ink)] bg-[var(--hero-surface)] px-5 pb-8 pt-9">
                    <div className="sm:grid sm:grid-cols-[64px_minmax(0,1fr)] sm:gap-x-5">
                      <p className="rw-tnum rw-label pt-2 text-[var(--hero-ink-2)]">
                        {copy.leadTitle}
                      </p>
                      <HeroLead
                        pick={leadPick}
                        rates={venueRates?.[leadPick.matchId] ?? null}
                        locale={locale}
                        copy={{
                          probabilityNote: copy.probabilityNote,
                          venueHome: copy.venueHome,
                          venueAway: copy.venueAway,
                          venueLeague: copy.venueLeague,
                          venuePotential: copy.venuePotential,
                          openResearch: copy.openResearch,
                          openResearchCta: copy.openResearchCta,
                          meta: copy.leadMeta,
                        }}
                      />
                    </div>
                  </div>
                ) : null}

                {supporting.length > 0 ? (
                  <div className="rw-enter mt-16" style={{ animationDelay: "740ms" }}>
                    <div className="rw-label flex items-baseline justify-between gap-4 pb-2 text-[var(--hero-ink-2)]">
                      <span>{copy.supportingTitle}</span>
                      <span>{copy.supportingNote}</span>
                    </div>
                    <SupportingTable
                      picks={supporting}
                      startRank={2}
                      venueRates={venueRates}
                      locale={locale}
                      copy={{
                        tableNo: copy.tableNo,
                        tableFixture: copy.tableFixture,
                        tableLeague: copy.tableLeague,
                        tableKickoff: copy.tableKickoff,
                        tablePotential: copy.tablePotential,
                        tableMarket: copy.tableMarket,
                        venueHome: copy.venueHome,
                        venueAway: copy.venueAway,
                      }}
                    />
                  </div>
                ) : null}

                {/*
                  The close. A rule under the words rather than a filled button: v2 states an
                  action by weight, and a solid slab here would be the loudest thing on a page
                  whose subject is a table of research.
                */}
                <div className="rw-enter mt-8" style={{ animationDelay: "860ms" }}>
                  <SectionTrackLink
                    href={`/${locale}#top-picks`}
                    section="hero"
                    locale={locale}
                    className="rw-h inline-block border-b-2 border-[var(--hero-ink)] pb-0.5 text-[14px] tracking-[0.01em] text-[var(--hero-ink)]"
                  >
                    <V2ArrowLabel text={copy.cta} />
                  </SectionTrackLink>
                </div>
              </>
            )}
          </div>

          {/* The right track is measure, not a column. Nothing is set in it. */}
          <div aria-hidden />
        </div>
      </div>
    </section>
  );
}

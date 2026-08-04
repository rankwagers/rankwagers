"use client";

import type { VenueRates } from "@/lib/fixtures/evidenceView";
import type { HeroPick } from "@/lib/homepage/types";
import type { Locale } from "@/lib/i18n";
import { SectionTrackLink } from "@/components/analytics/SectionTrackLink";
import { Crest } from "./Crest";
import { splitRate } from "./heroModel";

/* ============================================================================
   THE SUPPORTING TABLE — rebrand v2, per docs/design/motion-language-v2.md §4
   ----------------------------------------------------------------------------
   Dense ruled rows. The map sets research as a printed table: hairlines between
   peers, mono throughout, figures right-aligned so the eye reads down a column
   rather than across a card.

   WHAT REPLACED WHAT. The v1 rows were `rounded-xl` cards, each on its own
   surface inside a hairline, and each a BUTTON that swapped the instrument
   beside it. Both properties are gone, and not by oversight:

     · the radius, because v2 sets radius 0 in scope with no exception;
     · the selection, because the instrument it drove — the Evidence Dial — was
       replaced by `HeroLead`, and the map fixes the lead as No. 01, the
       strongest fixture of the day. A control whose only effect is to
       contradict the composition's own ranking is not an interaction, it is a
       leftover. Each row is a LINK to its research now, which is what a reader
       reaching for a row in a table of fixtures is actually trying to do.

   MOBILE. Below `sm` the grid collapses to stacked rows — never two columns.
   A two-column table at 360px is a table nobody can read, so the same cells
   re-flow into a block with their labels attached rather than being squeezed.
   ========================================================================== */

export type SupportingCopy = {
  tableNo: string;
  tableFixture: string;
  tableLeague: string;
  tableKickoff: string;
  tablePotential: string;
  tableMarket: string;
  venueHome: string;
  venueAway: string;
};

/**
 * The column track, stated once and used by both the head and every row.
 *
 * One declaration, because a head that disagrees with its rows by a single track is a table whose
 * figures sit under the wrong words — the failure is silent and it is total.
 */
const COLUMNS =
  "sm:grid sm:grid-cols-[44px_minmax(0,1.7fr)_minmax(0,1.1fr)_minmax(0,0.8fr)_72px_72px_78px_minmax(0,1fr)] sm:gap-x-3.5";

/**
 * A venue rate cell.
 *
 * `%`-with-sample discipline: the rate takes display weight, the sample label weight, and neither
 * appears without the other. A side the provider holds nothing for renders EMPTY — no dash, no
 * zero, no skeleton (§3.2, §3.8). The cell keeps its track either way, so an absent rate costs no
 * layout on a row whose neighbours resolved.
 */
function RateCell({ rate, label }: { rate: { display: string } | null; label: string }) {
  if (!rate) return <span className="hidden sm:block" aria-hidden />;
  const { rate: value, sample } = splitRate(rate.display);

  return (
    <span className="flex items-baseline gap-1.5 sm:block sm:text-right">
      {/* The label is carried on the cell below `sm`, where there is no column head to carry it. */}
      <span className="rw-label text-[var(--hero-ink-2)] sm:hidden">{label}</span>
      <span className="rw-tnum text-[var(--hero-ink)]">{value}</span>
      {sample ? (
        <span className="rw-tnum rw-label ml-1 text-[var(--hero-ink-2)] sm:ml-0 sm:block">
          {sample}
        </span>
      ) : null}
    </span>
  );
}

function Row({
  pick,
  rank,
  rates,
  locale,
  copy,
}: {
  pick: HeroPick;
  rank: number;
  rates: VenueRates | null;
  locale: Locale;
  copy: SupportingCopy;
}) {
  return (
    <SectionTrackLink
      href={pick.matchHref}
      section="hero"
      locale={locale}
      className={`rw-row group block border-b border-[var(--hero-line)] py-3 sm:items-center ${COLUMNS}`}
    >
      <span className="rw-tnum rw-label hidden text-[var(--hero-ink-2)] sm:block">
        {String(rank).padStart(2, "0")}
      </span>

      {/* The fixture, with its two clubs at the map's 26px — bare marks, no plate, no ring. */}
      <span className="flex min-w-0 items-center gap-2">
        <Crest src={pick.homeImage} name={pick.home} size={26} />
        <Crest src={pick.awayImage} name={pick.away} size={26} />
        <span className="truncate text-[14px] font-semibold tracking-[-0.01em] text-[var(--hero-ink)]">
          {pick.home} v {pick.away}
        </span>
      </span>

      <span className="mt-1.5 flex min-w-0 items-center gap-1.5 sm:mt-0">
        <Crest src={pick.leagueImage} name={pick.league} size={14} />
        <span className="rw-label truncate text-[var(--hero-ink-2)]">{pick.league}</span>
      </span>

      <span className="rw-tnum rw-label mt-1.5 block text-[var(--hero-ink-2)] sm:mt-0">
        {pick.kickoff}
      </span>

      <RateCell rate={rates?.home ?? null} label={copy.venueHome} />
      <RateCell rate={rates?.away ?? null} label={copy.venueAway} />

      {/*
        THE PROVIDER POTENTIAL. Bold because it is the figure the row is ranked by, and marked with
        a percent sign so it can never be read as an evidence score. It carries no sample and the
        table's own note says so — the omission is stated, never implied.
      */}
      <span className="mt-1.5 flex items-baseline gap-1.5 sm:mt-0 sm:block sm:text-right">
        <span className="rw-label text-[var(--hero-ink-2)] sm:hidden">{copy.tablePotential}</span>
        <span className="rw-tnum font-bold text-[var(--hero-ink)]">{pick.probability}%</span>
      </span>

      <span className="rw-label mt-1.5 block truncate text-[var(--hero-ink-2)] sm:mt-0 sm:text-right">
        {pick.market}
      </span>
    </SectionTrackLink>
  );
}

export function SupportingTable({
  picks,
  startRank,
  venueRates,
  locale,
  copy,
}: {
  picks: HeroPick[];
  /** The rank of the first row — the lead is No. 01, so the table opens at 02. */
  startRank: number;
  venueRates?: Record<number, VenueRates>;
  locale: Locale;
  copy: SupportingCopy;
}) {
  if (picks.length === 0) return null;

  return (
    <div className="border-t-[1.5px] border-[var(--hero-ink)]">
      {/*
        The column head. Hidden below `sm`, where the grid has collapsed and each cell carries its
        own label instead — a head floating above stacked rows labels nothing.
      */}
      <div
        className={`rw-label hidden border-b border-[var(--hero-line)] py-1.5 text-[var(--hero-ink-2)] ${COLUMNS}`}
      >
        <span>{copy.tableNo}</span>
        <span>{copy.tableFixture}</span>
        <span>{copy.tableLeague}</span>
        <span>{copy.tableKickoff}</span>
        <span className="text-right">{copy.venueHome}</span>
        <span className="text-right">{copy.venueAway}</span>
        <span className="text-right">{copy.tablePotential}</span>
        <span className="text-right">{copy.tableMarket}</span>
      </div>

      {picks.map((pick, index) => (
        <Row
          key={pick.matchId}
          pick={pick}
          rank={startRank + index}
          rates={venueRates?.[pick.matchId] ?? null}
          locale={locale}
          copy={copy}
        />
      ))}
    </div>
  );
}

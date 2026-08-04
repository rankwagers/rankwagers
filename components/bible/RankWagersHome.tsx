import { ArrowUpRight } from "lucide-react";
import type { FullDictionary } from "@/lib/dictionaries";
import type { Locale } from "@/lib/i18n";
import type { DailyMatchLists } from "@/lib/footystats/types";
import { mapDailyListsToQualifiedFixtures, topRankedFixtures } from "@/lib/research/qualifiedFixture";
import { BibleFixtureExplorer } from "./BibleFixtureExplorer";
import { BibleHomeNotes } from "./BibleHomeNotes";
import { BibleOperatorStrip } from "./BibleOperatorStrip";
import { LiveFeedPanel } from "@/components/predictions/LiveFeedPanel";
import { HomepageEngagementTracker } from "@/components/analytics/HomepageEngagementTracker";
import { SectionTrackLink } from "@/components/analytics/SectionTrackLink";
import type { CountryContext } from "@/lib/personalization/types";
import { fixturePath } from "@/lib/fixtures/paths";
import {
  homepageFixtureExplorerHref,
  marketKindToFilterCode,
} from "@/lib/search/homeSearchRoutes";
import { HomepageDateControl } from "./HomepageDateControl";
import { SavedFixturesPanel } from "./SavedFixturesPanel";
import { HomepageSearchEntry } from "@/components/homepage/HomepageSearchEntry";
import { HomepageAccaEntry } from "@/components/homepage/HomepageAccaEntry";
import { AddToAccaButton } from "@/components/acca/AddToAccaButton";
import { HomepageViewedTracker } from "@/components/homepage/HomepageViewedTracker";
import {
  V2Button,
  V2Chip,
  V2LeagueCell,
  V2Outcome,
  V2SectionOpen,
} from "@/components/homepage/v2Chrome";
import { FunnelFootnote } from "@/components/homepage/hero/FunnelLine";
import { HomepageHero } from "@/components/homepage/hero/HomepageHero";
import { Section } from "@/components/layout/Section";
import {
  EmptySection,
  SectionHeading,
  StatusBadge,
} from "@/components/homepage/sectionChrome";
import type { HomepageTrustModel } from "@/lib/homepage/types";
import type { VenueRates } from "@/lib/fixtures/evidenceView";
import { buildRankedWhy } from "@/lib/homepage/rankedWhy";
import { RankedExplainer } from "@/components/homepage/RankedExplainer";
import { buildProofBandFigures } from "@/lib/homepage/proofBand";
import { settledFirst } from "@/lib/homepage/recentResults";
import { leagueKeyFor } from "@/lib/homepage/heroModel";
import { railTintStyle } from "@/components/homepage/hero/leagueTint";
import { Crest } from "@/components/homepage/hero/Crest";
import type { CSSProperties } from "react";
import { formatDict } from "@/lib/dictionaryExtras";

/**
 * The recent-results column track, stated once so the head cannot drift from its rows.
 *
 * Stacked below `sm` — a six-column table at 360px is a table nobody can read.
 */
const RESULT_COLUMNS =
  "pl-3.5 sm:grid sm:grid-cols-[44px_minmax(0,1.5fr)_minmax(0,0.9fr)_minmax(0,1fr)_70px_92px] sm:gap-x-3.5";

const marketNames = {
  fh: "1st half goal",
  over15: "Over 1.5 goals",
  over25: "Over 2.5 goals",
  sh: "2nd half goal",
} as const;

/*
 * The masthead nameplate and the hairline pitch diagram lived here to support the previous S1
 * hero. Both were composition owned by that hero, and the approved composition that replaces it
 * states its subject in the headline and carries its own ground plane. Removed rather than left
 * unreferenced.
 */

/**
 * Render the hero dateline from the settled record's own timestamp.
 *
 * Fixed `en-GB` + UTC on purpose: this renders on the server, and a locale- or zone-dependent date
 * would differ between the server render and any later client render of the same markup. The date a
 * record was compiled is a property of the record, not of the reader.
 *
 * Returns `null` — and the dateline is not rendered at all — when there is no usable timestamp.
 */
function formatAssessedLabel(
  template: string,
  lastUpdatedAt: string | null
): string | null {
  if (!lastUpdatedAt) return null;
  const parsed = new Date(lastUpdatedAt);
  if (Number.isNaN(parsed.getTime())) return null;
  const date = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
  return formatDict(template, { date });
}

/**
 * Capture time for the stale-archive notice: `1 August 2026, 19:21 UTC`.
 *
 * Fixed `en-GB` + UTC for the same reason as the dateline — this renders on the server, and the
 * instant a capture happened is a property of the capture, not of the reader. Falls back to an
 * empty string rather than inventing a time when the archive carries no usable stamp.
 */
function formatArchiveCaptureTime(capturedAt?: string): string {
  if (!capturedAt) return "";
  const parsed = new Date(capturedAt);
  if (Number.isNaN(parsed.getTime())) return "";
  return `${new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(parsed)} UTC`;
}

/**
 * Homepage body — section order per `docs/homepage-final-specification.md` Part 2 (S1–S7),
 * framing per `docs/design/homepage-narrative.md`.
 *
 *   S1 Hero → S2 Proof Band → S3 Today's Picks → S4 Live Signals → S5 Research
 *   → S6 How This Works → S7 Bookmakers
 *
 * (This line read `S6 Bookmakers → S7 How This Works` and contradicted the implementation: the
 * method section is S6 at its marker below, the operator strip is S7. The rhythm note and the
 * merge list further down were already numbered against the implementation; only this line was
 * wrong. Order itself is unchanged — commerce still sits after every research surface.)
 *
 * Proof precedes product: the settled record is read before any model probability, so a
 * percentage in S3 is interpreted through the loss counter above it. Commerce sits after
 * every research surface, which makes the separation a property of the layout rather than a
 * claim about it.
 *
 * Merges (spec Part 2), every anchor and `data-analytics-section` retained on the merged
 * container so navigation and analytics keep resolving:
 *   S2 ← `#verified-performance` + `#recent-results`
 *   S3 ← `#top-picks` + `#trending-markets` + the returning-reader controls
 *   S5 ← `#featured-leagues` + `#fixtures` + `#saved`
 *   S6 ← `#why-trust` + `#research-notes`/`#methodology` + `#prediction-archive`
 *
 * Rhythm (spec §1.4). Separation is not uniform, and neither is tempo — a page whose sections all
 * breathe at `py-16` behind an identical hairline reads as one section repeated, however different
 * its contents. Four separator devices, each carrying a different weight of break:
 *
 *   full-bleed change of ground  S2 — the only one, and the loudest movement on the page
 *   full-width hairline    S5 — the only one, opening the widest and densest section
 *   short editorial rule   S4, S7 — the two quiet movements
 *   whitespace + a pause   S3, S6 — the two structural joints, ~248px of air at md
 *
 * Tempo alternates rather than repeats. Total vertical padding at md, in order:
 * 160 · 192 · [128] · 88 · 96 · 160 · [128] · 136 · 128 — loud, loudest, rest, quiet, quiet,
 * loud, rest, medium, quiet. Bracketed values are `SectionPause`.
 *
 * Composition alternates too, so no two adjacent sections are laid out alike: full-bleed statement
 * (S1) → figures hung off a rule, on the surface (S2) → three-column card grid (S3) → two-column split, the only one on
 * the page (S4) → full-width explorer (S5) → narrow numbered list at 46rem (S6) → strip (S7).
 *
 * Measures (spec §1.1): editorial `46rem` · reading `38rem` · data `72rem` · panel `2xl`.
 * No section is shell-width for text.
 */
export function RankWagersHome({
  lists,
  dict,
  locale,
  displayDate,
  modelMeta,
  countryContext,
  selectedDate,
  today,
  trust,
  rankedVenueRates,
}: {
  lists: DailyMatchLists;
  dict: FullDictionary;
  locale: Locale;
  displayDate: string;
  modelMeta: string;
  countryContext: CountryContext;
  selectedDate: string;
  today: string;
  trust: HomepageTrustModel;
  /**
   * Venue rates for the ranked six, resolved by the page. A fixture with no entry renders its
   * explainer without the venue sentence — the bound still prints, the facts are not invented.
   */
  rankedVenueRates?: Record<number, VenueRates>;
}) {
  const p = dict.predictions;
  const fixtures = mapDailyListsToQualifiedFixtures(lists);

  /* Settled outcomes lead; pending follows. The rule and its reasoning live in the module. */
  const orderedResults = settledFirst(trust.recentResults);

  const topFixtures = topRankedFixtures(fixtures);
  const marketRows = (Object.keys(marketNames) as Array<keyof typeof marketNames>)
    .map((market) => {
      const rows = fixtures.filter((fixture) => fixture.marketKind === market);
      return {
        market,
        label: marketNames[market],
        count: rows.length,
        highest: rows.length
          ? Math.max(...rows.map((fixture) => fixture.modelProbability))
          : null,
        filterCode: marketKindToFilterCode(market),
      };
    })
    .filter((row) => row.count > 0);

  // Dateline. House pattern is `Assessed {date}` with the date spelled out — "1 August 2026", never
  // an ISO timestamp and never "last updated". Omitted entirely when the record carries no stamp:
  // a dateline that cannot state a date is worse than no dateline.
  const assessedLabel = formatAssessedLabel(p.heroAssessed, trust.verified.lastUpdatedAt);

  /*
   * S2's figures. Which ones exist is a property of the record, not of this layout, so the decision
   * lives in `buildProofBandFigures` where it is unit-tested — notably that a null `hitRatePct`
   * produces no figure rather than a zero or a dash.
   */
  const proofFigures = buildProofBandFigures(trust.verified, {
    published: p.verifiedPublished,
    settled: p.verifiedSettled,
    hitRate: p.verifiedHitRateShort,
    open: p.verifiedOpen,
    wonLost: p.verifiedWonLost,
    stillOpen: p.verifiedStillOpen,
  });

  /*
   * Present while ANY non-live source is standing in for a failed provider. `fresh_provider` —
   * including a fresh empty day — and an absent provenance both render nothing.
   *
   * `last_good` reports `fetchedAt`, which is the moment those rows were actually retrieved;
   * `stale_daily_archive` reports its capture time. Both answer the same question — when was this
   * true? — and serving either without saying so would be worse than the blank page it replaces.
   */
  const staleNotice =
    lists.provenance?.source === "last_good"
      ? formatDict(p.staleArchiveNotice, {
          time: formatArchiveCaptureTime(lists.fetchedAt),
        })
      : lists.provenance?.source === "stale_daily_archive"
        ? formatDict(p.staleArchiveNotice, {
            time: formatArchiveCaptureTime(lists.provenance.archiveCapturedAt),
          })
        : null;

  return (
    /*
     * THE SHELL. Sections no longer decide their own measure, rhythm or ground — `Section` does,
     * so the spacing BETWEEN them is a property of the page rather than an accident of the order
     * they were converted in. The page wrapper drops `container-wide` because a full-bleed ground
     * cannot live inside a constrained column; the measure moved into each section instead.
     */
    /*
     * THE CREAM BAND IS GONE.
     *
     * `main` sets `py-6 lg:py-8` on the site's cream ground (`--canvas-primary`, #f6f3ec), so a
     * 24–32px strip of the OLD palette sat between the header and the hero — the first thing on
     * the page, in the colour the rebrand replaces. The negative margin cancels exactly that
     * padding so the hero's ground starts flush under the header.
     *
     * Done here rather than in the layout because `main`'s padding is correct for every
     * unconverted route; PASS 2 can remove it globally once no route needs it.
     */
    <div className="rw-hero -mt-6 bg-[var(--hero-canvas)] lg:-mt-8">
      <HomepageEngagementTracker />
      <HomepageViewedTracker
        locale={locale}
        liveMatchCount={trust.liveMatchCount}
        qualifiedFixtureCount={trust.qualifiedFixtureCount}
      />

      {/*
        S1 — Hero. Sprint 1: replaced by the approved hero composition.

        `HomepageHero` derives its model from the same `lists` this page already fetched and
        renders inside a `.rw-hero` scope that carries its own palette, typefaces and motion
        language. Nothing it defines escapes that scope, so S2–S7 below and every other route are
        byte-identical to their previous output.

        The dateline and the commission disclosure do NOT move into it. They are not composition:
        a publication states when it was compiled and who pays for it, and the approved hero has
        no place for either. They stay here, immediately beneath the hero, in the site's own
        styling — the same rule that has always carried them.
      */}
      {/*
        S1 keeps its interior exactly. What changes is that it now sits in the page's rhythm
        instead of setting its own: `reveal={false}` because the hero plays its entrance on mount
        rather than on scroll, so wrapping it in an observer would hold the first viewport blank.
      */}
      <Section id="top" ground="canvas" rhythm="masthead" reveal={false}>
        <HomepageHero
          lists={lists}
          dict={dict}
          locale={locale}
          headingId="homepage-hero-heading"
        />

        <div className="mt-10 max-w-[46rem] border-t border-[var(--hero-line)] pt-5 md:mt-12">
        {assessedLabel ? (
          <p className="text-caption text-muted-foreground">
            <time dateTime={trust.verified.lastUpdatedAt ?? undefined}>{assessedLabel}</time>
          </p>
        ) : null}
        {/*
          Trust hierarchy, tier 1. The commercial interest is disclosed before any figure it
          could bias, and it makes no promise about its own effect — it points at the published
          criteria so the reader can check rather than believe.
        */}
        <p className="mt-2 max-w-[62ch] text-caption leading-relaxed text-muted-foreground">
          {p.heroDisclosure}
        </p>
        </div>
      </Section>

      {/*
        S2 — The Proof Band. The second half of the first viewport.

        Sprint 2: converted to the hero's visual language. Four figures, each hung off a rule
        rather than boxed — a full-width hairline it hangs from, an ink rule that draws in from the
        left on approach, and a tick that grows from 9px to 16px.

        The composition is the Make prototype's. The figures are not. Every number below comes from
        `HomepageVerifiedPerformance`; the prototype's ROI, average odds, "since 2020" and "rolling
        12 months" are absent because no field produces them. That is rwbible §3.2, and it is the
        same sentence `sampleNote` has always carried — ROI and average odds are omitted when
        publication odds are not durably archived. They were also the two most sportsbook-coded
        figures in the prototype, which is the product the brief opens by ruling out.

        Monochrome, and that is a decision rather than a shortage: rwbrief assigns grey to
        Historical, and this section is the record. Colour here would be decoration, which the brief
        forbids outright — "Typography carries hierarchy. Not colour."

        The loss is still never diminished. It is stated in the same ink at the same size in the
        always-visible note under `Settled`, and drawn to length in the proportional rule beneath.
        What it no longer carries is a red dot, because in this system red means Error.

        `#recent-results` is merged in below the totals it reconciles with — the individual outcomes
        and their summary are one argument, and splitting them across a rule made the reader assemble
        it themselves.

        CARRIED FORWARD: `StatusBadge` in `#recent-results` still renders won/lost/void in state
        colour, so it is the one coloured element left in this band. It is deliberately unchanged.
        The component is shared with `ArchiveTable` and `TransparencyDashboard`; all three are
        record surfaces, so "Grey = Historical" applies to all three, and it changes once — in the
        component — when those surfaces are converted. Forking a local copy to settle one section
        is how two components drift.

        Surface rather than the tonal band: the section is set on white against the canvas above it,
        so what marks it is a change of ground rather than a change of hue.
      */}
      <Section
        id="verified-performance"
        ground="surface"
        rhythm="heavy"
        labelledBy="verified-performance-heading"
        analyticsSection="verified_performance"
      >
        {/*
          Set locally rather than through `SectionHeading`. That component is shared with the
          archive surfaces, so restyling it would change pages this sprint does not touch.
        */}
        {/*
          The map's section opening, in v2: a 40×2px rule, the heading on the ladder's middle step
          (46 — headings are 34 / 46 / 58 and nothing between), then the standfirst at reading
          size. The rule is `--rule-3`, the ladder's 2px step, not an off-ladder 3px.
        */}
        <div className="mb-6 md:mb-8">
          <span aria-hidden className="mb-3.5 block h-[2px] w-10 bg-[var(--hero-ink)]" />
          <h2
            id="verified-performance-heading"
            className="rw-h text-[clamp(2.125rem,4.4vw,2.875rem)]"
          >
            {p.verifiedTitle}
          </h2>
          <p className="mt-2.5 max-w-[52ch] text-[15px] leading-[1.55] text-[var(--hero-ink-2)]">
            {p.verifiedDescription}
          </p>
        </div>

        {trust.verified.availability === "available" ? (
          <div>
            {/*
              The window every figure below is computed over, stated once against the whole band.

              It is deliberately not a note on the hit rate. `HomepageVerifiedPerformance` carries a
              single `windowLabel`, and `totalPredictions`, `settledPredictions` and
              `pendingPredictions` are all scoped by it. Attaching it to one figure would say two
              false things: that the other three are all-time, and — whenever `hitRatePct` is null
              and its figure is omitted — that three figures which are still windowed have no window
              at all. Stated here it survives a null rate, because the window does.
            */}
            <p className="rw-m text-[var(--hero-ink-2)]">{trust.verified.windowLabel}</p>

            {/* Targeted by AccaChrome's launcher yield — the figures themselves, not the whole
                section, which also contains recent-results and runs most of the page height. */}
            <div id="verified-performance-figures" className="mt-12">
              {/*
                `hitRatePct` is null on an empty settled sample, and the figure is then OMITTED —
                never a zero, never a dash. Zero asserts a rate of nought; a dash renders the
                absence as though it were a reading. An omitted figure is the honest shape of a
                record that has settled nothing yet, and it is the rule the hero funnel already
                follows. The window label travels with it, because it qualifies that rate.
              */}
              {/*
                Four equal tracks, per the map — a grid rather than a wrapping flex row. The
                figures are peers and read across as one statement; a flex row re-flowed them into
                3 + 1 at some widths, which ranks the fourth figure below the others for no
                reason the data supports. Two columns below `sm`, never four.
              */}
              <dl className="grid grid-cols-2 gap-x-7 gap-y-10 lg:grid-cols-4">
                {proofFigures.map((figure) => (
                  <ProofFigure
                    key={figure.key}
                    label={figure.label}
                    value={figure.value}
                    note={figure.note}
                    audit={figure.audit}
                  />
                ))}
              </dl>

              <ProofBar
                won={trust.verified.won}
                lost={trust.verified.lost}
                wonLabel={p.verifiedWon}
                lostLabel={p.verifiedLost}
              />

              <FormStrip results={trust.recentResults} label={p.recentTitle} />

              {/*
                The sample note, in its proper place: under the figures it qualifies, where a reader
                who doubts the numbers looks for exactly this. It is also where the band states, in
                its own words, why ROI and average odds are not among them.
              */}
              <p className="mt-10 max-w-[62ch] text-[13px] leading-6 text-[var(--hero-ink-2)]">
                {trust.verified.sampleNote}
              </p>
            </div>

            {/* #recent-results — the map's table, merged into the band beneath the totals. */}
            <div
              id="recent-results"
              data-analytics-section="recent_results"
              className="mt-14 max-w-[72rem] scroll-mt-28"
            >
              <div className="rw-m flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 pb-2 text-[var(--hero-ink-2)]">
                <h3 id="recent-results-heading">{p.resultsTitle}</h3>
                <span>{p.resultsNote}</span>
              </div>

              {orderedResults.length ? (
                <div className="border-t-[0.5px] border-[var(--hero-ink-2)]">
                  {/* Column head, hidden below sm where the grid collapses to stacked rows. */}
                  <div className={`rw-label hidden border-b border-[var(--hero-line)] py-1.5 text-[var(--hero-ink-2)] ${RESULT_COLUMNS}`}>
                    <span>{p.heroTableNo}</span>
                    <span>{p.heroTableFixture}</span>
                    <span>{p.heroTableLeague}</span>
                    <span className="text-center">{p.heroTableMarket}</span>
                    <span className="text-right">{p.deskColumnScore}</span>
                    <span className="text-right">{p.deskColumnResult}</span>
                  </div>

                  {orderedResults.map((row, index) => (
                    <SectionTrackLink
                      key={row.id}
                      href={row.matchHref}
                      section="recent_results"
                      locale={locale}
                      className={`rw-row block border-b border-[var(--hero-line)] py-2.5 sm:items-center ${RESULT_COLUMNS}`}
                      style={railTintStyle(leagueKeyFor(row.competition), row.country)}
                    >
                      <span className="rw-tnum rw-m hidden text-[var(--hero-ink-2)] sm:block">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      {/* The crest pair, 22px, bare. A row whose crests are absent renders names alone. */}
                      <span className="flex min-w-0 items-center gap-2">
                        {row.homeImage ? <Crest src={row.homeImage} name={row.home} size={22} /> : null}
                        {row.awayImage ? <Crest src={row.awayImage} name={row.away} size={22} /> : null}
                        <span className="min-w-0 truncate text-[14px] font-semibold tracking-[-0.01em] text-[var(--hero-ink)]">
                          {row.home} <span className="rw-m text-[var(--hero-ink-2)]">vs</span>{" "}
                          {row.away}
                        </span>
                      </span>
                      <span className="mt-1.5 block sm:mt-0">
                        <V2LeagueCell country={row.country} league={row.competition} />
                      </span>
                      <span className="rw-m mt-1.5 block text-[var(--hero-ink-2)] sm:mt-0 sm:text-center">
                        {row.marketLabel}
                      </span>
                      <span className="rw-h rw-tnum mt-1.5 block text-[16px] tracking-[-0.02em] text-[var(--hero-ink)] sm:mt-0 sm:text-right">
                        {row.scoreLabel}
                      </span>
                      <span className="mt-2 block sm:mt-0 sm:justify-self-end">
                        <V2Outcome
                          status={row.status}
                          label={
                            row.status === "won"
                              ? p.resultsWon
                              : row.status === "lost"
                                ? p.resultsLost
                                : row.status === "void"
                                  ? p.resultsVoid
                                  : p.resultsPending
                          }
                        />
                      </span>
                    </SectionTrackLink>
                  ))}
                </div>
              ) : (
                <div className="mt-4">
                  <EmptySection text={p.recentEmpty} />
                </div>
              )}
            </div>

            {/* Internal links presented as an editorial cross-reference, not a button row. */}
            <p className="mt-8 text-metadata font-medium uppercase tracking-label text-muted-foreground">
              Further reading
            </p>
            <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <SectionTrackLink
                href={trust.verified.methodologyHref}
                section="verified_performance"
                locale={locale}
                className="font-medium text-foreground underline decoration-[var(--border-subtle)] underline-offset-4 hover:decoration-current"
              >
                {p.verifiedMethodology}
              </SectionTrackLink>
              <SectionTrackLink
                href={trust.verified.archiveEntryHref}
                section="verified_performance"
                locale={locale}
                className="font-medium text-foreground underline decoration-[var(--border-subtle)] underline-offset-4 hover:decoration-current"
              >
                {p.verifiedArchive}
              </SectionTrackLink>
            </div>
          </div>
        ) : (
          <EmptySection text={p.verifiedUnavailable} />
        )}
      </Section>

      {/*
        S3 — Today's Picks. Separation from S2 is whitespace only; the band's lower edge is the rule.

        `#trending-markets` is merged in as a context row beside the date control rather than
        standing as its own destination — same links, same data, a fraction of the height, and now
        functioning as context for the grid it sits above.
      */}

      <Section
        id="top-picks"
        analyticsSection="top_picks"
        labelledBy="top-picks-heading"
        ground="canvas"
        rhythm="heavy"
        index={1}
      >
        {/*
          THE MAP'S "HIGHEST PROVIDER POTENTIAL TODAY".

          The heading names the figure the section ranks by, in the approved vocabulary — it read
          "Today's picks", which named the output of a tipster rather than the ordering of a table.
        */}
        <V2SectionOpen
          headingId="top-picks-heading"
          eyebrow={p.rankedEyebrow}
          title={p.rankedTitle}
          description={p.rankedDescription}
        />
        {/*
          Stale-archive notice. Rendered ONLY when a same-day archive is standing in for a failed
          provider — never on fresh data, including a fresh empty day. It states the condition and
          the capture time and stops there: no "live", no refresh claim, no restoration promise.
        */}
        {staleNotice ? (
          <p
            role="status"
            className="mt-8 max-w-[52ch] border-l-2 border-[var(--border-strong)] pl-5 text-sm leading-relaxed text-[var(--ink-secondary)]"
          >
            {staleNotice}
          </p>
        ) : null}
        {/*
          Returning-reader controls, relocated out of the hero. A date control belongs beside the
          fixtures it filters, and a search field is a tool for someone who already knows what this
          site is — not an introduction to it.
        */}
        <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-col gap-3">
            <HomepageDateControl locale={locale} selectedDate={selectedDate} today={today} />
            <p className="text-sm text-muted-foreground">{modelMeta}</p>
          </div>
          <div className="max-w-[38rem] lg:w-[24rem]">
            <HomepageSearchEntry
              locale={locale}
              placeholder={p.heroSearchPlaceholder}
              submitLabel={p.heroSearchSubmit}
            />
            <p className="mt-2 text-sm text-muted-foreground" role="status">
              {trust.liveMatchCount > 0
                ? formatDict(p.heroLiveCountLabel, { count: String(trust.liveMatchCount) })
                : p.heroLiveCountEmpty}
            </p>
          </div>
        </div>

        {/* #trending-markets — the map's mono chip row: label, count, top rate. */}
        {marketRows.length ? (
          <ul
            id="trending-markets"
            data-analytics-section="trending_markets"
            className="mt-8 flex max-w-[72rem] scroll-mt-28 flex-wrap gap-2.5"
          >
            {marketRows.map((market) => (
              <li key={market.market}>
                <V2Chip
                  href={homepageFixtureExplorerHref(locale, { market: market.filterCode })}
                  label={market.label}
                  count={String(market.count)}
                  {...(market.highest ? { note: `top ${market.highest}%` } : {})}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p id="trending-markets" className="rw-m mt-8 scroll-mt-28 text-[var(--hero-ink-2)]">
            Not enough settled results to report a trend.
          </p>
        )}

        {topFixtures.length ? (
          <div className="list-enter mt-10 grid max-w-[72rem] gap-x-7 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {topFixtures.map((fixture) => (
              <article
                key={fixture.id}
                className="group relative border-t-[0.5px] border-[var(--hero-ink-2)] pt-3.5"
              >
                {/* The ink rule draws in from the left on approach — the map's hover for a figure. */}
                <span
                  aria-hidden
                  className="absolute left-0 top-[-0.5px] h-[2px] w-full origin-left scale-x-0 bg-[var(--hero-ink)] transition-transform duration-[var(--dur-expand)] ease-[var(--ease-settle)] group-hover:scale-x-100"
                />

                <V2LeagueCell country={fixture.country} league={fixture.league} />

                {/* The map's fixture line: crest · name · vs · crest · name, crests 22px bare. */}
                <p className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                  {fixture.homeImage ? (
                    <Crest src={fixture.homeImage} name={fixture.home} size={22} />
                  ) : null}
                  <span className="rw-h text-[20px] leading-[1.15] tracking-[-0.025em] text-[var(--hero-ink)]">
                    {fixture.home}
                  </span>
                  <span className="rw-m text-[var(--hero-ink-2)]">vs</span>
                  {fixture.awayImage ? (
                    <Crest src={fixture.awayImage} name={fixture.away} size={22} />
                  ) : null}
                  <span className="rw-h text-[20px] leading-[1.15] tracking-[-0.025em] text-[var(--hero-ink)]">
                    {fixture.away}
                  </span>
                </p>

                <p className="rw-m mt-1.5 tracking-[0.06em] text-[var(--hero-ink-2)]">
                  <time dateTime={fixture.kickoffDateTime}>{fixture.kickoff}</time>
                </p>

                {/*
                  THE FIGURE, AND WHAT IT IS.

                  "Observed Updated N min ago" is deleted. It stated a freshness this page never
                  observed: `updatedAt` is the provider's list stamp for the DAY, not a per-fixture
                  observation, so "updated 4 minutes ago" described something that did not happen
                  to this fixture. An unobserved freshness claim is the one thing a research
                  publication cannot afford to print beside its central figure.
                */}
                {/* The numeral with the map's ⓘ beside it — the explainer built from THIS card's facts. */}
                <div className="mt-3.5 flex items-start gap-2.5">
                  <p className="rw-h text-[44px] leading-[0.9] tracking-[-0.045em] text-[var(--hero-ink)]">
                    <span className="rw-tnum">{fixture.modelProbability}</span>
                    <span className="rw-mono align-baseline text-[20px] font-normal tracking-normal">
                      %
                    </span>
                  </p>
                  <RankedExplainer
                    why={buildRankedWhy(
                      fixture.modelProbability,
                      rankedVenueRates?.[fixture.matchId] ?? null,
                      {
                        title: p.rankedWhyTitle,
                        homeAll: p.rankedWhyHomeAll,
                        homeRate: p.rankedWhyHomeRate,
                        awayAll: p.rankedWhyAwayAll,
                        awayRate: p.rankedWhyAwayRate,
                        bound: p.rankedWhyBound,
                        more: p.rankedWhyMore,
                      }
                    )}
                    href={fixturePath(locale, fixture.matchId, fixture.marketKind, "top_picks")}
                    linkLabel={p.rankedOpenMatch}
                  />
                </div>
                <p className="rw-h mt-1 text-[15px] tracking-[-0.01em] text-[var(--hero-ink)]">
                  {fixture.market}
                </p>
                <p className="rw-m mt-1 text-[var(--hero-ink-2)]">{p.rankedPotentialLabel}</p>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <V2Button
                    href={fixturePath(locale, fixture.matchId, fixture.marketKind, "top_picks")}
                  >
                    {p.rankedOpenMatch}
                  </V2Button>
                  {/*
                    THE MAP'S FORM: "+ ACCUMULATOR", the bordered mono twin of OPEN MATCH →.
                    The v2 className replaces the component's soft green default — the component
                    itself is shared with unconverted routes, so the form is stated here, at the
                    one converted call site, rather than changed under four other pages. The `+`
                    is a glyph, not copy, so it composes here rather than entering the dictionary.
                  */}
                  <AddToAccaButton
                    labelAdd={`+ ${p.rankedAddAcca}`}
                    className="rw-m inline-flex items-center gap-2 border border-[var(--hero-ink)] px-3 py-2 tracking-[0.1em] text-[var(--hero-ink)] transition-colors duration-[var(--dur-respond)] ease-[var(--ease-settle)] hover:bg-[var(--hero-ink)] hover:text-[var(--hero-canvas)] aria-pressed:bg-[var(--hero-ink)] aria-pressed:text-[var(--hero-canvas)]"
                    draft={{
                      matchId: fixture.matchId,
                      homeTeam: fixture.home,
                      awayTeam: fixture.away,
                      competition: fixture.league,
                      countryCode: null,
                      kickoffAt: fixture.kickoffDateTime,
                      marketKey: fixture.marketKind,
                      confidence: fixture.modelProbability,
                      odds: null,
                      evidenceSummary: [
                        `Provider potential ${fixture.modelProbability}% on ${fixture.market}`,
                      ],
                      publishedAt: fixture.updatedDateTime,
                      matchHref: fixturePath(
                        locale,
                        fixture.matchId,
                        fixture.marketKind,
                        "top_picks"
                      ),
                      source: "top_picks",
                    }}
                  />
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-8">
            <EmptySection text={p.topPicksEmpty} />
          </div>
        )}

        <p className="rw-m mt-8 text-[var(--hero-ink-2)]">
          Prefer an automatic multi-leg acca?{" "}
          <SectionTrackLink
            href={`/${locale}/acca/builder`}
            section="top_picks"
            locale={locale}
            className="border-b-2 border-[var(--hero-ink)] font-bold text-[var(--hero-ink)]"
          >
            Open Acca Builder →
          </SectionTrackLink>
        </p>
      </Section>

      {/*
        S4 — Live Signals. Supporting, not structural: no eyebrow, hairline rule above.

        It sits outside the trust sequence deliberately. This panel carries locked rows and an
        unlock prompt, and adjacency to the Proof Band is what would make a lock read as a paywall
        on evidence.
      */}
      {/*
        THE LIVE DESK, ON THE PAGE'S ONE INVERTED GROUND.

        The previous pass left this on `surface` with a note explaining why: the interior inherited
        light-ground colours, and flipping the ground without converting them would have published
        dark text on dark. That was the right call then and it is resolved now — `.rw-ink`
        re-points the tokens the interior already reads, so the ground and its contents invert
        together rather than one ahead of the other.

        The heading stays OUTSIDE the band, on the page ground. The map introduces the desk in the
        page's own voice and then hands over to the instrument; putting the h2 inside the ink would
        make the band a section rather than what it is — one object, set on the page.

        There are exactly two inverted grounds: this and the footer. That is what keeps the device
        legible as punctuation.

        The SECTION ground is surface, not canvas: the run alternates canvas → surface down the
        page, and the ranked section above is canvas. On white, the ink band also reads harder —
        dark punctuation against the lighter of the two grounds.
      */}
      <Section
        id="live-signals"
        analyticsSection="live_matches"
        labelledBy="live-matches-heading"
        ground="surface"
        rhythm="quiet"
        index={2}
      >
        <span aria-hidden className="block h-[2px] w-10 bg-[var(--hero-ink)]" />
        <div className="mt-3.5 max-w-[72rem]">
          <p className="rw-m text-[var(--hero-ink-2)]">{p.liveDeskEyebrow}</p>
          <h2
            id="live-matches-heading"
            className="rw-h mt-1.5 text-[clamp(2.125rem,4.4vw,2.875rem)]"
          >
            {p.liveDeskTitle}
          </h2>
          <p className="mt-2.5 max-w-[52ch] text-[15px] leading-[1.55] text-[var(--hero-ink-2)]">
            {p.liveDeskDescription}
          </p>

          <div className="rw-ink mt-6 p-6 sm:p-7">
            <LiveFeedPanel dict={dict} />
          </div>
        </div>
      </Section>

      {/*
        S5 — Research. Deliberately the quietest section: the H2 sits at the `text-xl` step with no
        eyebrow, which is how the page signals a shift from narrative to tool.

        Merges `#featured-leagues` and `#saved` into the research surface as sub-blocks. Featured
        leagues becomes a single meta row rather than an eight-cell grid, and Saved a sub-block
        rather than a full section that exists to tell most visitors it is empty.
      */}
      <Section
        id="fixtures"
        analyticsSection="recently_qualified"
        labelledBy="recently-qualified"
        ground="canvas"
        rhythm="heavy"
        index={3}
      >
        <V2SectionOpen
          headingId="recently-qualified"
          eyebrow={p.deskEyebrow}
          title={p.deskTitle}
          description={p.deskDescription}
        />

        {/*
          THE RELATED-COMPETITIONS ROW IS DELETED.

          It rendered `trust.featuredLeagues`, which falls back to a hardcoded top-five European
          list — Premier League, La Liga, Serie A, Bundesliga, Ligue 1, Champions League. None of
          them is on today's board: the qualified fixtures are lower divisions the model actually
          scored. A row of links to competitions this page did not research reads as a claim that
          it did, and it was the only place on the page pointing somewhere the research does not
          go.

          The `#featured-leagues` anchor and its heading go with it. `trust.featuredLeagues` is now
          resolved and unrendered — worth removing from the trust model in its own pass, since
          that contract is shared and tested.
        */}

        <div className="mt-6">
          <BibleFixtureExplorer lists={lists} dict={dict} />
        </div>

        {/* #saved */}
        <div data-analytics-section="saved" id="saved" className="mt-12 scroll-mt-28">
          <h3 id="saved-heading" className="rw-h text-[20px] text-[var(--hero-ink)]">
            Saved
          </h3>
          <p className="mt-1.5 max-w-[52ch] text-[15px] leading-[1.55] text-[var(--hero-ink-2)]">
            Fixtures you save stay in this browser so you can reopen match evidence quickly.
          </p>
          <div className="mt-4">
            <SavedFixturesPanel locale={locale} />
          </div>
        </div>
      </Section>

      {/*
        S6 — Method. Separated by whitespace, not a rule: the page opens and closes at the
        same editorial measure, which is what makes it read as composed rather than assembled.

        Merges `#why-trust`, `#research-notes`/`#methodology` and `#prediction-archive` — three
        sections that made the same argument in three places. The five reasons lose their card
        chrome and become text rows; a bordered box around a sentence adds height, not meaning.

        Placed BEFORE commerce, not after it. A reader meets the method that produced the record
        while the record is still in mind, and the commercial block is the last thing on the page
        rather than an interruption between two research surfaces.
      */}

      <Section
        id="why-trust"
        analyticsSection="why_trust"
        labelledBy="why-trust-heading"
        ground="surface"
        rhythm="quiet"
        index={4}
      >
        <V2SectionOpen
          headingId="why-trust-heading"
          eyebrow={p.howRecordEyebrow}
          title={p.howRecordTitle}
          description={p.howRecordDescription}
        />
        {/*
          The method, as a ruled procedure rather than a bulleted list.

          Numbered steps separated by hairlines is the typographic form of a specification — a
          standard, a protocol, a lab method. It is the form a reader already associates with
          "this was written down before it was carried out", which is precisely the claim the
          section is making. The previous treatment set the numerals at 14px muted and gave the
          steps no enclosure, so the one element on the page that evidences a *process* read as
          the least considered thing on it.

          The numeral column is fixed-width and tabular so the rules align down the page; the
          steps are the only place on this surface where a rule sits between every row.
        */}
        <ol className="mt-8 max-w-[52rem] border-t-[0.5px] border-[var(--hero-ink-2)]">
          {[p.whyPublished, p.whyEvidence, p.whyLive, p.whySettlement, p.whyArchive].map(
            (item, index) => (
              <li
                key={item}
                className="grid grid-cols-[44px_minmax(0,1fr)] items-baseline gap-x-3.5 border-b border-[var(--hero-line)] py-3"
              >
                <span aria-hidden className="rw-tnum rw-m text-[var(--hero-ink-2)]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <p className="text-[15px] leading-[1.5] text-[var(--hero-ink)]">{item}</p>
              </li>
            )
          )}
        </ol>

        {/*
          THE TWO CLOSING BLOCKS, side by side per the map: how qualification works, and the
          archive. Each opens on a mono rule at 2px rather than a heading a half-step above body
          text, so the section reads as three stated claims of equal standing.
        */}
        <div className="mt-10 grid max-w-[72rem] gap-x-10 gap-y-10 lg:grid-cols-2">
          <div
            data-analytics-section="latest_insights"
            id="research-notes"
            className="scroll-mt-28"
          >
            <h3
              id="methodology-heading"
              className="rw-m border-b-2 border-[var(--hero-line)] pb-2 text-[var(--hero-ink-2)]"
            >
              How qualification works
            </h3>
            <div id="methodology" className="mt-3 scroll-mt-28">
              <BibleHomeNotes dict={dict} locale={locale} />
            </div>
            <p className="rw-m mt-4 max-w-[62ch] normal-case tracking-[0.04em] text-[var(--hero-ink-2)]">
              {p.trustFooterNote}
            </p>
          </div>

          {/* #prediction-archive */}
          <div
            id="prediction-archive"
            data-analytics-section="prediction_archive"
            className="scroll-mt-28"
          >
            <h3
              id="prediction-archive-heading"
              className="rw-m border-b-2 border-[var(--hero-line)] pb-2 text-[var(--hero-ink-2)]"
            >
              {p.archiveEyebrow} — {p.archiveTitle}
            </h3>
            <p className="mt-3 max-w-[52ch] text-[14px] leading-[1.6] text-[var(--hero-ink-2)]">
              {p.archiveBody}
            </p>
            {/*
              Bordered mono buttons. `V2Button` owns the arrow, so a label can never double it —
              these two rendered "Read methodology → →" because the copy already ended in one.
            */}
            <div className="mt-4 flex flex-wrap gap-2">
              <V2Button href={`/${locale}/methodology`}>{p.archiveReadMethodology}</V2Button>
              <V2Button href={`/${locale}/archive`} arrow={false}>
                {p.archiveUseDateControl}
              </V2Button>
            </div>
          </div>
        </div>
      </Section>
      {/*
        S7 — Bookmakers. After every research surface, without exception.

        The strip already states that the research above is separate from commercial offers. Placed
        here — last on the page, after the method as well as the research — that claim becomes
        literally true of the layout, which is what a reader actually believes rather than the
        sentence. The accumulator entry travels with it: it is a commercial funnel, not research.
      */}
      {/* Operator content last, per the brief's hierarchy. Quiet ground, quiet rhythm. */}
      <Section
        analyticsSection="top_operators"
        ground="canvas"
        rhythm="quiet"
        index={5}
      >
        <EditorialRule />
        <div className="mt-8 max-w-[72rem]">
          <BibleOperatorStrip
            dict={dict}
            locale={locale}
            subidBase="homepage-top-operators"
            countryContext={countryContext}
          />
          <div className="mt-6">
            <HomepageAccaEntry
              locale={locale}
              title={p.accaEntryTitle}
              body={p.accaEntryBody}
              ctaLabel={p.accaEntryCta}
            />
          </div>
        </div>
      </Section>

      {/*
        THE † FOOTNOTE, AT THE FOOT OF THE PAGE.

        `FunnelLine` prints a † beside "Cleared threshold" in the hero and an `sr-only` link to
        `#funnel-cleared-threshold`. Until now nothing on the page carried that id, so the marker
        pointed at nothing and the link went nowhere — a qualifier promised and not delivered,
        which is worse than no marker at all because the reader is told a bound exists.

        It sits here rather than beside the funnel deliberately: the qualifier is defined once, at
        the foot, and referenced from the figure — so the hero states the number without a
        parenthesis hanging off it, and the definition is still one keystroke away for anyone who
        wants it. The wording belongs to the dictionary (`heroFunnelFootnote`) and says what the
        stage counts and what it does not: a filter, not a verdict.

        Outside `Section` because it is not a section — no rhythm, no ground, no heading. It is the
        page's last line.

        It carries NO `rw-hero` of its own: the page wrapper above already establishes that scope,
        and the palette and typefaces reach here by inheritance. Repeating the class would declare
        the scope twice, which is the thing `homepageProofBand` asserts against — one declaration
        is what makes "inside the hero scope" a fact about the page rather than a per-section habit.
      */}
      <div className="border-t border-[var(--hero-line)]">
        <div className="mx-auto w-full max-w-[1240px] px-5 py-8 lg:px-8">
          <FunnelFootnote note={p.heroFunnelFootnote} />
        </div>
      </div>
    </div>
  );
}

/**
 * A record figure, hung off a rule rather than boxed.
 *
 * Three marks make the structure and none of them encloses anything: a full-width hairline the
 * figure hangs from, an ink rule that draws in from the left as the figure is approached, and a
 * tick that grows from 9px to 16px. Label, numeral and note all indent past that tick, so the
 * column reads as measured off the rule rather than sitting inside a box.
 *
 * `note` is a sourced sentence, always visible. `audit` is a second sourced sentence that
 * cross-fades into the same space on approach. The audit is `aria-hidden` and never carries a
 * figure that is not also stated elsewhere on the band, so nothing here is reachable only by
 * hovering — a pointer-only disclosure of the record would be the one thing this section cannot do.
 *
 * `dt`/`dd` inside the band's `dl`, so a screen reader announces "Settled, 3964" as one term and
 * its definition rather than as two unrelated strings.
 */
function ProofFigure({
  label,
  value,
  note,
  audit,
}: {
  label: string;
  value: string;
  note?: string;
  audit?: string;
}) {
  return (
    /*
       The map hangs each figure off a hairline that an ink rule draws in over, left to right, on
       approach. v2 keeps the mechanism and re-sets the type: the label is mono, the figure sits on
       the heading ladder's 46 step, and the indent is gone — everything hangs off the same left
       axis the rest of the page uses.
    */
    <div className="group relative min-w-0 border-t-[0.5px] border-[var(--hero-ink-2)] pt-3">
      <span
        aria-hidden
        className="absolute left-0 top-[-0.5px] h-[2px] w-full origin-left scale-x-0 bg-[var(--hero-ink)] transition-transform duration-[var(--dur-reveal)] ease-[var(--ease-settle)] group-hover:scale-x-100"
      />

      <dt className="rw-m text-[var(--hero-ink-2)]">{label}</dt>
      <dd className="rw-tnum rw-h mt-2 text-[clamp(2rem,4.4vw,2.875rem)] transition-transform duration-[var(--dur-expand)] ease-[var(--ease-respond)] group-hover:-translate-y-0.5">
        {value}
      </dd>

      {note ? (
        <div className="relative mt-1.5">
          <p
            className={`rw-m max-w-[24ch] normal-case tracking-[0.04em] text-[var(--hero-ink-2)] ${
              audit
                ? "transition-opacity duration-[var(--dur-respond)] group-hover:opacity-0"
                : ""
            }`}
          >
            {note}
          </p>
          {audit ? (
            <p
              aria-hidden
              className="rw-m pointer-events-none absolute inset-0 max-w-[28ch] normal-case tracking-[0.04em] text-[var(--hero-ink)] opacity-0 transition-opacity duration-[var(--dur-expand)] ease-[var(--ease-settle)] group-hover:opacity-100"
            >
              {audit}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * The proportional rule — won against lost, at a glance.
 *
 * Carries NO arithmetic. The two segments are flex children whose `flexGrow` is the won and lost
 * count itself, so the ratio is resolved by the layout engine rather than computed here; nothing in
 * this file divides, rounds or derives a percentage. It exists because a reader who will not do
 * division still understands a length, and because it makes the loss unmissable rather than merely
 * disclosed.
 *
 * Monochrome, per the brief's Historical grey. Two adjacent segments still have to be told apart,
 * so they differ in tone and are named at each end.
 *
 * The lost segment is `--hero-ink-2`, not `--hero-ink-3`. Lengths carry the ratio, but tone speaks
 * too, and ink-3 put the loss at 4.70:1 against the win's 18.25:1 — the faintest mark in the one
 * section that exists to not hide losses. ink-2 measures 7.89:1: adjacent to the win, plainly
 * distinguishable from it, and not whispered.
 *
 * Renders nothing when nothing has settled: a rule of zero width states a ratio that does not exist.
 *
 * `aria-hidden` — every figure it depicts is announced by the `dl` above it, and a rule that
 * re-announces them adds noise to a screen reader without adding information.
 */
function ProofBar({
  won,
  lost,
  wonLabel,
  lostLabel,
}: {
  won: number;
  lost: number;
  wonLabel: string;
  lostLabel: string;
}) {
  if (won + lost <= 0) return null;
  return (
    <div className="mt-8" aria-hidden>
      {/* 2px — the ladder's step. The two segments still differ in tone, not only in length. */}
      <div className="flex h-[2px] w-full overflow-hidden bg-[var(--hero-line)]">
        <span style={{ flexGrow: won }} className="block bg-[var(--hero-ink)]" />
        <span style={{ flexGrow: lost }} className="block bg-[var(--hero-ink-2)]" />
      </div>
      <div className="mt-1.5 flex justify-between">
        <span className="rw-m text-[var(--hero-ink-2)]">{wonLabel}</span>
        <span className="rw-m text-[var(--hero-ink-2)]">{lostLabel}</span>
      </div>
    </div>
  );
}

/**
 * The form strip — the settled sequence, most recent first.
 *
 * A summary asserts a record; a sequence shows one. Four totals describe a lucky streak and a long
 * grind identically, and a reader has no way to tell which they are looking at. This is the rows
 * already rendered below it, reduced to their outcome and placed in order.
 *
 * Monochrome, like the rule above it, and on the same ramp for the same reason: a lost mark at
 * ink-3 would be the faintest thing in the section that exists to not hide losses. Won and lost sit
 * one step apart at 18.25:1 and 7.89:1; void takes ink-3, because a fixture with no outcome is the
 * one thing here that genuinely is secondary. Each mark also names its own outcome in `sr-only`
 * text, so the sequence is fully readable without relying on tone at all.
 *
 * Pending rows are excluded rather than drawn in a third tone: this is the settled record, and an
 * unsettled fixture has no outcome to show. Renders nothing when nothing has settled.
 */
function FormStrip({
  results,
  label,
}: {
  results: HomepageTrustModel["recentResults"];
  label: string;
}) {
  const settled = results.filter((row) => row.status !== "pending");
  if (!settled.length) return null;
  /*
   * v2 carries two ink weights, so `void` can no longer take a third. It becomes the rule tone —
   * a fixture with no outcome is the one mark here that genuinely is absent rather than
   * secondary, and drawing it as a faint rule says exactly that.
   */
  const tone: Record<string, string> = {
    won: "bg-[var(--hero-ink)]",
    lost: "bg-[var(--hero-ink-2)]",
    void: "bg-[var(--hero-line)]",
  };
  return (
    <div className="mt-7">
      <p className="rw-m text-[var(--hero-ink-2)]">{label}</p>
      {/* The map's tick: 8px wide, 18px tall, 4px apart. */}
      <ol className="mt-2 flex flex-wrap gap-1">
        {settled.map((row) => (
          <li key={row.id}>
            <span className={`block h-[18px] w-2 ${tone[row.status] ?? tone.void}`}>
              <span className="sr-only">{`${row.home} vs ${row.away}: ${row.status}`}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * A visual pause — the page's paragraph break.
 *
 * Whitespace alone stops separating once every section is separated by whitespace: the eye reads a
 * uniform gap as no gap at all. This is a deliberate rest with a mark in it — a short centred rule
 * carrying more vertical space than any section boundary on the page.
 *
 * Used exactly twice, at the two structural joints: after the settled record, and before the method
 * that closes. A third use would make it a divider, and a divider used everywhere is the monotony it
 * exists to break.
 */
/*
 * `SectionPause` is gone. It added py-12/md:py-16 BETWEEN sections back when each section set its
 * own padding and the gaps had to be made up by hand. `Section` now owns the rhythm, so the pause
 * was adding a second helping of space and flattening the quiet/heavy distinction that paces the
 * page — the very signal this pass exists to establish.
 */

/**
 * A short editorial rule — the quiet separator.
 *
 * Left-aligned and 4rem wide, so it reads as the opening of a movement rather than the close of the
 * previous one. It exists because the page had ONE separator device — a full-width hairline — used
 * for four consecutive section boundaries and for the top of every fixture card, so section
 * separation and card separation were typographically identical and neither ranked.
 *
 * The vocabulary is now four devices, each carrying a different weight of break: the full-bleed
 * tonal band (S2), the full-width hairline (S5 only), this short rule (S4, S7), and open whitespace
 * with a pause (S3, S6).
 */
function EditorialRule() {
  return <span aria-hidden className="block h-px w-16 bg-[var(--border-strong)]" />;
}

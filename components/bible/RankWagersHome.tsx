import { ArrowUpRight } from "lucide-react";
import type { FullDictionary } from "@/lib/dictionaries";
import type { Locale } from "@/lib/i18n";
import type { DailyMatchLists } from "@/lib/footystats/types";
import { mapDailyListsToQualifiedFixtures } from "@/lib/research/qualifiedFixture";
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
import { HomepageHero } from "@/components/homepage/hero/HomepageHero";
import {
  EmptySection,
  SectionHeading,
  StatusBadge,
} from "@/components/homepage/sectionChrome";
import type { HomepageTrustModel } from "@/lib/homepage/types";
import { buildProofBandFigures } from "@/lib/homepage/proofBand";
import { formatDict } from "@/lib/dictionaryExtras";

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
}) {
  const p = dict.predictions;
  const fixtures = mapDailyListsToQualifiedFixtures(lists);
  const topFixtures = [...fixtures]
    .sort((left, right) => right.modelProbability - left.modelProbability)
    .slice(0, 6);
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

  // Present only while a same-day archive is standing in for a failed provider. `fresh_provider`
  // — including a fresh empty day — and an absent provenance both render nothing.
  const staleNotice =
    lists.provenance?.source === "stale_daily_archive"
      ? formatDict(p.staleArchiveNotice, {
          time: formatArchiveCaptureTime(lists.provenance.archiveCapturedAt),
        })
      : null;

  return (
    <div className="container-wide">
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
      <HomepageHero
        lists={lists}
        dict={dict}
        locale={locale}
        headingId="homepage-hero-heading"
      />

      <div className="mt-10 max-w-[46rem] border-t border-[var(--border-subtle)] pt-5 md:mt-12">
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

        Surface rather than the tonal band: the section is set on white against the canvas above it,
        so what marks it is a change of ground rather than a change of hue.
      */}
      <section
        id="verified-performance"
        data-analytics-section="verified_performance"
        aria-labelledby="verified-performance-heading"
        className="rw-hero -mx-4 scroll-mt-28 border-y border-[var(--hero-line)] bg-[var(--hero-surface)] px-4 py-16 sm:-mx-6 sm:px-6 md:py-24 lg:-mx-10 lg:px-10"
      >
        {/*
          Set locally rather than through `SectionHeading`. That component is shared with the
          archive surfaces, so restyling it would change pages this sprint does not touch.
        */}
        <div className="mb-6 md:mb-8">
          <span aria-hidden className="mb-5 block h-[3px] w-10 bg-[var(--hero-ink)] md:mb-6" />
          <h2
            id="verified-performance-heading"
            className="rw-display text-[clamp(2.2rem,4.4vw,3.4rem)]"
          >
            {p.verifiedTitle}
          </h2>
          <p className="mt-4 max-w-[38ch] text-[14px] leading-6 text-[var(--hero-ink-2)]">
            {p.verifiedDescription}
          </p>
        </div>

        {trust.verified.availability === "available" ? (
          <div>
            {/* Targeted by AccaChrome's launcher yield — the figures themselves, not the whole
                section, which also contains recent-results and runs most of the page height. */}
            <div id="verified-performance-figures" className="mt-14">
              {/*
                `hitRatePct` is null on an empty settled sample, and the figure is then OMITTED —
                never a zero, never a dash. Zero asserts a rate of nought; a dash renders the
                absence as though it were a reading. An omitted figure is the honest shape of a
                record that has settled nothing yet, and it is the rule the hero funnel already
                follows. The window label travels with it, because it qualifies that rate.
              */}
              <dl className="flex flex-col gap-10 sm:flex-row sm:flex-wrap sm:gap-x-8 lg:flex-nowrap">
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

            {/* #recent-results — merged into the band, directly beneath the totals. */}
            <div
              id="recent-results"
              data-analytics-section="recent_results"
              className="mt-14 max-w-[72rem] scroll-mt-28"
            >
              <h3
                id="recent-results-heading"
                className="font-display text-h3 tracking-display text-foreground"
              >
                {p.recentTitle}
              </h3>
              <p className="mt-2 max-w-[38rem] text-base leading-relaxed text-[var(--ink-secondary)]">
                {p.recentDescription}
              </p>
              {trust.recentResults.length ? (
                <ul className="list-enter mt-6 divide-y divide-[var(--border-subtle)] border-y border-[var(--border-subtle)]">
                  {trust.recentResults.map((row) => (
                    <li key={row.id}>
                      <SectionTrackLink
                        href={row.matchHref}
                        section="recent_results"
                        locale={locale}
                        className="press flex flex-col gap-2 px-4 py-3 hover:bg-[var(--canvas-secondary)] sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <p className="text-lg font-semibold text-foreground">
                            {row.home} vs {row.away}
                          </p>
                          <p className="mt-0.5 text-sm text-[var(--ink-secondary)]">
                            {row.competition} · {row.marketLabel} · {row.date}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                          <span className="font-mono tabular-nums text-[var(--ink-secondary)]">
                            {row.scoreLabel}
                          </span>
                          <StatusBadge
                            status={row.status}
                            label={
                              row.status === "won"
                                ? p.listResultWon
                                : row.status === "lost"
                                  ? p.listResultLost
                                  : row.status === "void"
                                    ? p.listResultPostponed
                                    : "PENDING"
                            }
                          />
                        </div>
                      </SectionTrackLink>
                    </li>
                  ))}
                </ul>
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
      </section>

      {/*
        S3 — Today's Picks. Separation from S2 is whitespace only; the band's lower edge is the rule.

        `#trending-markets` is merged in as a context row beside the date control rather than
        standing as its own destination — same links, same data, a fraction of the height, and now
        functioning as context for the grid it sits above.
      */}
      <SectionPause />

      <section
        id="top-picks"
        data-analytics-section="top_picks"
        aria-labelledby="top-picks-heading"
        className="scroll-mt-28 pb-12 pt-4 md:pb-16 md:pt-6"
      >
        <SectionHeading
          id="top-picks-heading"
          eyebrow={p.topPicksEyebrow}
          title={p.topPicksTitle}
          description={p.topPicksDescription}
          lead
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

        {/* #trending-markets — one meta row of counts, not a four-cell figure grid. */}
        {marketRows.length ? (
          <ul
            id="trending-markets"
            data-analytics-section="trending_markets"
            className="-mx-1 mt-6 flex max-w-[72rem] scroll-mt-28 flex-nowrap gap-2 overflow-x-auto px-1 pb-1 lg:flex-wrap lg:overflow-visible"
          >
            {marketRows.map((market) => (
              <li key={market.market} className="shrink-0">
                <SectionTrackLink
                  href={homepageFixtureExplorerHref(locale, {
                    market: market.filterCode,
                  })}
                  section="trending_markets"
                  locale={locale}
                  className="press inline-flex min-h-11 items-center gap-2 rounded-md border border-border bg-[var(--canvas-secondary)] px-3 text-sm text-foreground hover:border-[var(--border-strong)]"
                >
                  <span>{market.label}</span>
                  <span className="font-mono tabular-nums text-[var(--ink-secondary)]">
                    {market.count}
                  </span>
                  {market.highest ? (
                    <span className="text-xs text-muted-foreground">
                      top {market.highest}%
                    </span>
                  ) : null}
                </SectionTrackLink>
              </li>
            ))}
          </ul>
        ) : (
          <p id="trending-markets" className="mt-6 scroll-mt-28 text-sm text-muted-foreground">
            Not enough settled results to report a trend.
          </p>
        )}

        {topFixtures.length ? (
          <div className="list-enter mt-10 grid max-w-[72rem] gap-5 sm:grid-cols-2 md:gap-6 lg:grid-cols-3">
            {topFixtures.map((fixture) => (
              <article
                key={fixture.id}
                className="flex flex-col border-t border-[var(--border-subtle)] pt-6"
              >
                {/*
                  The fixture leads. Previously the largest, most saturated element in this card was
                  the model percentage — 24px, brand green, above a 16px team name — which is the
                  house style of the genre this publication exists to separate from. The estimate is
                  now a qualifier set in the same measure as the market it qualifies, and the match
                  is the thing the eye lands on.

                  Three deletions, no additions: the `#1 · #2 · #3` leaderboard ordinal (position in
                  a list is not evidence), the restated evidence line (it printed the same number a
                  second time in the same card), and the accent colour on the figure.
                */}
                <p className="text-metadata font-medium uppercase tracking-label text-muted-foreground">
                  {fixture.league}
                </p>
                <p className="mt-3 font-display text-xl font-semibold leading-snug text-foreground">
                  {fixture.home}{" "}
                  <span className="font-normal text-[var(--ink-secondary)]">vs</span>{" "}
                  {fixture.away}
                </p>
                <p className="mt-3 text-sm text-[var(--ink-secondary)]">
                  {fixture.market} ·{" "}
                  <time dateTime={fixture.kickoffDateTime}>{fixture.kickoff}</time>
                </p>
                <p className="mt-1 text-sm text-[var(--ink-secondary)]">
                  <span className="font-mono tabular-nums">{fixture.modelProbability}%</span>{" "}
                  model estimate
                </p>
                {/* Provenance. Raised off the 10px step: this is the sentence that makes the card
                    research rather than a tip, and it was the smallest thing on it. */}
                <p className="mt-3 text-xs text-muted-foreground">
                  Observed <time dateTime={fixture.updatedDateTime}>{fixture.updatedAt}</time>
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <SectionTrackLink
                    href={fixturePath(
                      locale,
                      fixture.matchId,
                      fixture.marketKind,
                      "top_picks"
                    )}
                    section="top_picks"
                    locale={locale}
                    className="btn-primary min-h-10"
                  >
                    {p.topPicksOpenMatch}
                    <ArrowUpRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  </SectionTrackLink>
                  <AddToAccaButton
                    labelAdd={p.topPicksAddAcca}
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
                        `Model probability ${fixture.modelProbability}% on ${fixture.market}`,
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
          <div className="mt-6">
            <EmptySection text={p.topPicksEmpty} />
          </div>
        )}

        <p className="mt-6 text-sm text-muted-foreground">
          Prefer an automatic multi-leg Acca?{" "}
          <SectionTrackLink
            href={`/${locale}/acca/builder`}
            section="top_picks"
            locale={locale}
            className="font-medium text-foreground underline decoration-[var(--border-subtle)] underline-offset-4 hover:decoration-current"
          >
            Open Acca Builder
          </SectionTrackLink>
        </p>
      </section>

      {/*
        S4 — Live Signals. Supporting, not structural: no eyebrow, hairline rule above.

        It sits outside the trust sequence deliberately. This panel carries locked rows and an
        unlock prompt, and adjacency to the Proof Band is what would make a lock read as a paywall
        on evidence.
      */}
      <section
        data-analytics-section="live_matches"
        id="live-signals"
        aria-labelledby="live-matches-heading"
        className="scroll-mt-28 py-10 md:py-12"
      >
        <EditorialRule />
        {/*
          The only two-column composition on the page. Every other section stacks heading over
          content; this one sets the heading beside it, which is what makes S4 read as an aside
          rather than another instalment. Collapses to the stacked default below lg.
        */}
        <div className="mt-8 gap-10 lg:grid lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] lg:gap-16">
          <SectionHeading
            id="live-matches-heading"
            eyebrow="Live desk"
            title="Live matches"
            description="No live data for these matches yet. Scores appear once the provider reports them."
          />
          <div className="mt-6 max-w-2xl lg:mt-0">
            <LiveFeedPanel dict={dict} />
          </div>
        </div>
      </section>

      {/*
        S5 — Research. Deliberately the quietest section: the H2 sits at the `text-xl` step with no
        eyebrow, which is how the page signals a shift from narrative to tool.

        Merges `#featured-leagues` and `#saved` into the research surface as sub-blocks. Featured
        leagues becomes a single meta row rather than an eight-cell grid, and Saved a sub-block
        rather than a full section that exists to tell most visitors it is empty.
      */}
      <section
        data-analytics-section="recently_qualified"
        id="fixtures"
        aria-labelledby="recently-qualified"
        className="scroll-mt-28 border-t border-[var(--border-default)] pb-16 pt-14 md:pb-24 md:pt-16"
      >
        <p className="mb-1 text-metadata font-medium uppercase tracking-label text-muted-foreground">
          Research desk
        </p>
        <h2
          id="recently-qualified"
          className="font-display text-xl font-semibold tracking-display text-foreground"
        >
          Recently qualified
        </h2>
        <p className="mt-3 max-w-[38rem] text-sm leading-relaxed text-[var(--ink-secondary)]">
          Fixtures that cleared the model&rsquo;s qualification threshold, with the full explorer and
          the competitions driving today&rsquo;s list.
        </p>

        {/* #featured-leagues */}
        <div id="featured-leagues" className="mt-4 scroll-mt-28">
          <h3 id="featured-leagues-heading" className="sr-only">
            {p.leaguesTitle}
          </h3>
          <ul className="-mx-1 flex max-w-[72rem] flex-nowrap items-center gap-x-4 gap-y-2 overflow-x-auto px-1 text-sm lg:flex-wrap lg:overflow-visible">
            {trust.featuredLeagues.map((league) => (
              <li key={`${league.name}-${league.href ?? "label"}`} className="shrink-0">
                {league.href ? (
                  <SectionTrackLink
                    href={league.href}
                    section="featured_leagues"
                    locale={locale}
                    className="inline-flex min-h-11 items-center text-foreground underline decoration-[var(--border-subtle)] underline-offset-4 hover:decoration-current"
                  >
                    {league.name}
                  </SectionTrackLink>
                ) : (
                  <span className="inline-flex min-h-11 items-center text-muted-foreground">
                    {league.name}
                  </span>
                )}
              </li>
            ))}
            <li className="shrink-0">
              <SectionTrackLink
                href={`/${locale}/competitions`}
                section="featured_leagues"
                locale={locale}
                className="inline-flex min-h-11 items-center gap-1 font-medium text-foreground underline decoration-[var(--border-subtle)] underline-offset-4 hover:decoration-current"
              >
                {p.leaguesAll}
                <ArrowUpRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
              </SectionTrackLink>
            </li>
          </ul>
          <p className="mt-3 max-w-[38rem] text-base leading-relaxed text-[var(--ink-secondary)]">
            {p.leaguesDescription}
          </p>
        </div>

        <div className="mt-6">
          <BibleFixtureExplorer lists={lists} dict={dict} />
        </div>

        {/* #saved */}
        <div data-analytics-section="saved" id="saved" className="mt-10 scroll-mt-28">
          <h3
            id="saved-heading"
            className="font-display text-h3 tracking-display text-foreground"
          >
            Saved
          </h3>
          <p className="mt-2 max-w-[38rem] text-base leading-relaxed text-[var(--ink-secondary)]">
            Fixtures you save stay in this browser so you can reopen match evidence quickly.
          </p>
          <div className="mt-4">
            <SavedFixturesPanel locale={locale} />
          </div>
        </div>
      </section>

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
      <SectionPause />

      <section
        id="why-trust"
        data-analytics-section="why_trust"
        aria-labelledby="why-trust-heading"
        className="scroll-mt-28 pb-20 pt-4 md:pb-28 md:pt-6"
      >
        <SectionHeading
          id="why-trust-heading"
          eyebrow={p.whyEyebrow}
          title={p.whyTitle}
          description="How this publication is produced — and how every figure above can be checked against the record rather than taken on trust."
          lead
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
        <ol className="mt-8 max-w-[46rem] border-t border-[var(--border-subtle)]">
          {[p.whyPublished, p.whyEvidence, p.whyLive, p.whySettlement, p.whyArchive].map(
            (item, index) => (
              <li
                key={item}
                className="grid grid-cols-[2.25rem_1fr] gap-x-4 border-b border-[var(--border-subtle)] py-4 md:grid-cols-[3rem_1fr] md:gap-x-6 md:py-5"
              >
                <span
                  aria-hidden
                  className="font-mono text-body-sm font-semibold tabular-nums text-[var(--ink-muted)] md:text-body"
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <p className="text-base leading-relaxed text-[var(--ink-secondary)]">{item}</p>
              </li>
            )
          )}
        </ol>

        {/* #research-notes / #methodology */}
        {/*
          Evidence and archive are the section's other two arguments, and they were previously
          stacked as bare `mt-10` divs behind headings a half-step above body text. A trust
          argument presented at body weight reads as a footnote to the one above it. Each is now
          a ruled block with a `text-h3` heading, so the section reads as three stated claims of
          equal standing — method, evidence, record — rather than one list and two afterthoughts.
        */}
        <div
          data-analytics-section="latest_insights"
          id="research-notes"
          className="mt-12 border-t border-[var(--border-subtle)] pt-8 scroll-mt-28"
        >
          <h3
            id="methodology-heading"
            className="font-display text-h3 tracking-display text-foreground"
          >
            How qualification works
          </h3>
          <div id="methodology" className="mt-4 scroll-mt-28">
            <BibleHomeNotes dict={dict} locale={locale} />
          </div>
          <p className="mt-4 max-w-[46rem] text-base leading-relaxed text-muted-foreground">
            {p.trustFooterNote}
          </p>
        </div>

        {/* #prediction-archive */}
        <div
          id="prediction-archive"
          data-analytics-section="prediction_archive"
          className="mt-12 max-w-[46rem] border-t border-[var(--border-subtle)] pt-8 scroll-mt-28"
        >
          <p className="text-metadata font-medium uppercase tracking-label text-muted-foreground">
            {p.archiveEyebrow}
          </p>
          <h3
            id="prediction-archive-heading"
            className="mt-1 font-display text-h3 tracking-display text-foreground"
          >
            {p.archiveTitle}
          </h3>
          <p className="mt-2 text-base leading-relaxed text-[var(--ink-secondary)]">
            {p.archiveBody}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <SectionTrackLink
              href={`/${locale}/methodology`}
              section="prediction_archive"
              locale={locale}
              className="btn-primary min-h-11"
            >
              {p.archiveCtaMethod}
            </SectionTrackLink>
            <SectionTrackLink
              href={`/${locale}/archive`}
              section="prediction_archive"
              locale={locale}
              className="btn-secondary min-h-11"
            >
              {p.archiveCtaDate}
            </SectionTrackLink>
          </div>
        </div>
      </section>
      {/*
        S7 — Bookmakers. After every research surface, without exception.

        The strip already states that the research above is separate from commercial offers. Placed
        here — last on the page, after the method as well as the research — that claim becomes
        literally true of the layout, which is what a reader actually believes rather than the
        sentence. The accumulator entry travels with it: it is a commercial funnel, not research.
      */}
      <section
        data-analytics-section="top_operators"
        className="pb-16 pt-10 md:pb-20 md:pt-12"
      >
        <EditorialRule />
        <div className="mt-8 max-w-[72rem]">
          <BibleOperatorStrip
            dict={dict}
            locale={locale}
            subidBase="homepage-top-operators"
            countryContext={countryContext}
            featuredLeagues={trust.featuredLeagues}
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
      </section>

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
    <div className="group relative min-w-[168px] flex-1 pt-6">
      <span aria-hidden className="absolute left-0 top-0 h-px w-full bg-[var(--hero-line)]" />
      <span
        aria-hidden
        className="absolute left-0 top-0 h-px w-full origin-left scale-x-0 bg-[var(--hero-ink)] transition-transform duration-[var(--dur-reveal)] ease-[var(--ease-settle)] group-hover:scale-x-100"
      />
      <span
        aria-hidden
        className="absolute left-0 top-0 h-[9px] w-px bg-[var(--hero-ink)] transition-all duration-[var(--dur-respond)] group-hover:h-4"
      />

      <dt className="rw-label pl-4 text-[var(--hero-ink-3)]">{label}</dt>
      <dd className="rw-tnum rw-display mt-6 pl-4 text-[clamp(2.4rem,4.4vw,3.6rem)] transition-transform duration-[var(--dur-expand)] ease-[var(--ease-respond)] group-hover:-translate-y-0.5">
        {value}
      </dd>

      {note ? (
        <div className="relative mt-3 pl-4">
          <p
            className={`max-w-[22ch] text-[13px] leading-5 text-[var(--hero-ink-2)] ${
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
              className="pointer-events-none absolute inset-0 max-w-[26ch] text-[13px] leading-5 text-[var(--hero-ink)] opacity-0 transition-opacity duration-[var(--dur-expand)] ease-[var(--ease-settle)] group-hover:opacity-100"
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
 * so they differ in tone and are named at each end — but tone is not weight here: the lengths carry
 * the ratio, and the counts themselves are stated at identical size in the figure above. The rule
 * shows the shape of the record; it does not rank the two outcomes.
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
    <div className="mt-10" aria-hidden>
      <div className="flex h-[3px] w-full overflow-hidden bg-[var(--hero-line)]">
        <span style={{ flexGrow: won }} className="block bg-[var(--hero-ink)]" />
        <span style={{ flexGrow: lost }} className="block bg-[var(--hero-ink-3)]" />
      </div>
      <div className="mt-2 flex justify-between">
        <span className="rw-label text-[var(--hero-ink-3)]">{wonLabel}</span>
        <span className="rw-label text-[var(--hero-ink-3)]">{lostLabel}</span>
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
 * Monochrome, like the rule above it. Each mark still names its own outcome in `sr-only` text, so
 * the sequence is fully readable without relying on tone at all.
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
  const tone: Record<string, string> = {
    won: "bg-[var(--hero-ink)]",
    lost: "bg-[var(--hero-ink-3)]",
    void: "bg-[var(--hero-line)]",
  };
  return (
    <div className="mt-8">
      <p className="rw-label text-[var(--hero-ink-3)]">{label}</p>
      <ol className="mt-2 flex flex-wrap gap-1.5">
        {settled.map((row) => (
          <li key={row.id}>
            <span className={`block h-6 w-2.5 ${tone[row.status] ?? tone.void}`}>
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
function SectionPause() {
  return (
    <div className="flex justify-center py-12 md:py-16" aria-hidden>
      <span className="h-px w-10 bg-[var(--border-strong)]" />
    </div>
  );
}

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

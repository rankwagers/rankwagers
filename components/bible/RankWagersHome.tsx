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
import {
  EmptySection,
  SectionHeading,
  StatusBadge,
} from "@/components/homepage/sectionChrome";
import type { HomepageTrustModel } from "@/lib/homepage/types";
import { formatDict } from "@/lib/dictionaryExtras";

const marketNames = {
  fh: "1st half goal",
  over15: "Over 1.5 goals",
  over25: "Over 2.5 goals",
  sh: "2nd half goal",
} as const;

/*
 * Editorial masthead copy. A journal announces itself before it reports — the nameplate is the one
 * element that frames every section below as edited copy rather than a dashboard readout. This is a
 * masthead (the publication's subject), NOT the section eyebrow that S1 deliberately dropped: that
 * eyebrow paraphrased the headline; this names the publication. Hardcoded like the other in-component
 * English strings (`Live matches`, `Recently qualified`, `Saved`) so it moves with this layout.
 */
const MASTHEAD_KICKER = "Football Intelligence";
const MASTHEAD_REMIT =
  "An independent, evidence-led football review. Every projection is published before kickoff and settled, in public, against the result.";

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
 *   → S6 Bookmakers → S7 How This Works
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
 *   S7 ← `#why-trust` + `#research-notes`/`#methodology` + `#prediction-archive`
 *
 * Separation is not uniform (spec §1.4) — three treatments, so the page has a rhythm rather
 * than a pulse: S2 is the only full-bleed band; S4–S6 are hairline-ruled; S1→S2→S3 and
 * S6→S7 are separated by whitespace alone.
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
        S1 — Hero.

        A statement, one sentence, a dateline, and the disclosure. Nothing else.

        What left, and where it went: the eyebrow (it paraphrased the headline), both calls to
        action (the reader is about to scroll into the record; a button to it is noise), the search
        field, the live count and the date control — all three are returning-reader tools and now sit
        with the fixtures they operate on. The model-version string is gone entirely: a version
        number is an engineering fact, and it was occupying the highest-value space on the site.

        What arrived: the dateline, and the commission disclosure. A publication states when it was
        compiled and who pays for it before it states anything else.

        No bottom rule: S2's own full-bleed edge is the separation, and a border here would double it.
      */}
      <section
        id="today"
        data-analytics-section="hero"
        aria-labelledby="homepage-hero-heading"
        className="pb-14 pt-8 md:pb-20 md:pt-12"
      >
        {/*
          Masthead. The publication nameplate, above the headline, with a rule beneath it — the
          journal states what it is before it states anything. Not a heading (the H1 below is the
          page's only H1); a decorative nameplate, so screen readers meet the headline first.
        */}
        <div className="mb-8 border-b border-[var(--border-subtle)] pb-6">
          <p className="font-display text-metadata font-semibold uppercase tracking-label text-foreground">
            {MASTHEAD_KICKER}
          </p>
          <p className="mt-2 max-w-[46rem] text-sm leading-relaxed text-muted-foreground">
            {MASTHEAD_REMIT}
          </p>
        </div>
        <h1
          id="homepage-hero-heading"
          className="max-w-[46rem] font-display text-4xl font-semibold leading-[1.05] tracking-display text-foreground md:text-5xl"
        >
          {p.heroTitle}
        </h1>
        <p className="mt-6 max-w-[34rem] text-lg leading-relaxed text-[var(--ink-secondary)] md:text-xl">
          {p.heroSubtitle}
        </p>
        {assessedLabel ? (
          <p className="mt-8 text-sm text-muted-foreground">
            <time dateTime={trust.verified.lastUpdatedAt ?? undefined}>{assessedLabel}</time>
          </p>
        ) : null}
        {/*
          Trust hierarchy, tier 1. The commercial interest is disclosed before any figure it could
          bias, and it makes no promise about its own effect — it points at the published criteria
          so the reader can check rather than believe.
        */}
        <p className="mt-2 max-w-[34rem] text-xs leading-relaxed text-muted-foreground">
          {p.heroDisclosure}
        </p>
      </section>

      {/*
        S2 — The Proof Band. The second half of the first viewport.

        The denominator arrives before any claim built on it: sample, then won, then lost, then the
        rate. `Won` and `Lost` are rendered identically — same size, same weight, same colour, same
        row. The asymmetry a reader expects to find here is the thing the rest of the page is worth,
        and diminishing the loss count would forfeit it.

        Two tiers, not four equal cards. `Won` and `Lost` are the argument and are sized as such;
        `Settled`, `Hit rate`, `Pending` and `Void` are the context that makes them readable and sit
        a full step down. Four cards of identical weight made this a dashboard — and a dashboard has
        no message, because nothing in it is more important than anything else.

        Won and Lost keep IDENTICAL numerals — same size, same weight, same ink. Colour appears only
        in the state dot, the proportional bar and the form strip, never in the figures themselves.
        The invariant is that the loss is never diminished; it is not that the two may never be
        distinguished.

        The bar is the visual proof. It carries no arithmetic — the two segments are flex children
        given `flexGrow` of the won and lost counts themselves, so the ratio is laid out by the
        browser rather than computed here. It exists because a reader who will not do division still
        understands a length, and because it makes the loss unmissable rather than merely disclosed.

        The form strip is the historical confidence: the actual settled sequence, newest first, in
        the order `recentResults` already supplies. A summary asserts a record; a sequence shows one.

        The sample note moves from the lead to a footnote beneath the figures. It is the most honest
        sentence on the page and it was also 199 characters of internal vocabulary standing between
        the reader and the numbers. `verifiedDescription` — written for this section and never wired
        — leads instead, and the precise version sits directly under the figures where a sceptic
        looks. Nothing is softened; the order is changed.

        `#recent-results` is merged in below the totals it reconciles with — the individual outcomes
        and their summary are one argument, and splitting them across a rule made the reader assemble
        it themselves.

        Tonal band, bled to the shell edge, so the section that carries the argument is the one
        section that looks different — earned through scale and space rather than colour.
      */}
      <section
        id="verified-performance"
        data-analytics-section="verified_performance"
        aria-labelledby="verified-performance-heading"
        className="-mx-4 scroll-mt-28 border-y border-[var(--border-subtle)] bg-[var(--canvas-secondary)] px-4 py-14 sm:-mx-6 sm:px-6 md:py-20 lg:-mx-10 lg:px-10"
      >
        <SectionHeading
          id="verified-performance-heading"
          title={p.verifiedTitle}
          description={p.verifiedDescription}
          lead
        />
        {trust.verified.availability === "available" ? (
          <div>
            <p className="mt-1 text-sm text-[var(--ink-secondary)]">{trust.verified.windowLabel}</p>

            {/* Targeted by AccaChrome's launcher yield — the figures themselves, not the whole
                section, which also contains recent-results and runs most of the page height. */}
            <div id="verified-performance-figures" className="mt-10 max-w-[52rem]">
              {/*
                Never `grid-cols-1`. WON and LOST must sit side by side on every viewport — the
                comparison is the message, and stacking them destroys it.
              */}
              <dl className="grid grid-cols-2 items-stretch gap-px overflow-hidden rounded-lg border border-border bg-border">
                <VerdictFigure
                  label={p.verifiedWon}
                  value={String(trust.verified.won)}
                  tone="won"
                />
                <VerdictFigure
                  label={p.verifiedLost}
                  value={String(trust.verified.lost)}
                  tone="lost"
                />
              </dl>

              <ProofBar
                won={trust.verified.won}
                lost={trust.verified.lost}
                wonLabel={p.verifiedWon}
                lostLabel={p.verifiedLost}
              />

              {/*
                Context, one step down. The denominator leads it: "over how many?" is the first
                question a sceptic asks of a rate, and answering it before the rate is stated costs
                nothing and pre-empts the objection.
              */}
              <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
                <ContextFigure
                  label={p.verifiedSettled}
                  value={String(trust.verified.settledPredictions)}
                />
                <ContextFigure
                  label={p.verifiedHitRate}
                  value={
                    trust.verified.hitRatePct != null
                      ? `${trust.verified.hitRatePct}%`
                      : "—"
                  }
                />
                <ContextFigure
                  label={p.verifiedPending}
                  value={String(trust.verified.pendingPredictions)}
                />
                <ContextFigure
                  label={p.verifiedVoid}
                  value={String(trust.verified.voidPredictions)}
                />
              </dl>

              <FormStrip results={trust.recentResults} label={p.recentTitle} />

              {/*
                The sample note, in its proper place: under the figures it qualifies, at caption
                size, where a reader who doubts the numbers will look for exactly this.
              */}
              <p className="mt-6 max-w-[46rem] text-caption leading-relaxed text-[var(--ink-secondary)]">
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
                className="font-display text-base font-semibold text-foreground md:text-lg"
              >
                {p.recentTitle}
              </h3>
              <p className="mt-2 max-w-[38rem] text-base leading-relaxed text-[var(--ink-secondary)]">
                {p.recentDescription}
              </p>
              {trust.recentResults.length ? (
                <ul className="list-enter mt-4 divide-y divide-[var(--border-subtle)] rounded-lg border border-border bg-[var(--canvas-primary)]">
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
      <section
        id="top-picks"
        data-analytics-section="top_picks"
        aria-labelledby="top-picks-heading"
        className="scroll-mt-28 py-12 md:py-16"
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
            className="mt-6 max-w-[38rem] rounded-lg border border-border bg-[var(--canvas-secondary)] px-4 py-3 text-sm leading-relaxed text-[var(--ink-secondary)]"
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
                className="flex flex-col rounded-lg border border-border bg-[var(--canvas-secondary)] p-5 md:p-6"
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
        className="scroll-mt-28 border-t border-[var(--border-subtle)] py-12 md:py-16"
      >
        <SectionHeading
          id="live-matches-heading"
          eyebrow="Live desk"
          title="Live matches"
          description="No live data for these matches yet. Scores appear once the provider reports them."
          lead
        />
        <div className="mt-6 max-w-2xl">
          <LiveFeedPanel dict={dict} />
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
        className="scroll-mt-28 border-t border-[var(--border-subtle)] py-12 md:py-16"
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
            className="font-display text-base font-semibold text-foreground md:text-lg"
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
      <section
        id="why-trust"
        data-analytics-section="why_trust"
        aria-labelledby="why-trust-heading"
        className="scroll-mt-28 border-t border-[var(--border-subtle)] py-12 md:py-16"
      >
        <SectionHeading
          id="why-trust-heading"
          eyebrow={p.whyEyebrow}
          title={p.whyTitle}
          description="How this publication is produced — and how every figure above can be checked against the record rather than taken on trust."
          lead
        />
        <ol className="mt-8 max-w-[46rem] space-y-4">
          {[p.whyPublished, p.whyEvidence, p.whyLive, p.whySettlement, p.whyArchive].map(
            (item, index) => (
              <li key={item} className="flex gap-4">
                <span
                  aria-hidden
                  className="font-mono text-sm tabular-nums text-muted-foreground"
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <p className="text-base leading-relaxed text-[var(--ink-secondary)]">{item}</p>
              </li>
            )
          )}
        </ol>

        {/* #research-notes / #methodology */}
        <div
          data-analytics-section="latest_insights"
          id="research-notes"
          className="mt-10 scroll-mt-28"
        >
          <h3
            id="methodology-heading"
            className="font-display text-base font-semibold text-foreground md:text-lg"
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
          className="mt-10 max-w-[46rem] scroll-mt-28"
        >
          <p className="text-metadata font-medium uppercase tracking-label text-muted-foreground">
            {p.archiveEyebrow}
          </p>
          <h3
            id="prediction-archive-heading"
            className="mt-1 font-display text-base font-semibold text-foreground md:text-lg"
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
              className="inline-flex min-h-11 items-center rounded-md border border-border bg-[var(--canvas-secondary)] px-4 text-sm font-semibold text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
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
        className="border-t border-[var(--border-subtle)] pb-16 pt-12 md:pb-20 md:pt-16"
      >
        <div className="max-w-[72rem]">
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
 * A verdict figure — `Won` or `Lost`. The two largest numerals on the homepage.
 *
 * Renders as a `dt`/`dd` pair inside the row's `dl`, so a screen reader announces "Lost, 43" as one
 * term and its definition. As sibling paragraphs the label and the numeral were two unrelated
 * announcements, and a reader who cannot see the card had no way to bind them.
 *
 * The numeral is identical in size, weight and ink for both tones — only the state dot carries
 * colour. Diminishing the loss by size, weight, a paler ink or position would forfeit the one claim
 * this section exists to make.
 *
 * `text-[var(--ink-secondary)]` on the label rather than `text-muted-foreground`: at 11px the muted
 * token measures 4.4:1 against this canvas, under the 4.5:1 AA floor for text this size.
 */
function VerdictFigure({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "won" | "lost";
}) {
  const dot =
    tone === "won" ? "bg-[var(--status-won-fg)]" : "bg-[var(--status-lost-fg)]";
  return (
    <div className="flex h-full flex-col bg-[var(--canvas-primary)] p-5 md:p-7">
      <dt className="flex items-center gap-2 text-metadata font-medium uppercase tracking-label text-[var(--ink-secondary)]">
        <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
        {label}
      </dt>
      <dd className="mt-4 font-mono text-5xl font-semibold leading-none tracking-tight tabular-nums text-foreground md:text-6xl">
        {value}
      </dd>
    </div>
  );
}

/**
 * A context figure — the denominator, the rate, and the two states that are neither won nor lost.
 *
 * A full step below a verdict figure in every dimension: no card, no fill, no rule, a numeral at a
 * third of the size. These exist to make the pair above readable, not to compete with it. Four
 * figures of equal weight is a dashboard, and a dashboard has no message.
 */
function ContextFigure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-metadata font-medium uppercase tracking-label text-[var(--ink-secondary)]">
        {label}
      </dt>
      <dd className="mt-1 font-mono text-xl font-semibold tabular-nums text-foreground">
        {value}
      </dd>
    </div>
  );
}

/**
 * The proportional bar — won against lost, at a glance.
 *
 * Carries NO arithmetic. The two segments are flex children whose `flexGrow` is the won and lost
 * count itself, so the ratio is resolved by the layout engine rather than computed here; nothing in
 * this file divides, rounds or derives a percentage. It exists because a reader who will not do
 * division still understands a length, and because it makes the loss unmissable rather than merely
 * disclosed.
 *
 * Renders nothing when nothing has settled: a bar of zero width states a ratio that does not exist.
 *
 * `aria-hidden` — every figure it depicts is announced by the `dl` above it, and a bar that
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
    <div className="mt-5" aria-hidden>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full border border-border bg-[var(--canvas-primary)]">
        <span style={{ flexGrow: won }} className="block bg-[var(--status-won-fg)]" />
        <span style={{ flexGrow: lost }} className="block bg-[var(--status-lost-fg)]" />
      </div>
      <div className="mt-2 flex justify-between text-metadata font-medium uppercase tracking-label text-[var(--ink-secondary)]">
        <span>{wonLabel}</span>
        <span>{lostLabel}</span>
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
 * Pending rows are excluded rather than drawn in a third colour: this is the settled record, and an
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
    won: "bg-[var(--status-won-fg)]",
    lost: "bg-[var(--status-lost-fg)]",
    void: "bg-[var(--border-strong)]",
  };
  return (
    <div className="mt-6">
      <p className="text-metadata font-medium uppercase tracking-label text-[var(--ink-secondary)]">
        {label}
      </p>
      <ol className="mt-2 flex flex-wrap gap-1.5">
        {settled.map((row) => (
          <li key={row.id}>
            <span
              className={`block h-6 w-2.5 rounded-sm ${tone[row.status] ?? tone.void}`}
            >
              <span className="sr-only">{`${row.home} vs ${row.away}: ${row.status}`}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

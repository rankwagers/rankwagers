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
        className="pb-10 pt-6 md:pb-12 md:pt-8"
      >
        <h1
          id="homepage-hero-heading"
          className="max-w-[46rem] font-display text-4xl font-semibold leading-[1.05] tracking-display text-foreground md:text-5xl"
        >
          {p.heroTitle}
        </h1>
        <p className="mt-5 max-w-[38rem] text-base leading-relaxed text-[var(--ink-secondary)] md:text-lg">
          {p.heroSubtitle}
        </p>
        {assessedLabel ? (
          <p className="mt-6 text-sm text-[var(--ink-secondary)]">
            <time dateTime={trust.verified.lastUpdatedAt ?? undefined}>{assessedLabel}</time>
          </p>
        ) : null}
        {/*
          Trust hierarchy, tier 1. The commercial interest is disclosed before any figure it could
          bias, and it makes no promise about its own effect — it points at the published criteria
          so the reader can check rather than believe.
        */}
        <p className="mt-3 max-w-[38rem] text-xs leading-relaxed text-[var(--ink-secondary)]">
          {p.heroDisclosure}
        </p>
      </section>

      {/*
        S2 — The Proof Band. The second half of the first viewport.

        The denominator arrives before any claim built on it: sample, then won, then lost, then the
        rate. `Won` and `Lost` are rendered identically — same size, same weight, same colour, same
        row. The asymmetry a reader expects to find here is the thing the rest of the page is worth,
        and diminishing the loss count would forfeit it.

        The sample note is promoted from a footnote to the lead: a platform declining to publish a
        flattering number it cannot substantiate is the strongest sentence on the page.

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
        className="-mx-4 scroll-mt-28 border-y border-[var(--border-subtle)] bg-[var(--canvas-secondary)] px-4 py-10 sm:-mx-6 sm:px-6 md:py-12 lg:-mx-10 lg:px-10"
      >
        <SectionHeading
          id="verified-performance-heading"
          title={p.verifiedTitle}
          description={trust.verified.sampleNote}
          lead
        />
        {trust.verified.availability === "available" ? (
          <div>
            <p className="mt-1 text-sm text-[var(--ink-secondary)]">{trust.verified.windowLabel}</p>
            {/*
              Never `grid-cols-1`. WON and LOST must sit side by side on every viewport — the
              comparison is the message, and stacking them destroys it.
            */}
            {/* Targeted by AccaChrome's launcher yield — the figures themselves, not the whole
                section, which also contains recent-results and runs most of the page height. */}
            <dl
              id="verified-performance-figures"
              className="mt-8 grid max-w-[72rem] grid-cols-2 items-stretch gap-4 sm:gap-5 lg:grid-cols-4"
            >
              <MetricCard
                label={p.verifiedSettled}
                value={String(trust.verified.settledPredictions)}
                detail={`${trust.verified.pendingPredictions} ${p.verifiedPending.toLowerCase()}`}
              />
              <MetricCard label={p.verifiedWon} value={String(trust.verified.won)} />
              <MetricCard label={p.verifiedLost} value={String(trust.verified.lost)} />
              <MetricCard
                label={p.verifiedHitRate}
                value={
                  trust.verified.hitRatePct != null
                    ? `${trust.verified.hitRatePct}%`
                    : "—"
                }
                detail={`${p.verifiedVoid}: ${trust.verified.voidPredictions}`}
              />
            </dl>

            {/* #recent-results — merged into the band, directly beneath the totals. */}
            <div
              id="recent-results"
              data-analytics-section="recent_results"
              className="mt-8 max-w-[72rem] scroll-mt-28"
            >
              <h3
                id="recent-results-heading"
                className="font-display text-base font-semibold text-foreground md:text-lg"
              >
                {p.recentTitle}
              </h3>
              <p className="mt-2 max-w-[38rem] text-sm leading-relaxed text-[var(--ink-secondary)]">
                {p.recentDescription}
              </p>
              {trust.recentResults.length ? (
                <ul className="mt-4 divide-y divide-[var(--border-subtle)] rounded-lg border border-border bg-[var(--canvas-primary)]">
                  {trust.recentResults.map((row) => (
                    <li key={row.id}>
                      <SectionTrackLink
                        href={row.matchHref}
                        section="recent_results"
                        locale={locale}
                        className="flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-[var(--canvas-secondary)] sm:flex-row sm:items-center sm:justify-between"
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

            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm">
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
        className="scroll-mt-28 py-10 md:py-12"
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
                  className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border bg-[var(--canvas-secondary)] px-3 text-sm text-foreground transition-colors hover:border-[var(--border-strong)]"
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
          <div className="mt-6 grid max-w-[72rem] gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {topFixtures.map((fixture, index) => (
              <article
                key={fixture.id}
                className="flex flex-col rounded-lg border border-border bg-[var(--canvas-secondary)] p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-metadata font-medium uppercase tracking-label text-muted-foreground">
                    #{index + 1} · {fixture.league}
                  </p>
                  <strong className="font-mono text-2xl font-semibold tabular-nums text-brand">
                    {fixture.modelProbability}%
                  </strong>
                </div>
                <p className="mt-4 text-lg font-semibold leading-snug text-foreground">
                  {fixture.home}{" "}
                  <span className="font-normal text-muted-foreground">vs</span>{" "}
                  {fixture.away}
                </p>
                <p className="mt-2 text-sm text-[var(--ink-secondary)]">
                  {fixture.market} ·{" "}
                  <time dateTime={fixture.kickoffDateTime}>{fixture.kickoff}</time>
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {formatDict(p.topPicksEvidence, {
                    pct: String(fixture.modelProbability),
                    market: fixture.market,
                  })}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
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
                    <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
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
        className="scroll-mt-28 border-t border-[var(--border-subtle)] py-8 md:py-10"
      >
        <SectionHeading
          id="live-matches-heading"
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
        className="scroll-mt-28 border-t border-[var(--border-subtle)] py-8 md:py-10"
      >
        <h2
          id="recently-qualified"
          className="font-display text-xl font-semibold tracking-display text-foreground"
        >
          Recently qualified
        </h2>

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
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
              </SectionTrackLink>
            </li>
          </ul>
          <p className="mt-3 max-w-[38rem] text-sm leading-relaxed text-[var(--ink-secondary)]">
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
          <p className="mt-2 max-w-[38rem] text-sm leading-relaxed text-[var(--ink-secondary)]">
            Fixtures you save stay in this browser so you can reopen match evidence quickly.
          </p>
          <div className="mt-4">
            <SavedFixturesPanel locale={locale} />
          </div>
        </div>
      </section>

      {/*
        S6 — Bookmakers. After every research surface, without exception.

        The strip already states that the research above is separate from commercial offers. Placed
        here, that claim becomes literally true of the layout — which is what a reader actually
        believes, rather than the sentence.
      */}
      <section
        data-analytics-section="top_operators"
        className="border-t border-[var(--border-subtle)] py-8 md:py-10"
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

      {/*
        S7 — How This Works. Separated by whitespace, not a rule: the page opens and closes at the
        same editorial measure, which is what makes it read as composed rather than assembled.

        Merges `#why-trust`, `#research-notes`/`#methodology` and `#prediction-archive` — three
        sections that made the same argument in three places. The five reasons lose their card
        chrome and become text rows; a bordered box around a sentence adds height, not meaning.

        Ending on method rather than on monetisation is the positioning, expressed as an order.
      */}
      <section
        id="why-trust"
        data-analytics-section="why_trust"
        aria-labelledby="why-trust-heading"
        className="scroll-mt-28 pb-12 pt-10 md:pb-16 md:pt-12"
      >
        <SectionHeading id="why-trust-heading" eyebrow={p.whyEyebrow} title={p.whyTitle} />
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
          <p className="mt-4 max-w-[46rem] text-sm text-muted-foreground">
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
    </div>
  );
}

/**
 * One figure from the settled record.
 *
 * Renders as a `dt`/`dd` pair inside the row's `dl`, so a screen reader announces "Lost, 43" as one
 * term and its definition. As sibling paragraphs the label and the numeral were two unrelated
 * announcements, and a reader who cannot see the card had no way to bind them.
 *
 * `text-[var(--ink-secondary)]` on the label rather than `text-muted-foreground`: at 11px the muted
 * token measures 4.4:1 against this canvas, under the 4.5:1 AA floor for text this size.
 */
function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="flex h-full flex-col rounded-lg border border-border bg-[var(--canvas-primary)] p-5">
      <dt className="text-metadata font-medium uppercase tracking-label text-[var(--ink-secondary)]">
        {label}
      </dt>
      {/*
        The largest numerals on the homepage. Reserved for the settled record — no other figure on
        the page may use this step, or the record stops being the loudest thing on it.
      */}
      <dd className="mt-3 font-mono text-4xl font-semibold leading-none tabular-nums text-foreground">
        {value}
      </dd>
      {/*
        The detail line is always rendered, empty or not. Two of the four cards carry one, and
        without a reserved slot their numerals would sit on a different baseline from the other two
        — the row would read as four cards rather than one comparison.
      */}
      <dd className="mt-3 min-h-[1.25rem] text-xs leading-5 text-[var(--ink-secondary)]">
        {detail ?? " "}
      </dd>
    </div>
  );
}

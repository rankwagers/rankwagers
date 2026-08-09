import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { JsonLd } from "@/components/JsonLd";
import { LiveMatchSection } from "@/components/live/LiveMatchSection";
import type { Locale } from "@/lib/i18n";
import type { MatchPageBundle } from "@/lib/fixtures/loadMatchPage.server";
import type { PredictionStrings } from "@/lib/translations/predictionsEn";
import type { EvidenceSnapshotView } from "@/types/evidence";
import { matchBreadcrumbLd, matchSportsEventLd } from "@/lib/fixtures/schema";
import { buildFixtureEvidenceView } from "@/lib/fixtures/evidenceView";
import { scoreFixtureSignals } from "@/lib/fixtureSignals";
import { FixtureModelWhy } from "./FixtureModelWhy";
import { FixtureResearchSection } from "./FixtureResearchSection";
import { FixtureRecordSection } from "./FixtureRecordSection";
import { FixtureSignalLevels } from "./FixtureSignalLevels";
import { LocalTime } from "./LocalTime";
import { MatchDetailTracker } from "./MatchDetailTracker";
import { MatchLiveRefresh } from "./MatchLiveRefresh";
import { MatchPredictionsPanel } from "./MatchPredictionsPanel";
import { MatchRelatedLink } from "./MatchRelatedLink";

function scoreText(home: number | null, away: number | null): string {
  if (home == null || away == null) return "–";
  return `${home}–${away}`;
}

export function MatchDetailView({
  locale,
  bundle,
  source,
  latestSnapshot,
  p,
}: {
  locale: Locale;
  bundle: MatchPageBundle;
  source: string | null;
  /** The newest archived evidence snapshot for this fixture, or null — L3's provenance line. */
  latestSnapshot: EvidenceSnapshotView | null;
  p: PredictionStrings;
}) {
  const { model, focusMarket, detail } = bundle;
  const { header } = model;
  const description = `${header.homeTeam} vs ${header.awayTeam} — evidence, live context, and transparent prediction settlement on RankWagers.`;
  const sportsEvent = matchSportsEventLd({ locale, header, description });

  // A blank or placeholder value must not produce a labelled-but-empty eyebrow.
  const hasCompetition = Boolean(header.competition?.trim()) && header.competition !== "—";
  const hasCountry = Boolean(header.country?.trim()) && header.country !== "—";
  const competitionEyebrow = hasCompetition
    ? hasCountry
      ? `${header.competition} · ${header.country}`
      : header.competition
    : hasCountry
      ? header.country
      : null;

  const evidence = buildFixtureEvidenceView(detail);

  /*
   * THE FIVE LEVELS. Signals are scored once, here, and split by level — L1/L2 render the ranked
   * findings, L3 reconciles them with the model, L4 carries everything else, and no sentence
   * appears at two levels. The provider potential for the page's market feeds L3's numeral.
   */
  const signalReport = scoreFixtureSignals({
    homeAtHome: detail?.homeAtHome,
    awayAtAway: detail?.awayAtAway,
    leagueSeason: detail?.leagueSeason,
    history: detail?.history,
  });
  const teams = { home: header.homeTeam, away: header.awayTeam };
  const focusPrediction =
    model.predictions.find((row) => row.marketKey === focusMarket && row.confidence != null) ??
    model.predictions.find((row) => row.confidence != null) ??
    null;
  const potential =
    focusPrediction && focusPrediction.confidence != null
      ? { pct: Math.round(focusPrediction.confidence), marketLabel: focusPrediction.marketLabel }
      : null;

  return (
    <div className="rw-hero container-wide bg-[var(--hero-canvas)] pb-24">
      <MatchDetailTracker
        matchId={header.matchId}
        locale={locale}
        league={header.competition}
        country={header.country}
        market={focusMarket}
        source={source}
        lifecycle={header.lifecycle}
      />
      <MatchLiveRefresh
        enabled={model.refreshPolicy.mode === "live_soft"}
        intervalSec={model.refreshPolicy.intervalSec}
      />
      <JsonLd data={matchBreadcrumbLd({ locale, header })} />
      {sportsEvent ? <JsonLd data={sportsEvent} /> : null}

      <nav aria-label="Breadcrumb" className="rw-m mb-6 text-[var(--hero-ink-2)]">
        <ol className="flex flex-wrap items-center gap-1">
          <li>
            <Link href={model.related.homeHref} className="hover:text-[var(--hero-ink)]">
              Home
            </Link>
          </li>
          <li aria-hidden>/</li>
          {model.related.competitionHref ? (
            <>
              <li>
                <MatchRelatedLink
                  href={model.related.competitionHref}
                  matchId={header.matchId}
                  locale={locale}
                  kind="competition"
                  target={header.competitionSlug ?? header.competition}
                >
                  {header.competition}
                </MatchRelatedLink>
              </li>
              <li aria-hidden>/</li>
            </>
          ) : null}
          <li className="font-medium text-[var(--hero-ink)]" aria-current="page">
            {header.homeTeam} vs {header.awayTeam}
          </li>
        </ol>
      </nav>

      <header className="border-b border-[var(--hero-line)] pb-10">
        {/* The document's one h1 — the heading order below it walks the five levels. */}
        <h1 className="sr-only">
          {header.homeTeam} vs {header.awayTeam}
        </h1>
        {/*
          The eyebrow renders only when there is something to put in it. It previously printed an
          empty line whenever `competition` was blank or the provider's "—" placeholder, which is
          a label with no value — worse than no label at all.
        */}
        {competitionEyebrow ? (
          <p className="rw-label text-[var(--hero-ink-3)]">{competitionEyebrow}</p>
        ) : null}
        <div className="mt-4 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-1 items-center justify-between gap-3 sm:justify-start sm:gap-6">
            <TeamBlock
              name={header.homeTeam}
              logo={header.homeLogo}
              href={model.related.homeTeamHref}
              matchId={header.matchId}
              locale={locale}
              align="left"
            />
            <div className="text-center">
              {/*
                Live state is load-bearing, not decoration. The framing above claims a market
                prices differently in play while the score is still goalless — a page that cannot
                show the minute and the score cannot support that claim.
              */}
              <p
                className="rw-mono rw-tnum text-4xl font-semibold text-[var(--hero-ink)] sm:text-5xl"
                aria-label={`Score ${scoreText(header.score.home, header.score.away)}`}
              >
                {scoreText(header.score.home, header.score.away)}
              </p>
              <p className="rw-label mt-2 text-[var(--hero-ink-3)]">
                <span
                  className={
                    header.isLive
                      ? "rw-live text-[var(--hero-accent)]"
                      : header.lifecycle === "finished"
                        ? "text-[var(--hero-pos)]"
                        : ""
                  }
                >
                  {header.statusLabel}
                </span>
                {header.isLive && header.minute != null ? (
                  <span className="rw-tnum text-[var(--hero-accent)]">
                    {" · "}
                    {header.minute}&apos;
                  </span>
                ) : header.minute != null ? (
                  <span className="rw-tnum">
                    {" · "}
                    {header.minute}&apos;
                  </span>
                ) : null}
              </p>
              {(header.htScore.home != null || header.ftScore.home != null) && (
                <p className="rw-mono rw-tnum mt-1.5 text-[13px] text-[var(--hero-ink-3)]">
                  {header.htScore.home != null
                    ? `HT ${scoreText(header.htScore.home, header.htScore.away)}`
                    : ""}
                  {header.ftScore.home != null
                    ? `${header.htScore.home != null ? " · " : ""}FT ${scoreText(header.ftScore.home, header.ftScore.away)}`
                    : ""}
                </p>
              )}
            </div>
            <TeamBlock
              name={header.awayTeam}
              logo={header.awayLogo}
              href={model.related.awayTeamHref}
              matchId={header.matchId}
              locale={locale}
              align="right"
            />
          </div>
          <div className="text-[14px] text-[var(--hero-ink-2)] lg:max-w-xs lg:text-right">
            <p>
              <LocalTime iso={header.kickoffAt} locale={locale} />
            </p>
            {header.venue ? <p className="mt-1">Venue: {header.venue}</p> : null}
            {header.lastUpdatedAt ? (
              <p className="rw-mono mt-2 text-[12px] text-[var(--hero-ink-3)]">
                Updated <LocalTime iso={header.lastUpdatedAt} locale={locale} /> ·{" "}
                {header.dataFreshness === "live_ok"
                  ? "live refresh enabled"
                  : header.dataFreshness === "unavailable"
                    ? p.fxLiveUnavailable
                    : "snapshot"}
              </p>
            ) : null}
          </div>
        </div>
      </header>

      {/*
        L1 + L2 — THE LEAD FINDING AND ITS SUPPORTS. Omitted whole when nothing clears the bar:
        the reader meets the strongest real signal first, or meets the model directly.
      */}
      <div className="mt-14 lg:mt-20">
        <FixtureSignalLevels report={signalReport} teams={teams} p={p} />
      </div>

      {/*
        L3 — THE MODEL'S VIEW AND WHY. The potential for the page's market, the model's scored
        signals, one honest reconciliation sentence, and the archive's provenance line.
      */}
      <div className="mt-16 border-t border-[var(--hero-line)] pt-14 lg:mt-24">
        <FixtureModelWhy
          view={evidence}
          potential={potential}
          lead={signalReport.lead}
          latest={latestSnapshot}
          teams={teams}
          p={p}
        />
      </div>

      {/*
        L4 — SCANNABLE DETAIL. Everything else, dense on purpose, one column at the full
        measure: the market/venue table, live context, events, statistics, the published
        record, the timeline. A reader here chose to go deep.
      */}
      <div className="mt-16 border-t border-[var(--hero-line)] pt-14 lg:mt-24">
        <h2 className="rw-m text-[var(--hero-ink-2)]">{p.fxDetailTitle}</h2>
        <p className="mt-1.5 max-w-[52ch] text-[13px] leading-relaxed text-[var(--hero-ink-2)]">
          {p.fxDetailDescription}
        </p>
      </div>

      <div className="mt-10">
        <FixtureResearchSection
          view={evidence}
          homeTeam={header.homeTeam}
          awayTeam={header.awayTeam}
          p={p}
        />
      </div>

      <div className="mt-16">
        <div className="space-y-20">
          {/*
            Sprint 22 — Live Match Intelligence. Renders itself only for in-play fixtures and
            returns null otherwise, so no live markup or JavaScript reaches a scheduled or
            finished match page.
          */}
          <LiveMatchSection snapshot={bundle.liveMatch} locale={locale} />



          <section aria-labelledby="events-heading">
            <h3
              id="events-heading"
              className="rw-display text-[22px] text-[var(--hero-ink)] sm:text-[26px]"
            >
              Key match events
            </h3>
            <SectionState
              availability={model.sections.events.availability}
              message={model.sections.events.message}
            >
              <ol className="mt-3 space-y-2">
                {model.sections.events.items.map((event) => (
                  <li
                    key={event.id}
                    className="flex items-start gap-3 border-b border-[var(--hero-line)] py-2 pl-3.5 text-sm text-[var(--hero-ink)]"
                  >
                    <span className="font-mono text-xs text-[var(--hero-ink-2)]">
                      {event.minute != null ? `${event.minute}'` : "—"}
                    </span>
                    <span>
                      <span className="font-medium capitalize">{event.type.replace("_", " ")}</span>
                      {" · "}
                      {event.label}
                      {event.team !== "unknown" ? ` (${event.team})` : ""}
                    </span>
                  </li>
                ))}
              </ol>
            </SectionState>
          </section>

          <section aria-labelledby="stats-heading">
            {/*
              Renamed from "Betting-relevant statistics". The page states that the product does
              not price or recommend, then labelled a section by its usefulness for betting —
              the one framing the rest of the page spends its length refusing.
            */}
            <h3
              id="stats-heading"
              className="rw-display text-[22px] text-[var(--hero-ink)] sm:text-[26px]"
            >
              Match statistics
            </h3>
            <SectionState
              availability={model.sections.statistics.availability}
              message={model.sections.statistics.message}
            >
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="rw-label border-b border-[var(--hero-line)] text-left text-[var(--hero-ink-2)]">
                      <th scope="col" className="py-2 pr-3">{header.homeTeam}</th>
                      <th scope="col" className="py-2 pr-3">Stat</th>
                      <th scope="col" className="py-2">{header.awayTeam}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {model.sections.statistics.items.map((row) => (
                      <tr key={row.key} className="border-b border-[var(--border-subtle)]">
                        <td className="py-2 pr-3 font-mono tabular-nums text-right">
                          {row.home ?? "—"}
                        </td>
                        <td className="py-2 pr-3 text-[var(--ink-secondary)]">{row.label}</td>
                        <td className="py-2 font-mono tabular-nums text-right">{row.away ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionState>
          </section>

          {/*
            The old "Research context" paragraph restated the venue sample counts that now sit
            beside every rate in the research section. One idea, one place (§18.4).
          */}

          {/* §3.11 — published history stays on the page; it just stops pretending to be research. */}
          <FixtureRecordSection predictions={model.predictions} />

          <section aria-labelledby="deferred-heading">
            <h3 id="deferred-heading" className="rw-label text-[var(--hero-ink-3)]">
              Not covered on this page
            </h3>
            <p className="mt-3 max-w-[62ch] text-[13px] leading-relaxed text-[var(--hero-ink-3)]">
              We do not publish research for these markets yet:{" "}
              {model.deferredMarkets.join(", ")}.
            </p>
          </section>

          {/*
            The interactive publication timeline. Kept for §3.12 auditability, placed after the
            record it annotates rather than above the research it is not.
          */}
          <section aria-labelledby="timeline-heading">
            <h3 id="timeline-heading" className="rw-label text-[var(--hero-ink-3)]">
              Publication timeline
            </h3>
            <div className="mt-4">
              <MatchPredictionsPanel
                matchId={header.matchId}
                locale={locale}
                predictions={model.predictions}
                focusMarket={focusMarket}
                homeTeam={header.homeTeam}
                awayTeam={header.awayTeam}
                competition={header.competition}
                competitionSlug={header.competitionSlug}
                country={header.country}
                kickoffAt={header.kickoffAt}
              />
            </div>
          </section>
          {/* Research navigation stays with the research — the commercial block is L5, after
              every content level including the evidence archive (the page assembles it last). */}
          <section aria-labelledby="explore-heading" className="text-sm">
            <h3 id="explore-heading" className="rw-m text-[var(--hero-ink-2)]">
              Explore
            </h3>
            <ul className="mt-2 space-y-1 text-[var(--hero-ink-2)]">
              {model.related.homeTeamHref ? (
                <li>
                  <MatchRelatedLink
                    href={model.related.homeTeamHref}
                    matchId={header.matchId}
                    locale={locale}
                    kind="team"
                    target={header.homeTeam}
                  >
                    {header.homeTeam}
                  </MatchRelatedLink>
                </li>
              ) : null}
              {model.related.awayTeamHref ? (
                <li>
                  <MatchRelatedLink
                    href={model.related.awayTeamHref}
                    matchId={header.matchId}
                    locale={locale}
                    kind="team"
                    target={header.awayTeam}
                  >
                    {header.awayTeam}
                  </MatchRelatedLink>
                </li>
              ) : null}
              {model.related.competitionHref ? (
                <li>
                  <MatchRelatedLink
                    href={model.related.competitionHref}
                    matchId={header.matchId}
                    locale={locale}
                    kind="competition"
                    target={header.competition}
                  >
                    {header.competition}
                  </MatchRelatedLink>
                </li>
              ) : null}
              <li>
                <Link href={`/${locale}#fixtures`} className="border-b border-[var(--border-subtle)] hover:border-current">
                  Today&apos;s qualified fixtures
                </Link>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

function TeamBlock({
  name,
  logo,
  href,
  matchId,
  locale,
  align,
}: {
  name: string;
  logo?: string;
  href: string | null;
  matchId: number;
  locale: string;
  align: "left" | "right";
}) {
  const content = (
    <>
      {logo ? (
        <Image src={logo} alt="" width={48} height={48} className="h-12 w-12 object-contain" />
      ) : (
        <span className="flex h-12 w-12 items-center justify-center border-[0.5px] border-[var(--hero-line)] text-sm font-semibold text-[var(--hero-ink)]">
          {name.slice(0, 1)}
        </span>
      )}
      <span
        className={`max-w-[7rem] text-sm font-semibold sm:max-w-none ${align === "right" ? "text-right" : ""}`}
      >
        {name}
      </span>
    </>
  );
  if (!href) {
    return (
      <div
        className={`flex min-w-0 items-center gap-2 ${align === "right" ? "flex-row-reverse" : ""}`}
      >
        {content}
      </div>
    );
  }
  return (
    <MatchRelatedLink
      href={href}
      matchId={matchId}
      locale={locale}
      kind="team"
      target={name}
      className={`flex min-w-0 items-center gap-2 hover:text-[var(--hero-ink-2)] ${align === "right" ? "flex-row-reverse" : ""}`}
    >
      {content}
    </MatchRelatedLink>
  );
}

function SectionState({
  availability,
  message,
  children,
}: {
  availability: "available" | "unavailable" | "empty";
  message: string | null;
  children: ReactNode;
}) {
  if (availability !== "available") {
    return (
      <p className="mt-3 max-w-[52ch] border-l-2 border-[var(--hero-line)] py-1 pl-5 text-sm text-[var(--hero-ink-2)]">
        {message ?? "Data unavailable."}
      </p>
    );
  }
  return <>{children}</>;
}

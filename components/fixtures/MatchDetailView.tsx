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
import { OfferOfTheDayCard } from "@/components/v3/rails/RightRail";

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
  prices,
  offer,
  offerTerms,
}: {
  locale: Locale;
  bundle: MatchPageBundle;
  source: string | null;
  /** The newest archived evidence snapshot for this fixture, or null — L3's provenance line. */
  latestSnapshot: EvidenceSnapshotView | null;
  p: PredictionStrings;
  /** Observed publication prices for this fixture's markets (Phase C price panel). */
  prices?: import("@/lib/operators/pricePanel.server").PricePanelData;
  /** The aside's curated slot (placement offer_of_the_day_fixture) — null omits the card. */
  offer?: import("@/lib/v3/homeRails.server").OfferOfTheDay | null;
  /** The offer card's terms line (the footer disclaimer, localized). */
  offerTerms?: string;
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
    <div className="rw3-match-grid">
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

      <div className="rw3-match-center px-5 pb-10">
      <nav
        aria-label="Breadcrumb"
        className="pt-3.5 text-[12px]"
        style={{ color: "var(--muted)" }}
      >
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href={model.related.homeHref}>{p.nvHome}</Link>
          </li>
          <li aria-hidden>›</li>
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
              <li aria-hidden>›</li>
            </>
          ) : null}
          <li style={{ color: "var(--text)" }} aria-current="page">
            {header.homeTeam} – {header.awayTeam}
          </li>
        </ol>
      </nav>

      <header className="pb-4 pt-3.5" style={{ borderBottom: "1px solid var(--line)" }}>
        {/* The document's one h1 — the heading order below it walks the five levels. */}
        <h1 className="sr-only">
          {header.homeTeam} vs {header.awayTeam}
        </h1>
        <div
          className="grid items-center gap-5 py-3"
          style={{
            gridTemplateColumns: "minmax(0,1fr) auto minmax(0,1fr)",
            borderTop: "1px solid var(--line)",
            borderBottom: "1px solid var(--line)",
          }}
        >
          <div className="flex items-center justify-end">
            <TeamBlock
              name={header.homeTeam}
              logo={header.homeLogo}
              href={model.related.homeTeamHref}
              matchId={header.matchId}
              locale={locale}
              align="left"
            />
          </div>
          <div className="text-center">
            {/*
              Live state is load-bearing, not decoration. The framing above claims a market
              prices differently in play while the score is still goalless — a page that cannot
              show the minute and the score cannot support that claim.
            */}
            <p
              className="text-[16px] font-semibold"
              aria-label={`Score ${scoreText(header.score.home, header.score.away)}`}
            >
              {scoreText(header.score.home, header.score.away)}
            </p>
            <p className="rw3-label mt-1" style={{ letterSpacing: ".06em" }}>
              <span
                style={
                  header.isLive
                    ? { color: "var(--accent)" }
                    : header.lifecycle === "finished"
                      ? { color: "var(--win)" }
                      : undefined
                }
              >
                {header.statusLabel}
              </span>
              {header.minute != null ? (
                <span style={header.isLive ? { color: "var(--accent)" } : undefined}>
                  {" · "}
                  {header.minute}&apos;
                </span>
              ) : null}
            </p>
            {(header.htScore.home != null || header.ftScore.home != null) && (
              <p className="mt-1 text-[12px]" style={{ color: "var(--muted)" }}>
                {header.htScore.home != null
                  ? `HT ${scoreText(header.htScore.home, header.htScore.away)}`
                  : ""}
                {header.ftScore.home != null
                  ? `${header.htScore.home != null ? " · " : ""}FT ${scoreText(header.ftScore.home, header.ftScore.away)}`
                  : ""}
              </p>
            )}
          </div>
          <div className="flex items-center">
            <TeamBlock
              name={header.awayTeam}
              logo={header.awayLogo}
              href={model.related.awayTeamHref}
              matchId={header.matchId}
              locale={locale}
              align="right"
            />
          </div>
        </div>
        <p className="mt-2.5 text-[11px]" style={{ color: "var(--muted)" }}>
          <LocalTime iso={header.kickoffAt} locale={locale} />
          {header.venue ? <> · {header.venue}</> : null}
          {/* The eyebrow's law survives the v3 header: it joins the meta line
              only when there is a value — never a separator with nothing after it. */}
          {competitionEyebrow ? (
            <> · {competitionEyebrow}</>
          ) : null}
        </p>
        {header.lastUpdatedAt ? (
          <p className="mt-1 text-[11px]" style={{ color: "var(--muted)" }}>
            Updated <LocalTime iso={header.lastUpdatedAt} locale={locale} /> ·{" "}
            {header.dataFreshness === "live_ok"
              ? "live refresh enabled"
              : header.dataFreshness === "unavailable"
                ? p.fxLiveUnavailable
                : "snapshot"}
          </p>
        ) : null}
      </header>

      {/*
        L1 + L2 — THE LEAD FINDING AND ITS SUPPORTS. Omitted whole when nothing clears the bar:
        the reader meets the strongest real signal first, or meets the model directly.
      */}
      <div className="mt-8">
        <FixtureSignalLevels report={signalReport} teams={teams} p={p} prices={prices} locale={locale} />
      </div>

      {/*
        L3 — THE MODEL'S VIEW AND WHY. The potential for the page's market, the model's scored
        signals, one honest reconciliation sentence, and the archive's provenance line.
      */}
      <div className="mt-10 pt-6" style={{ borderTop: "1px solid var(--line)" }}>
        <FixtureModelWhy
          view={evidence}
          potential={potential}
          lead={signalReport.lead}
          latest={latestSnapshot}
          teams={teams}
          p={p}
          kickoffAt={header.kickoffAt}
        />
      </div>

      {/*
        L4 — SCANNABLE DETAIL. Everything else, dense on purpose, one column at the full
        measure: the market/venue table, live context, events, statistics, the published
        record, the timeline. A reader here chose to go deep.
      */}
      <div className="mt-10 pt-6" style={{ borderTop: "1px solid var(--line)" }}>
        <h2 className="rw3-label">{p.fxDetailTitle}</h2>
        <p className="mt-1.5 max-w-[52ch] text-[12px] leading-relaxed" style={{ color: "var(--muted)" }}>
          {p.fxDetailDescription}
        </p>
      </div>

      <div className="mt-6">
        <FixtureResearchSection
          view={evidence}
          homeTeam={header.homeTeam}
          awayTeam={header.awayTeam}
          p={p}
        />
      </div>

      <div className="mt-10">
        <div className="space-y-10">
          {/*
            Sprint 22 — Live Match Intelligence. Renders itself only for in-play fixtures and
            returns null otherwise, so no live markup or JavaScript reaches a scheduled or
            finished match page.
          */}
          <LiveMatchSection snapshot={bundle.liveMatch} locale={locale} />



          <section aria-labelledby="events-heading">
            <h3 id="events-heading" className="rw3-title">
              Key match events
            </h3>
            <SectionState
              availability={model.sections.events.availability}
              message={model.sections.events.message}
            >
              <ol className="mt-3">
                {model.sections.events.items.map((event) => (
                  <li
                    key={event.id}
                    className="flex items-start gap-3 py-2 text-[13px]"
                    style={{ borderBottom: "1px solid var(--line)" }}
                  >
                    <span className="text-[11px]" style={{ color: "var(--muted)" }}>
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
            <h3 id="stats-heading" className="rw3-title">
              Match statistics
            </h3>
            <SectionState
              availability={model.sections.statistics.availability}
              message={model.sections.statistics.message}
            >
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-[13px]">
                  <thead>
                    <tr
                      className="rw3-label text-left"
                      style={{ borderBottom: "1px solid var(--line)" }}
                    >
                      <th scope="col" className="py-2 pr-3">{header.homeTeam}</th>
                      <th scope="col" className="py-2 pr-3">Stat</th>
                      <th scope="col" className="py-2">{header.awayTeam}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {model.sections.statistics.items.map((row) => (
                      <tr key={row.key} style={{ borderBottom: "1px solid var(--line)" }}>
                        <td className="py-2 pr-3 text-right font-semibold">
                          {row.home ?? "—"}
                        </td>
                        <td className="py-2 pr-3" style={{ color: "var(--muted)" }}>
                          {row.label}
                        </td>
                        <td className="py-2 text-right font-semibold">{row.away ?? "—"}</td>
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
            <h3 id="deferred-heading" className="rw3-label">
              Not covered on this page
            </h3>
            <p
              className="mt-3 max-w-[62ch] text-[12px] leading-relaxed"
              style={{ color: "var(--muted)" }}
            >
              We do not publish research for these markets yet:{" "}
              {model.deferredMarkets.join(", ")}.
            </p>
          </section>

          {/*
            The interactive publication timeline. Kept for §3.12 auditability, placed after the
            record it annotates rather than above the research it is not.
          */}
          <section aria-labelledby="timeline-heading">
            <h3 id="timeline-heading" className="rw3-label">
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
          <section aria-labelledby="explore-heading" className="text-[13px]">
            <h3 id="explore-heading" className="rw3-label">
              Explore
            </h3>
            <ul className="mt-2 space-y-1" style={{ color: "var(--muted)" }}>
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
                <Link href={`/${locale}#fixtures`}>
                  Today&apos;s qualified fixtures
                </Link>
              </li>
            </ul>
          </section>
        </div>
      </div>
      </div>

      {/*
        THE ASIDE (block D, rw3-match mock): a compact per-market index of the
        SAME venue rates the research table below carries — an anchor into the
        full table, its rates never rebuilt here — and the one curated
        commercial slot. A fixture with no evidence renders no index rows;
        no offer partner, no card (empty-state law).
      */}
      <aside style={{ padding: "14px 16px", borderLeft: "1px solid var(--line)" }}>
        {evidence.state !== "no_data" && evidence.markets.length > 0 ? (
          <>
            <div className="rw3-label" style={{ paddingBottom: 6 }}>
              {p.v3OtherMarkets}
            </div>
            {evidence.markets.map((market) => (
              <a
                key={market.marketKey}
                href="#research-heading"
                className="rw3-hoverable"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  gap: 10,
                  padding: "8px 0",
                  borderTop: "1px solid var(--line)",
                }}
              >
                <span style={{ fontWeight: 500 }}>{market.marketLabel}</span>
                {market.homeRate ? (
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>
                    {market.homeRate.display}
                  </span>
                ) : null}
              </a>
            ))}
          </>
        ) : null}
        {offer && offerTerms ? (
          <OfferOfTheDayCard
            offer={offer}
            strings={{
              offerOfTheDay: p.v3OfferOfTheDay,
              sponsored: p.v3Sponsored18,
              continue: p.v3Continue,
              terms: offerTerms,
            }}
          />
        ) : null}
      </aside>
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
        <Image
          src={logo}
          alt=""
          width={28}
          height={28}
          className="h-7 w-7 object-contain"
          style={{ borderRadius: "50%" }}
        />
      ) : (
        <span
          className="flex h-7 w-7 items-center justify-center text-[11px] font-semibold"
          style={{
            background: "var(--pctbg)",
            border: "1px solid var(--line)",
            borderRadius: "50%",
          }}
        >
          {name.slice(0, 1)}
        </span>
      )}
      <span
        className={`min-w-0 text-[16px] font-semibold ${align === "right" ? "text-right" : ""}`}
      >
        {name}
      </span>
    </>
  );
  if (!href) {
    return (
      <div
        className={`flex min-w-0 items-center gap-2.5 ${align === "right" ? "" : "flex-row-reverse"}`}
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
      className={`flex min-w-0 items-center gap-2.5 ${align === "right" ? "" : "flex-row-reverse"}`}
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
      <p
        className="mt-3 max-w-[52ch] py-1 pl-4 text-[12px]"
        style={{ borderLeft: "2px solid var(--line)", color: "var(--muted)" }}
      >
        {message ?? "Data unavailable."}
      </p>
    );
  }
  return <>{children}</>;
}

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
import { EvidenceRows } from "./v31/EvidenceRows";
import { LocalTime } from "./LocalTime";
import { MatchDetailTracker } from "./MatchDetailTracker";
import { MatchLiveRefresh } from "./MatchLiveRefresh";
import { MatchPredictionsPanel } from "./MatchPredictionsPanel";
import { MatchRelatedLink } from "./MatchRelatedLink";
import { Icon } from "@/components/v3/Icon";
import { OfferOfTheDayCard } from "@/components/v3/rails/RightRail";
import { FixtureHeaderV31 } from "./v31/FixtureHeaderV31";
import { VerdictBlock } from "./v31/VerdictBlock";
import { H2hSection, ModelViewV31 } from "./v31/HistoryModelView";
import { formPack, h2hAnalysis, signalMarketLabel } from "@/lib/fixtures/v31";
import { PRICE_PANEL_MARKET_BY_SIGNAL } from "@/lib/operators/pricePanel.server";

export function MatchDetailView({
  locale,
  bundle,
  source,
  latestSnapshot,
  p,
  prices,
  offer,
  offerTerms,
  editorNote,
  priceFallback,
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
  /** Block F: the active manual pick's long note — the editor-note block under L1. */
  editorNote?: string | null;
  /** Polish group 4: the sponsored no-price ghost for the lead market. */
  priceFallback?: {
    name: string;
    mark: string;
    logo: string | null;
    continueHref: string;
    sponsoredTitle: string;
  } | null;
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

  /* Fixture v3.1 — layer 1's real-data derivations. */
  const homeForm = formPack(detail?.history?.homeAtHome ?? [], header.homeTeam);
  const awayForm = formPack(detail?.history?.awayAtAway ?? [], header.awayTeam);
  const verdictPlayRows = signalReport.lead
    ? (prices?.[PRICE_PANEL_MARKET_BY_SIGNAL[signalReport.lead.market] ?? ""] ?? [])
    : [];

  /* Fixture v3.1 — layer 3's derivations. The H2H gate (≥3 meetings) lives
     in h2hAnalysis; the model view speaks only through the template
     registry, its win record derived from the SAME venue history the form
     chips show. */
  const h2h = h2hAnalysis(detail?.history?.headToHead ?? [], header.homeTeam);
  const homeFullRecord = formPack(
    detail?.history?.homeAtHome ?? [],
    header.homeTeam,
    Number.MAX_SAFE_INTEGER
  );
  const modelInputs = {
    homeTeam: header.homeTeam,
    awayTeam: header.awayTeam,
    homeVenue: detail?.homeAtHome,
    awayVenue: detail?.awayAtAway,
    leagueAvgGoals: detail?.leagueSeason?.avgGoals,
    homeWinRecord: homeFullRecord.sample
      ? {
          wins: homeFullRecord.chips.filter((chip) => chip.outcome === "won").length,
          n: homeFullRecord.sample,
        }
      : undefined,
  };

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

      {/*
        FIXTURE v3.1 HEADER — crests 32, names, venue · league, last-5 form
        chips from the REAL venue histories. Live state stays load-bearing:
        score/minute take the center the moment they exist. The eyebrow's
        law survives — the competition joins the header only when it has a
        value ({competitionEyebrow ? ( it ) : null} below). No standings.
      */}
      <FixtureHeaderV31
        homeTeam={header.homeTeam}
        awayTeam={header.awayTeam}
        homeLogo={header.homeLogo}
        awayLogo={header.awayLogo}
        competition={competitionEyebrow ? (
          competitionEyebrow
        ) : null}
        kickoffAt={header.kickoffAt}
        venue={header.venue}
        homeForm={homeForm}
        awayForm={awayForm}
        locale={locale}
        p={p}
        score={header.score}
        statusLabel={header.statusLabel}
        minute={header.minute}
        isLive={header.isLive}
        finished={header.lifecycle === "finished"}
      />
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

      {/*
        LAYER 1 — THE VERDICT (fixture v3.1). The lead finding as the page's
        one display number, sample strength, ±pp chip, provenance, the lead
        sentence, the editor's note, and Play This Market. No lead → no
        verdict (empty-state law); the supports below then open the page.
      */}
      {signalReport.lead ? (
        <VerdictBlock
          lead={signalReport.lead}
          teams={teams}
          p={p}
          latest={latestSnapshot}
          editorNote={editorNote}
          playRows={verdictPlayRows}
          playFallback={
            priceFallback
              ? {
                  name: priceFallback.name,
                  logo: priceFallback.logo,
                  continueHref: priceFallback.continueHref,
                }
              : null
          }
          marketLabel={signalMarketLabel(signalReport.lead, p)}
        />
      ) : null}

      {/*
        LAYER 2 — THE EVIDENCE (fixture v3.1). The SUPPORTS only: the lead
        already spoke in the verdict, and no sentence appears at two levels.
        Rows beyond three fold inline; the post-L2 bridge closes the layer.
      */}
      <EvidenceRows
        supports={signalReport.supports}
        teams={teams}
        p={p}
        history={detail?.history ?? undefined}
      />

      {/*
        THE EDITOR NOTE without a verdict to live under (block F's law): an
        active pick's note still renders, clearly labelled, when no lead
        signal cleared the bar.
      */}
      {!signalReport.lead && editorNote?.trim() ? (
        <div
          className="mt-4 max-w-[760px]"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 3,
            padding: "10px 12px",
            background: "var(--surface)",
            borderRadius: 6,
          }}
        >
          <span className="rw3-label" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Icon name="editor" size={20} strokePx={1.75} />
            {p.v3EditorNote}
          </span>
          <span className="text-[13px]" style={{ lineHeight: 1.45 }}>
            {editorNote}
          </span>
        </div>
      ) : null}

      {/*
        LAYER 3 — HISTORY AND THE MODEL'S VIEW (fixture v3.1). H2H only at
        ≥3 meetings; the model view only through the template registry, 2–4
        sentences, closing on the lock line and the record's door. Either
        section missing its data is omitted whole (empty-state law).
      */}
      {h2h ? (
        <H2hSection h2h={h2h} homeTeam={header.homeTeam} awayTeam={header.awayTeam} p={p} />
      ) : null}
      <ModelViewV31
        inputs={modelInputs}
        marketLabel={signalReport.lead ? signalMarketLabel(signalReport.lead, p) : null}
        locale={locale}
        p={p}
      />

      {/*
        THE RETAINED TRUTH SURFACES — the model's why, the potential for the
        page's market, the archive's provenance line: untouched in law.
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

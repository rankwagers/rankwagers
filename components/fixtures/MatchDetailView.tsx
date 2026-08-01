import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { JsonLd } from "@/components/JsonLd";
import { LiveMatchSection } from "@/components/live/LiveMatchSection";
import type { Locale } from "@/lib/i18n";
import type { OperatorCountryAvailability, Operator } from "@/lib/operators/types";
import { OperatorEvidenceCardList } from "@/components/operators/OperatorEvidenceCard";
import { buildOperatorEvidenceCards, recommendableCards } from "@/lib/operators/evidenceCard";
import type { MatchPageBundle } from "@/lib/fixtures/loadMatchPage.server";
import { matchBreadcrumbLd, matchSportsEventLd } from "@/lib/fixtures/schema";
import { MatchDetailTracker } from "./MatchDetailTracker";
import { MatchLiveRefresh } from "./MatchLiveRefresh";
import { MatchPredictionsPanel } from "./MatchPredictionsPanel";
import { MatchRelatedLink } from "./MatchRelatedLink";

function formatKickoff(iso: string | null, locale: string): string {
  if (!iso) return "Kickoff unavailable";
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function scoreText(home: number | null, away: number | null): string {
  if (home == null || away == null) return "–";
  return `${home}–${away}`;
}

export function MatchDetailView({
  locale,
  bundle,
  source,
  operators,
  visitorCountry,
}: {
  locale: Locale;
  bundle: MatchPageBundle;
  source: string | null;
  operators: ReadonlyArray<{ operator: Operator; availability: OperatorCountryAvailability }>;
  visitorCountry: string;
}) {
  const { model, signedOffers, focusMarket, detail } = bundle;
  const { header } = model;
  const description = `${header.homeTeam} vs ${header.awayTeam} — evidence, live context, and transparent prediction settlement on RankWagers.`;
  const sportsEvent = matchSportsEventLd({ locale, header, description });

  return (
    <div className="container-wide pb-16">
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

      <nav aria-label="Breadcrumb" className="mb-6 text-xs text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1">
          <li>
            <Link href={model.related.homeHref} className="hover:text-brand">
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
          <li className="font-medium text-foreground" aria-current="page">
            {header.homeTeam} vs {header.awayTeam}
          </li>
        </ol>
      </nav>

      <header className="border-b border-[var(--border-subtle)] pb-8">
        <p className="text-metadata font-medium uppercase tracking-label text-brand">
          {header.competition}
          {header.country && header.country !== "—" ? ` · ${header.country}` : ""}
        </p>
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
              <p
                className="font-mono text-3xl font-semibold tabular-nums text-foreground sm:text-4xl"
                aria-label={`Score ${scoreText(header.score.home, header.score.away)}`}
              >
                {scoreText(header.score.home, header.score.away)}
              </p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-label text-muted-foreground">
                <span
                  className={
                    header.isLive
                      ? "text-[var(--red-primary)]"
                      : header.lifecycle === "finished"
                        ? "text-brand"
                        : ""
                  }
                >
                  {header.statusLabel}
                </span>
                {header.minute != null ? ` · ${header.minute}'` : ""}
              </p>
              {(header.htScore.home != null || header.ftScore.home != null) && (
                <p className="mt-1 font-mono text-metadata text-muted-foreground">
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
          <div className="text-sm text-[var(--ink-secondary)] lg:max-w-xs lg:text-right">
            <p>{formatKickoff(header.kickoffAt, locale)}</p>
            {header.venue ? <p className="mt-1">Venue: {header.venue}</p> : null}
            {header.lastUpdatedAt ? (
              <p className="mt-2 font-mono text-metadata text-muted-foreground">
                Updated {new Date(header.lastUpdatedAt).toLocaleString()} ·{" "}
                {header.dataFreshness === "live_ok"
                  ? "live refresh enabled"
                  : header.dataFreshness === "unavailable"
                    ? "status limited"
                    : "snapshot"}
              </p>
            ) : null}
          </div>
        </div>
      </header>

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-10">
          {/*
            Sprint 22 — Live Match Intelligence. Renders itself only for in-play fixtures and
            returns null otherwise, so no live markup or JavaScript reaches a scheduled or
            finished match page.
          */}
          <LiveMatchSection snapshot={bundle.liveMatch} locale={locale} />

          <section aria-labelledby="predictions-heading">
            <h2
              id="predictions-heading"
              className="font-display text-xl font-semibold text-foreground"
            >
              Predictions & settlement
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-[var(--ink-secondary)]">
              Publication snapshots are separate from post-match events. Settlement is
              computed server-side from final (or period) scores.
            </p>
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

          <section aria-labelledby="events-heading">
            <h2 id="events-heading" className="font-display text-xl font-semibold">
              Key match events
            </h2>
            <SectionState
              availability={model.sections.events.availability}
              message={model.sections.events.message}
            >
              <ol className="mt-3 space-y-2">
                {model.sections.events.items.map((event) => (
                  <li
                    key={event.id}
                    className="flex items-start gap-3 rounded-md border border-border px-3 py-2 text-sm"
                  >
                    <span className="font-mono text-xs text-muted-foreground">
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
            <h2 id="stats-heading" className="font-display text-xl font-semibold">
              Betting-relevant statistics
            </h2>
            <SectionState
              availability={model.sections.statistics.availability}
              message={model.sections.statistics.message}
            >
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-metadata uppercase tracking-label text-muted-foreground">
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

          {detail ? (
            <section aria-labelledby="context-heading">
              <h2 id="context-heading" className="font-display text-xl font-semibold">
                Research context
              </h2>
              <p className="mt-2 text-sm text-[var(--ink-secondary)]">
                Venue splits: home side {detail.homeAtHome.played} home matches · away side{" "}
                {detail.awayAtAway.played} away matches
                {detail.prematchXg
                  ? ` · Prematch xG ${detail.prematchXg.total.toFixed(2)}`
                  : ""}
                .
              </p>
            </section>
          ) : null}

          <section aria-labelledby="deferred-heading">
            <h2 id="deferred-heading" className="text-sm font-semibold text-foreground">
              Deferred markets
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Not published on this page until durable selection snapshots exist or provider
              contracts are safe: {model.deferredMarkets.join("; ")}.
            </p>
          </section>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <section
            aria-labelledby="offers-heading"
            className="rounded-lg border border-border bg-[var(--canvas-secondary)] p-4"
          >
            <h2 id="offers-heading" className="text-sm font-semibold text-foreground">
              Operator options
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Editorial research above is separate from commercial offers. Links use
              server-signed redirects.
            </p>
            {signedOffers.length ? (
              <ul className="mt-3 space-y-2">
                {signedOffers.slice(0, 4).map((offer) => (
                  <li key={offer.slug}>
                    <a
                      href={offer.outboundPath}
                      rel="noopener sponsored"
                      className="flex items-center justify-between gap-2 rounded-md border border-transparent px-2 py-2 text-sm hover:border-brand/30 hover:bg-card"
                    >
                      <span className="font-medium">{offer.displayName}</span>
                      <span className="text-xs text-brand">Continue</span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">
                No verified operator offers are available for this market context.
              </p>
            )}
          </section>

          <section className="text-sm">
            <h2 className="text-sm font-semibold">Explore</h2>
            <ul className="mt-2 space-y-1 text-[var(--ink-secondary)]">
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
                <Link href={`/${locale}#fixtures`} className="hover:text-brand">
                  Today&apos;s qualified fixtures
                </Link>
              </li>
            </ul>
          </section>
        </aside>

        <OperatorEvidenceCardList
          cards={recommendableCards(
            buildOperatorEvidenceCards(
              operators.map(({ operator, availability }) => ({
                operator,
                availability,
                marketKey: null,
              })),
              { nowIso: new Date().toISOString(), limit: 3 },
            ),
          )}
          locale={locale}
          country={visitorCountry}
          surface="fixture"
          headingId="operator-recommendations"
          heading="Recommended operators"
          fixtureId={header.matchId}
          market={focusMarket ?? null}
        />
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
        <span className="flex h-12 w-12 items-center justify-center rounded-md bg-background text-sm font-semibold">
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
      className={`flex min-w-0 items-center gap-2 hover:text-brand ${align === "right" ? "flex-row-reverse" : ""}`}
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
      <p className="mt-3 rounded-lg border border-border bg-[var(--canvas-secondary)] px-4 py-5 text-sm text-muted-foreground">
        {message ?? "Data unavailable."}
      </p>
    );
  }
  return <>{children}</>;
}

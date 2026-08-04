"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
 Activity,
 AlertTriangle,
 Bookmark,
 BookmarkCheck,
 CircleDot,
 ChevronDown,
 ChevronUp,
 ExternalLink,
 Filter,
 Info,
 MapPin,
 ShieldCheck,
 Target,
} from "lucide-react";
import type { FullDictionary } from "@/lib/dictionaries";
import type { DailyMatchLists } from "@/lib/footystats/types";
import type { MatchDetailPublic } from "@/lib/footystats/matchDetail";
import {
 mapDailyListsToQualifiedFixtures,
 type QualifiedFixture,
} from "@/lib/research/qualifiedFixture";
import { AddToAccaButton } from "@/components/acca/AddToAccaButton";
import { V2LeagueCell } from "@/components/homepage/v2Chrome";
import { TeamLogo } from "@/components/predictions/TeamLogo";
import { mapFootyStatsEvidence, type FootyStatsFixtureResearch } from "@/lib/research/footyStatsEvidence";
import { fromFixtureResearch } from "@/lib/evidence-ui";
import { EvidenceCard } from "@/components/evidence-ui/EvidenceCard";
import { EvidenceSection } from "@/components/evidence-ui/EvidenceSection";
import { EvidenceSummaryChip } from "@/components/evidence-ui/EvidenceSummaryChip";
import { QualificationPanel } from "@/components/evidence-ui/QualificationPanel";
import type { ResolvedOperatorOffer } from "@/lib/affiliate/operators";
import { trackAnalyticsEvent } from "@/lib/analytics/client";
import {
 trackHomepageFilter,
 trackPartnerCardImpression,
} from "@/lib/analytics/homepage";
import { normalizeHomepageSearch } from "@/lib/search/homeFixtureSearch";
import {
 HOMEPAGE_MARKET_FILTERS,
 isHomepageMarketFilter,
} from "@/lib/search/homeSearchRoutes";
import {
 loadSavedFixtures,
 toggleSavedFixture,
 type SavedFixtureRecord,
} from "@/lib/research/savedFixtures";
import { clampPage, pageItems, totalPagesFor } from "@/lib/pagination";
import {
 IMPRESSION_INTERSECTION_THRESHOLD,
 rememberImpression,
} from "@/lib/analytics/impressions";
import { trackFixtureTimeSpent } from "@/lib/analytics/engagement";
import { fixturePath } from "@/lib/fixtures/paths";
import dynamic from "next/dynamic";

const OddsIntelligencePanel = dynamic(
 () =>
 import("@/components/odds/OddsIntelligencePanel").then(
 (mod) => mod.OddsIntelligencePanel
 ),
 {
 loading: () => (
 <div
 className="mb-6 h-40 animate-pulse border border-[var(--border-subtle)] bg-[var(--canvas-secondary)]"
 aria-hidden
 />
 ),
 ssr: false,
 }
);

const FILTER_GROUPS = {
 market: HOMEPAGE_MARKET_FILTERS,
} as const;

const trackedOperatorImpressions = new Set<string>();
const trackedFixtureImpressions = new Set<string>();
const FIXTURE_PAGE_SIZE = 12;

/**
 * The desk's column track, stated once so the head cannot drift from its rows.
 *
 * Stacked below `sm` — a seven-column table at 360px is a table nobody can read.
 */
const DESK_COLUMNS =
  "sm:grid sm:grid-cols-[44px_minmax(0,1.5fr)_minmax(0,1.1fr)_minmax(0,0.7fr)_78px_92px_32px] sm:gap-x-3.5";

/** Row labels for the two filter axes, and the head for the figure the desk ranks by. */
const FILTER_LABEL_LEAGUE = "League";
const FILTER_LABEL_MARKET = "Market";
const DESK_POTENTIAL_LABEL = "Potential";

function FilterButton({
 active,
 label,
 onClick,
}: {
 active: boolean;
 label: string;
 onClick: () => void;
}) {
 return (
 <button
 type="button"
 aria-pressed={active}
 onClick={onClick}
 /*
  * `relative` is not cosmetic — it is what stops the homepage scrolling sideways.
  *
  * The active button contains an `sr-only` span, and Tailwind's `sr-only` is
  * `position: absolute`. With no positioned ancestor, that span's containing block was the
  * initial containing block (the document), not this button — so it was laid out at its static
  * position deep inside the horizontally-scrolled filter toolbar, escaped the toolbar's
  * `overflow-x: auto` clip, and contributed that position to the ROOT scrollable overflow.
  * Measured: documentElement.scrollWidth 8070px against a 1280px viewport, and the homepage
  * really did scroll ~1744px to the right at both 1280x800 and 390x844. body.scrollWidth stayed
  * at the viewport width throughout, which is why an ordinary overflow probe missed it.
  *
  * Making the button a containing block keeps the span inside the toolbar, where the toolbar's
  * own clip applies.
  */
 /*
  * The map's mono filter chip: bordered, uppercase, inverting when selected. Green fills are
  * gone with the rest of them — selection is stated by ground and ink, not by hue.
  *
  * `relative` is not cosmetic — it is what stops the homepage scrolling sideways. The active
  * button contains an `sr-only` span, and Tailwind's `sr-only` is `position: absolute`. With no
  * positioned ancestor that span was laid out against the document, escaped the toolbar's
  * `overflow-x` clip, and contributed ~1744px to the ROOT scrollable overflow. Making the button
  * a containing block keeps it inside the toolbar, where the clip applies.
  */
 className={`rw-m relative min-h-9 shrink-0 snap-start border px-2.5 py-1.5 tracking-[0.1em] transition-colors duration-[var(--dur-respond)] ease-[var(--ease-settle)] disabled:cursor-not-allowed disabled:opacity-[var(--opacity-disabled)] ${
 active
 ? "border-[var(--hero-ink)] bg-[var(--hero-ink)] text-[var(--hero-canvas)]"
 : "border-[var(--hero-line)] bg-transparent text-[var(--hero-ink-2)] hover:border-[var(--hero-ink)] hover:text-[var(--hero-ink)]"
 }`}
 >
 {active ? (
 <>
 {label}
 <span className="sr-only"> (active)</span>
 </>
 ) : (
 label
 )}
 </button>
 );
}

function ComparisonRow({
 label,
 home,
 away,
 format = "percentage",
}: {
 label: string;
 home: number;
 away: number;
 format?: "percentage" | "decimal";
}) {
 const scale = format === "percentage" ? 100 : Math.max(home, away, 1) * 1.15;
 const formatValue = (value: number) => format === "percentage" ? `${Math.round(value)}%` : value.toFixed(2);
 const difference = Math.abs(home - away);
 const comparison =
 difference < (format === "percentage" ? 3 : 0.1)
 ? "The two venue profiles are closely aligned."
 : `${home > away ? "Home side" : "Away side"} is higher by ${format === "percentage" ? `${Math.round(difference)} percentage points ` : difference.toFixed(2)}.`;
 return (
 <div className="border-b border-[var(--border-subtle)] py-2.5 last:border-0">
 <div className="grid grid-cols-[3.25rem_minmax(0,1fr)_3.25rem] items-center gap-2">
 <span className="text-right font-mono text-xs font-semibold tabular-nums text-[var(--hero-ink)]">{formatValue(home)}</span>
 <div className="flex min-w-0 items-center gap-2">
 <div className="flex h-1 min-w-0 flex-1 justify-end overflow-hidden bg-[var(--border-subtle)]">
 <span className="h-full bg-[var(--hero-ink)]" style={{ width: `${Math.min(100, (home / scale) * 100)}%` }} />
 </div>
 <span className="w-24 shrink-0 text-center text-metadata leading-tight text-[var(--ink-secondary)]">{label}</span>
 <div className="flex h-1 min-w-0 flex-1 overflow-hidden bg-[var(--border-subtle)]">
 <span className="h-full bg-[var(--comparison-away)]" style={{ width: `${Math.min(100, (away / scale) * 100)}%` }} />
 </div>
 </div>
 <span className="font-mono text-xs font-semibold tabular-nums text-[var(--comparison-away)]">{formatValue(away)}</span>
 </div>
 <p className="mt-0.5 text-center text-metadata text-muted-foreground/80">{comparison}</p>
 </div>
 );
}

function resultTone(scored: number, conceded: number) {
 return scored > conceded ? "bg-[rgb(32_30_29_/_0.05)] text-[var(--hero-ink)]" : scored === conceded ? "bg-[var(--amber-surface)] text-[var(--amber-primary)]" : "bg-[var(--red-surface)] text-[var(--red-primary)]";
}

function resultCode(scored: number, conceded: number) {
 return scored > conceded ? "W" : scored === conceded ? "D" : "L";
}

function FixtureHistory({
 fixture,
 history,
}: {
 fixture: QualifiedFixture;
 history: MatchDetailPublic["history"];
}) {
 const historyDate = (kickoffAt: string) =>
 new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(kickoffAt));
 const h2hSummary = history.headToHead.reduce(
 (summary, match) => {
 const fixtureHomePlayedAtHome = match.home.name === fixture.home;
 const fixtureHomePlayedAway = match.away.name === fixture.home;
 if (!fixtureHomePlayedAtHome && !fixtureHomePlayedAway) return summary;

 const homeScore = fixtureHomePlayedAtHome ? match.home.score : match.away.score;
 const awayScore = fixtureHomePlayedAtHome ? match.away.score : match.home.score;
 if (homeScore > awayScore) summary.homeWins += 1;
 else if (homeScore < awayScore) summary.awayWins += 1;
 else summary.draws += 1;
 summary.matches += 1;
 return summary;
 },
 { homeWins: 0, draws: 0, awayWins: 0, matches: 0 }
 );

 if (!history.homeAtHome.length && !history.awayAtAway.length && !history.headToHead.length) return null;

 return (
 <section className="mb-8" aria-labelledby={`history-${fixture.id}`}>
 <h2 id={`history-${fixture.id}`} className="mb-2 text-metadata font-medium uppercase tracking-label text-muted-foreground">Recent history</h2>
 {(history.homeAtHome.length > 0 || history.awayAtAway.length > 0) && (
 <div className="grid gap-3 md:grid-cols-2">
 <div className="bg-[var(--canvas-primary)]">
 <div className="flex items-center justify-between gap-3 px-1 py-2">
 <p className="text-xs font-medium text-foreground">{fixture.home} · home</p>
 <div className="flex items-center gap-1" aria-label={`${fixture.home} recent home form`}>
 {history.homeAtHome.map((match) => <span key={match.id} className={`inline-flex h-4 w-4 items-center justify-center text-metadata font-semibold ${resultTone(match.home.score, match.away.score)}`} title={resultCode(match.home.score, match.away.score)}>{resultCode(match.home.score, match.away.score)}</span>)}
 </div>
 </div>
 <div className="space-y-1">
 {history.homeAtHome.map((match) => (
 <div key={match.id} className="grid grid-cols-[1.25rem_minmax(0,1fr)_2.75rem_4.5rem] items-center gap-2 px-2 py-1.5 transition-colors duration-150 ease-out hover:bg-background">
 <span className={`inline-flex h-6 min-w-7 items-center justify-center px-1 text-metadata font-semibold ${resultTone(match.home.score, match.away.score)}`}>{resultCode(match.home.score, match.away.score)}</span>
 <div className="flex min-w-0 items-center gap-1.5"><TeamLogo src={match.away.logo} name={match.away.name} size="xs" /><span className="truncate text-xs text-[var(--ink-secondary)]">{match.away.name}</span></div>
 <span className="justify-self-end font-mono text-base font-semibold leading-none tabular-nums text-foreground">{match.home.score}–{match.away.score}</span>
 <time dateTime={match.kickoffAt} className="justify-self-end whitespace-nowrap text-metadata tabular-nums text-muted-foreground">{historyDate(match.kickoffAt)}</time>
 </div>
 ))}
 </div>
 </div>
 <div className="bg-[var(--canvas-primary)]">
 <div className="flex items-center justify-between gap-3 px-1 py-2">
 <p className="text-xs font-medium text-foreground">{fixture.away} · away</p>
 <div className="flex items-center gap-1" aria-label={`${fixture.away} recent away form`}>
 {history.awayAtAway.map((match) => <span key={match.id} className={`inline-flex h-4 w-4 items-center justify-center text-metadata font-semibold ${resultTone(match.away.score, match.home.score)}`} title={resultCode(match.away.score, match.home.score)}>{resultCode(match.away.score, match.home.score)}</span>)}
 </div>
 </div>
 <div className="space-y-1">
 {history.awayAtAway.map((match) => (
 <div key={match.id} className="grid grid-cols-[1.25rem_minmax(0,1fr)_2.75rem_4.5rem] items-center gap-2 px-2 py-1.5 transition-colors duration-150 ease-out hover:bg-background">
 <span className={`inline-flex h-6 min-w-7 items-center justify-center px-1 text-metadata font-semibold ${resultTone(match.away.score, match.home.score)}`}>{resultCode(match.away.score, match.home.score)}</span>
 <div className="flex min-w-0 items-center gap-1.5"><TeamLogo src={match.home.logo} name={match.home.name} size="xs" /><span className="truncate text-xs text-[var(--ink-secondary)]">{match.home.name}</span></div>
 <span className="justify-self-end font-mono text-base font-semibold leading-none tabular-nums text-foreground">{match.home.score}–{match.away.score}</span>
 <time dateTime={match.kickoffAt} className="justify-self-end whitespace-nowrap text-metadata tabular-nums text-muted-foreground">{historyDate(match.kickoffAt)}</time>
 </div>
 ))}
 </div>
 </div>
 </div>
 )}
 {history.headToHead.length > 0 && (
 <div className="mt-4 bg-[var(--canvas-primary)]">
 <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-1 py-2">
 <p className="text-metadata font-medium uppercase tracking-label text-muted-foreground">Head-to-head · last {history.headToHead.length} meetings</p>
 {h2hSummary.matches > 0 && <p className="text-metadata font-medium tabular-nums text-[var(--ink-secondary)]">{fixture.home} wins {h2hSummary.homeWins} <span className="mx-1.5 text-muted-foreground">·</span> Draws {h2hSummary.draws} <span className="mx-1.5 text-muted-foreground">·</span> {fixture.away} wins {h2hSummary.awayWins}</p>}
 </div>
 <div className="relative space-y-1 before:absolute before:bottom-4 before:left-1/2 before:top-7 before:w-px before:-translate-x-1/2 before:bg-[var(--border-subtle)]">
 {history.headToHead.map((match) => (
 <div key={match.id} className="relative grid grid-cols-[minmax(0,1fr)_4.5rem_minmax(0,1fr)] items-center gap-2 px-2 py-2 transition-colors duration-150 ease-out hover:bg-background">
 <div className="flex min-w-0 items-center justify-end gap-1.5 text-right"><span className="truncate text-xs text-[var(--ink-secondary)]">{match.home.name}</span><TeamLogo src={match.home.logo} name={match.home.name} size="xs" /></div>
 <div className="z-10 flex flex-col items-center gap-1"><time dateTime={match.kickoffAt} className="whitespace-nowrap text-metadata tabular-nums text-muted-foreground">{historyDate(match.kickoffAt)}</time><span className="bg-background px-2 py-1 font-mono text-base font-semibold leading-none tabular-nums text-foreground ">{match.home.score}–{match.away.score}</span></div>
 <div className="flex min-w-0 items-center gap-1.5"><TeamLogo src={match.away.logo} name={match.away.name} size="xs" /><span className="truncate text-xs text-[var(--ink-secondary)]">{match.away.name}</span></div>
 </div>
 ))}
 </div>
 </div>
 )}
 </section>
 );
}

function FixtureDetail({
 fixture,
 research,
 detail,
 qualifiedMarkets,
 saved,
 onSave,
 locale,
 detailLoading,
 detailError,
 onRetryDetail,
}: {
 fixture: QualifiedFixture;
 research: FootyStatsFixtureResearch;
 detail?: MatchDetailPublic;
 qualifiedMarkets: QualifiedFixture[];
 saved: boolean;
 onSave: () => void;
 locale: string;
 detailLoading: boolean;
 detailError: string | null;
 onRetryDetail: () => void;
}) {
 const [methodologyOpen, setMethodologyOpen] = useState(false);
 const [partnersOpen, setPartnersOpen] = useState(false);
 const partnerCardRefs = useRef(new Map<string, HTMLDivElement>());
 const detailId = `fixture-detail-${fixture.id}`;
 type SnapshotItem = { label: string; value: string; baseline?: string; delta?: string };
 const withLeagueContext = (
 label: string,
 value: number,
 baseline: number | undefined,
 kind: "goals" | "percentage"
 ): SnapshotItem => {
 const display = kind === "goals" ? value.toFixed(2) : `${Math.round(value)}%`;
 if (baseline === undefined) return { label, value: display };
 const difference = kind === "goals" ? value - baseline : value - baseline;
 const delta = kind === "goals"
 ? `${difference >= 0 ? "+" : ""}${difference.toFixed(2)}`
 : `${difference >= 0 ? "+" : ""}${Math.round(difference)} pp`;
 return {
 label,
 value: display,
 baseline: `League avg ${kind === "goals" ? baseline.toFixed(2) : `${Math.round(baseline)}%`}`,
 delta,
 };
 };
 const snapshot = detail
 ? [
 detail.matchPotential.avgGoals ? withLeagueContext("Goals", detail.matchPotential.avgGoals, detail.leagueSeason?.avgGoals, "goals") : null,
 detail.prematchXg ? withLeagueContext("xG", detail.prematchXg.total, detail.leagueSeason?.avgTotalXg, "goals") : null,
 withLeagueContext("Over 1.5", detail.matchPotential.over15, detail.leagueSeason?.over15, "percentage"),
 detail.matchPotential.btts ? withLeagueContext("BTTS", detail.matchPotential.btts, detail.leagueSeason?.btts, "percentage") : null,
 detail.homeAtHome.cleanSheets.played && detail.awayAtAway.cleanSheets.played
 ? { label: "Clean sheet", value: `${Math.round((detail.homeAtHome.cleanSheets.pct + detail.awayAtAway.cleanSheets.pct) / 2)}%` }
 : null,
 { label: "Venue", value: "Home / away" },
 ].filter((item): item is SnapshotItem => item !== null)
 : [];
 const qualificationReasons = research.summary
 .filter((item) => !/sample reliability|sample coverage/i.test(item))
 .slice(0, 2);
 if (detail?.prematchXg && qualificationReasons.length < 3) {
 qualificationReasons.push(`Combined expected-goals projection is ${detail.prematchXg.total.toFixed(2)} xG.`);
 }
 const evidenceCoverage = research.marketMetrics.length
 ? Math.round((research.marketMetrics.filter((metric) => metric.sampleQuality === "adequate").length / research.marketMetrics.length) * 100)
 : 0;
 const evidenceBundle = fromFixtureResearch(research, `fixture:${fixture.id}`);
 const qualificationDrivers = [
 { label: "Model probability", value: `${fixture.modelProbability}%`, detail: "Qualified market" },
 research.qualification
 ? { label: "Threshold exceeded", value: `${research.qualification.difference >= 0 ? "+" : ""}${Math.round(research.qualification.difference)} pp`, detail: `${research.qualification.threshold}% threshold` }
 : null,
 detail?.prematchXg
 ? { label: "Combined xG", value: detail.prematchXg.total.toFixed(2), detail: "Match projection" }
 : null,
 research.marketMetrics.length
 ? { label: "Evidence coverage", value: `${evidenceCoverage}%`, detail: `${research.marketMetrics.filter((metric) => metric.sampleQuality === "adequate").length} of ${research.marketMetrics.length} adequate samples` }
 : null,
 ].filter((driver): driver is { label: string; value: string; detail: string } => driver !== null);
 const rankedMarkets = [...qualifiedMarkets].sort((a, b) => b.modelProbability - a.modelProbability);
 const selectedMarketOdds = detail?.odds?.markets.find((market) => market.key === fixture.marketKind);
 // Signed CTAs come from /api/match-detail (server-only signing). Never call buildGoPath here.
 const partnerOffers = (detail?.signedPartnerOffersByMarket?.[fixture.marketKind] ??
 []) as ResolvedOperatorOffer[];
 const visiblePartnerOffers = partnersOpen ? partnerOffers : partnerOffers.slice(0, 4);
 const visibleOfferKey = visiblePartnerOffers.map((offer) => offer.slug).join("|");

 useEffect(() => {
 if (!("IntersectionObserver" in window)) return;

 const offersBySlug = new Map(visiblePartnerOffers.map((offer) => [offer.slug, offer]));
 const observer = new IntersectionObserver((entries) => {
 for (const entry of entries) {
 if (!entry.isIntersecting || entry.intersectionRatio < 0.6) continue;
 const slug = (entry.target as HTMLDivElement).dataset.operatorSlug;
 const offer = slug ? offersBySlug.get(slug) : undefined;
 if (!offer) continue;

 const impressionKey = `${fixture.matchId}:${fixture.marketKind}:${offer.slug}`;
 if (!rememberImpression(trackedOperatorImpressions, impressionKey)) {
 observer.unobserve(entry.target);
 continue;
 }

 observer.unobserve(entry.target);
 trackPartnerCardImpression({
 fixtureId: fixture.matchId,
 fixtureLabel: `${fixture.home} vs ${fixture.away}`,
 league: fixture.league,
 market: fixture.marketKind,
 operatorSlug: offer.slug,
 availability: offer.availability,
 oddsVerified: offer.oddsVerified,
 locale,
 });
 }
 }, { threshold: IMPRESSION_INTERSECTION_THRESHOLD }); // Partner cards count after 60% visibility.

 for (const card of partnerCardRefs.current.values()) observer.observe(card);
 return () => observer.disconnect();
 }, [fixture.away, fixture.home, fixture.league, fixture.matchId, fixture.marketKind, locale, visibleOfferKey, visiblePartnerOffers]);

 return (
 <div id={detailId} className="fixture-detail-enter border-t border-[var(--border-subtle)] px-5 py-5 lg:px-8 lg:py-6">
 {detailLoading && !detail ? (
 <p className="mb-4 border border-border bg-background px-3 py-2 text-sm text-muted-foreground" role="status">
 Loading match evidence…
 </p>
 ) : null}
 {detailError ? (
 <div
 className="mb-4 border border-[var(--amber-border)] bg-[var(--amber-surface)] px-3 py-3 text-sm text-[var(--amber-primary)]"
 role="alert"
 >
 <p>{detailError}</p>
 <button
 type="button"
 onClick={onRetryDetail}
 className="mt-2 border border-[var(--amber-border)] bg-card px-3 py-1.5 text-xs font-semibold text-[var(--amber-primary)] hover:bg-white"
 >
 Retry
 </button>
 </div>
 ) : null}
 <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start">
 <div className="flex-1">
 <p className="mb-2 text-metadata font-medium uppercase tracking-label text-muted-foreground/80">
 {fixture.league} · <time dateTime={fixture.kickoffDateTime}>{fixture.kickoff}</time> · {fixture.venue}
 </p>
 <div className="mb-4 flex items-center gap-4">
 <div className="flex flex-col items-center gap-1.5">
 <TeamLogo src={fixture.homeImage} name={fixture.home} size="lg" />
 <span className="text-sm font-medium text-[var(--ink-secondary)]">{fixture.home}</span>
 </div>
 {/* --border-strong is a 1.68:1 border token; as visible text it failed AA. It reads as a quiet
     connector either way, and --muted-foreground is the quietest token that clears 4.5:1. */}
 <span className="font-mono text-sm text-muted-foreground">vs</span>
 <div className="flex flex-col items-center gap-1.5">
 <TeamLogo src={fixture.awayImage} name={fixture.away} size="lg" />
 <span className="text-sm font-medium text-[var(--ink-secondary)]">{fixture.away}</span>
 </div>
 </div>
 <div className="flex flex-wrap items-center gap-2">
 <span className="rounded border border-border bg-background px-3 py-1 text-sm text-[var(--ink-secondary)]">
 Qualified market: <strong className="text-foreground">{fixture.market}</strong>
 </span>
 <time dateTime={fixture.updatedDateTime} className="font-mono text-metadata text-muted-foreground">
 {fixture.updatedAt}
 </time>
 <Link
 href={fixturePath(locale, fixture.matchId, fixture.marketKind, "explorer")}
 className="inline-flex items-center gap-1.5 border border-[var(--hero-line)] bg-[rgb(32_30_29_/_0.05)] px-3 py-1 text-sm font-semibold text-[var(--hero-ink)] hover:bg-[rgb(32_30_29_/_0.05)]/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
 >
 Open match page
 <ExternalLink className="h-3.5 w-3.5" aria-hidden />
 </Link>
 <AddToAccaButton
 compact
 draft={{
 matchId: fixture.matchId,
 homeTeam: fixture.home,
 awayTeam: fixture.away,
 competition: fixture.league,
 kickoffAt: fixture.kickoffDateTime,
 marketKey: fixture.marketKind,
 confidence: fixture.modelProbability,
 odds: selectedMarketOdds?.bookmakers.length
 ? Math.max(
 ...selectedMarketOdds.bookmakers.map((b) => b.decimal)
 )
 : null,
 evidenceSummary: [
 `Qualified ${fixture.market} · model ${fixture.modelProbability}%`,
 ],
 publishedAt: fixture.updatedDateTime,
 matchHref: fixturePath(
 locale,
 fixture.matchId,
 fixture.marketKind,
 "explorer"
 ),
 source: "explorer",
 }}
 />
 </div>
 {snapshot.length > 0 && (
 <div className="mt-5">
 {qualificationDrivers.length > 0 && (
 <div className="mb-5 bg-[rgb(32_30_29_/_0.05)] px-4 py-4 ">
 <div className="flex items-baseline justify-between gap-3">
 <p className="text-metadata font-semibold uppercase tracking-label text-[var(--hero-ink)]">Qualification drivers</p>
 <span className="text-metadata text-[var(--hero-ink)]">verified pre-match inputs</span>
 </div>
 <div className="mt-3 grid gap-2 sm:grid-cols-2">
 {qualificationDrivers.map((driver) => (
 <div key={driver.label} className="bg-card px-3 py-2.5">
 <p className="text-metadata uppercase tracking-label text-[var(--hero-ink)]/75">{driver.label}</p>
 <p className="mt-1 font-mono text-xl font-semibold leading-none tabular-nums text-[var(--hero-ink)]">{driver.value}</p>
 <p className="mt-1 text-metadata text-[var(--hero-ink)]/75">{driver.detail}</p>
 </div>
 ))}
 </div>
 {qualificationReasons.length > 0 && <p className="mt-3 text-xs leading-snug text-[var(--hero-ink)]">{qualificationReasons[0]}</p>}
 </div>
 )}
 <p className="mb-2 text-metadata font-medium uppercase tracking-label text-muted-foreground">Match snapshot</p>
 <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
 {snapshot.map((item) => (
 <div key={item.label} className={`min-w-0 px-3 py-3 transition-transform duration-200 ease-out hover:-translate-y-0.5 ${
 item.label === "xG" ? "bg-[rgb(32_30_29_/_0.05)] sm:col-span-2 sm:px-4" : "bg-[rgb(32_30_29_/_0.05)]"
 }`}>
 <p className="flex items-center gap-2 text-metadata text-muted-foreground">
 {item.label === "Goals" ? <CircleDot className="h-4 w-4 text-[var(--hero-ink)]/75" aria-hidden /> :
 item.label === "xG" ? <Activity className="h-4 w-4 text-[var(--hero-ink)]/75" aria-hidden /> :
 item.label === "Venue" ? <MapPin className="h-4 w-4 text-[var(--hero-ink)]/75" aria-hidden /> :
 item.label === "Clean sheet" ? <ShieldCheck className="h-4 w-4 text-[var(--hero-ink)]/75" aria-hidden /> :
 <Target className="h-4 w-4 text-[var(--hero-ink)]/75" aria-hidden />}
 {item.label}
 </p>
 <p className={`mt-1 truncate font-mono font-semibold leading-none tabular-nums text-foreground ${item.label === "xG" ? "text-xl" : "text-lg"}`}>{item.value}</p>
 {item.baseline && <p className="mt-2 text-metadata text-muted-foreground">{item.baseline}</p>}
 {item.delta && <p className="mt-0.5 font-mono text-metadata font-semibold tabular-nums text-[var(--hero-ink)]">{item.delta}</p>}
 </div>
 ))}
 </div>
 </div>
 )}
 </div>

 <aside className="w-full shrink-0 border border-[var(--border-subtle)] bg-background p-4 lg:w-72" aria-label="Qualification metrics">
 <div className="flex items-center justify-between gap-3">
 <p className="text-metadata font-medium uppercase tracking-label text-muted-foreground">Model probability</p>
 <span className="bg-[rgb(32_30_29_/_0.05)] px-2 py-0.5 text-metadata font-semibold text-[var(--hero-ink)]">Qualified</span>
 </div>
 <div className="mt-2 flex items-end gap-2">
 <span className="font-mono text-h1 font-semibold leading-none tabular-nums text-[var(--hero-ink)]">
 {fixture.modelProbability}%
 </span>
 <span className="mb-1 text-xs text-[var(--ink-secondary)]">probability</span>
 </div>
 <div className="mt-3 h-1.5 overflow-hidden bg-[var(--border-subtle)]" aria-label={`Model probability ${fixture.modelProbability}%`}>
 <span className="metric-progress block h-full bg-[var(--hero-ink)]" style={{ width: `${fixture.modelProbability}%` }} />
 </div>
 {research.qualification && (
 <dl className="mt-4 text-xs text-[var(--ink-secondary)]">
 <div className="grid grid-cols-2 gap-2">
 <div className="bg-[var(--canvas-primary)] px-3 py-2"><dt className="text-metadata uppercase tracking-label text-muted-foreground">Threshold</dt><dd className="mt-1 font-mono font-semibold text-foreground">{research.qualification.threshold}%</dd></div>
 <div className="bg-[var(--canvas-primary)] px-3 py-2"><dt className="text-metadata uppercase tracking-label text-muted-foreground">Difference</dt><dd className="mt-1 font-mono font-semibold text-[var(--hero-ink)]">{research.qualification.difference >= 0 ? "+" : ""}{Math.round(research.qualification.difference)} pp</dd></div>
 </div>
 {research.qualification.strongestFactor && <div className="mt-2 bg-[rgb(32_30_29_/_0.05)] px-3 py-2.5"><dt className="text-metadata font-medium uppercase tracking-label text-[var(--hero-ink)]">Strongest supporting signal</dt><dd className="mt-1 font-medium text-[var(--hero-ink)]">{research.qualification.strongestFactor}</dd></div>}
 <div className="mt-2 flex items-center justify-between gap-3 px-1"><dt className="text-muted-foreground">Evidence strength</dt><dd className="font-medium text-foreground"><EvidenceSummaryChip strength={evidenceBundle.summaryStrength} /></dd></div>
 {research.marketMetrics.length > 0 && <div className="mt-2 px-1"><div className="h-1 overflow-hidden bg-[var(--border-subtle)]"><span className="metric-progress block h-full bg-[var(--hero-ink)]" style={{ width: `${evidenceCoverage}%` }} /></div><p className="mt-1 text-metadata text-muted-foreground">{evidenceCoverage}% of displayed evidence has an adequate sample</p></div>}
 {research.qualification.weakestFactor && <div className="mt-1.5 px-1 text-metadata text-muted-foreground">Smallest sample: {research.qualification.weakestFactor}</div>}
 </dl>
 )}
 <div className="mt-4 border-t border-[var(--border-subtle)] pt-3">
 <time dateTime={fixture.updatedDateTime} className="font-mono text-metadata text-muted-foreground">
 {fixture.updatedAt}
 </time>
 </div>
 </aside>
 </div>

 <section className="mb-6" aria-labelledby={`evidence-${fixture.id}`}>
 <div className="flex flex-wrap items-center justify-between gap-2">
 <h2 id={`evidence-${fixture.id}`} className="text-metadata font-medium uppercase tracking-label text-muted-foreground">
 Supporting evidence
 </h2>
 <EvidenceSummaryChip
 strength={evidenceBundle.summaryStrength}
 sampleSize={evidenceBundle.metrics[0]?.sample.sampleSize}
 />
 </div>
 {evidenceBundle.metrics.length ? (
 <div className="mt-3 grid gap-2 md:grid-cols-2">
 {evidenceBundle.metrics.map((metric) => (
 <EvidenceCard key={metric.id} metric={metric} />
 ))}
 </div>
 ) : (
 <div className="mt-3 border border-border bg-[var(--canvas-primary)] p-4 text-sm text-[var(--ink-secondary)]">
 No market-specific team split is available for this fixture.
 </div>
 )}
 {evidenceBundle.qualification ? (
 <div className="mt-4">
 <QualificationPanel
 qualification={evidenceBundle.qualification}
 entity={`fixture:${fixture.id}`}
 locale={locale}
 />
 </div>
 ) : null}
 <div className="mt-4">
 <EvidenceSection bundle={evidenceBundle} locale={locale} defaultOpen={false} />
 </div>
 </section>

 {detail && (
 <section className="mb-6" aria-labelledby={`profile-${fixture.id}`}>
 <div className="flex items-end justify-between gap-4">
 <h2 id={`profile-${fixture.id}`} className="text-metadata font-medium uppercase tracking-label text-muted-foreground">
 Team comparison
 </h2>
 <p className="text-metadata text-muted-foreground">
 {detail.homeAtHome.played} home matches · {detail.awayAtAway.played} away matches
 </p>
 </div>
 <div className="mt-3 bg-[var(--canvas-primary)] px-4 py-2">
 <div className="grid grid-cols-[1fr_auto_1fr] items-center pb-2 text-xs font-medium text-foreground">
 <span>{fixture.home}</span><span className="text-muted-foreground">vs</span><span className="text-right">{fixture.away}</span>
 </div>
 <details open className="group border-t border-[var(--border-subtle)]">
 <summary className="flex cursor-pointer list-none items-center justify-between py-2 text-metadata font-medium uppercase tracking-label text-muted-foreground [&::-webkit-details-marker]:hidden">Attack <ChevronDown className="h-3.5 w-3.5 transition-transform duration-200 group-open:rotate-180" aria-hidden /></summary>
 <div className="pb-1">
 <ComparisonRow label="Over 1.5" home={detail.homeAtHome.over15.pct} away={detail.awayAtAway.over15.pct} />
 <ComparisonRow label="Over 2.5" home={detail.homeAtHome.over25.pct} away={detail.awayAtAway.over25.pct} />
 <ComparisonRow label="Goals scored" home={detail.homeAtHome.scoredAvg} away={detail.awayAtAway.scoredAvg} format="decimal" />
 {detail.homeAtHome.xgFor !== undefined && detail.awayAtAway.xgFor !== undefined && <ComparisonRow label="Expected goals" home={detail.homeAtHome.xgFor} away={detail.awayAtAway.xgFor} format="decimal" />}
 </div>
 </details>
 <details className="group border-t border-[var(--border-subtle)]">
 <summary className="flex cursor-pointer list-none items-center justify-between py-2 text-metadata font-medium uppercase tracking-label text-muted-foreground [&::-webkit-details-marker]:hidden">Goals <ChevronDown className="h-3.5 w-3.5 transition-transform duration-200 group-open:rotate-180" aria-hidden /></summary>
 <div className="pb-1">
 <ComparisonRow label="Both teams scored" home={detail.homeAtHome.btts.pct} away={detail.awayAtAway.btts.pct} />
 <ComparisonRow label="First-half goal" home={detail.homeAtHome.fh05.pct} away={detail.awayAtAway.fh05.pct} />
 <ComparisonRow label="Second-half goal" home={detail.homeAtHome.sh05.pct} away={detail.awayAtAway.sh05.pct} />
 </div>
 </details>
 <details className="group border-y border-[var(--border-subtle)]">
 <summary className="flex cursor-pointer list-none items-center justify-between py-2 text-metadata font-medium uppercase tracking-label text-muted-foreground [&::-webkit-details-marker]:hidden">Defence <ChevronDown className="h-3.5 w-3.5 transition-transform duration-200 group-open:rotate-180" aria-hidden /></summary>
 <div className="pb-1">
 <ComparisonRow label="Goals conceded" home={detail.homeAtHome.concededAvg} away={detail.awayAtAway.concededAvg} format="decimal" />
 <ComparisonRow label="Clean sheet" home={detail.homeAtHome.cleanSheets.pct} away={detail.awayAtAway.cleanSheets.pct} />
 {detail.homeAtHome.xgAgainst !== undefined && detail.awayAtAway.xgAgainst !== undefined && <ComparisonRow label="Expected goals conceded" home={detail.homeAtHome.xgAgainst} away={detail.awayAtAway.xgAgainst} format="decimal" />}
 </div>
 </details>
 </div>
 </section>
 )}

 {rankedMarkets.length > 1 && (
 <section className="mb-8 bg-[rgb(32_30_29_/_0.05)] px-4 py-4" aria-labelledby={`markets-${fixture.id}`}>
 <div className="flex items-baseline justify-between gap-4">
 <h2 id={`markets-${fixture.id}`} className="text-metadata font-semibold uppercase tracking-label text-[var(--hero-ink)]">Qualified markets</h2>
 <span className="text-metadata text-[var(--hero-ink)]">same fixture</span>
 </div>
 <div className="mt-3 grid gap-2 sm:grid-cols-2">
 {rankedMarkets.map((market, index) => (
 <div key={market.id} className={`flex items-center justify-between gap-3 px-3 py-2.5 ${index === 0 ? "bg-[var(--hero-ink)] text-white" : "bg-card text-[var(--hero-ink)]"}`}>
 <div>
 <p className="text-sm font-semibold">{market.market}</p>
 <p className={`mt-0.5 text-metadata ${index === 0 ? "text-background/80" : "text-[var(--hero-ink)]/70"}`}>{index === 0 ? "Highest model probability" : "Also qualified"}</p>
 </div>
 <strong className="font-mono text-lg tabular-nums">{market.modelProbability}%</strong>
 </div>
 ))}
 </div>
 </section>
 )}

 {selectedMarketOdds && (
 <section className="mb-8 border border-[var(--border-subtle)] bg-[rgb(32_30_29_/_0.05)] px-4 py-4" aria-labelledby={`odds-${fixture.id}`}>
 <div className="flex items-baseline justify-between gap-4">
 <div>
 <h2 id={`odds-${fixture.id}`} className="text-metadata font-semibold uppercase tracking-label text-foreground">Market odds snapshot</h2>
 <p className="mt-1 text-xs text-muted-foreground">{selectedMarketOdds.label}</p>
 </div>
 <time dateTime={detail?.odds?.fetchedAt} className="font-mono text-metadata text-muted-foreground">{selectedMarketOdds.bookmakers.length === 1 ? "Single verified operator" : "Multiple verified operators"}</time>
 </div>
 <div className="mt-3 grid gap-2 sm:grid-cols-2">
 {selectedMarketOdds.bookmakers.map((bookmaker, index) => (
 <div key={bookmaker.id} className="flex items-center justify-between gap-3 bg-background px-3 py-2.5">
 <span className="min-w-0 truncate text-sm font-medium text-foreground">{bookmaker.name}{index === 0 && <span className="ml-2 bg-[var(--hero-ink)] px-2 py-0.5 text-metadata font-semibold text-background">Best price</span>}</span>
 <div className="flex shrink-0 items-center gap-3">
 <strong className="font-mono text-base font-semibold tabular-nums text-[var(--hero-ink)]">{bookmaker.decimal.toFixed(2)}</strong>
 </div>
 </div>
 ))}
 </div>
 </section>
 )}

 <OddsIntelligencePanel
 fixtureId={fixture.matchId}
 market={fixture.marketKind}
 marketLabel={selectedMarketOdds?.label ?? fixture.market}
 locale={locale}
 />

 {partnerOffers.length > 0 && (
 <section className="mb-8 bg-[rgb(32_30_29_/_0.05)] px-4 py-4" aria-labelledby={`partners-${fixture.id}`}>
 <div className="flex items-baseline justify-between gap-4">
 <div>
 <h2 id={`partners-${fixture.id}`} className="flex items-center gap-1.5 text-metadata font-semibold uppercase tracking-label text-[var(--hero-ink)]"><ShieldCheck className="h-3.5 w-3.5" aria-hidden />Recommended operators</h2>
 <p className="mt-1 max-w-xl text-xs leading-relaxed text-[var(--hero-ink)]/75">Continue with one of our verified sportsbook partners. Market prices above may also be available on non-partner sportsbooks.</p>
 </div>
 </div>
 <div className="mt-3 grid gap-2 sm:grid-cols-2">
 {(() => {
 const assignedReasons = new Set<string>();
 return visiblePartnerOffers.map((offer, index) => {
 const marketVolumeHighlight = offer.highlights.find((highlight) => /\d+\+.*market|market.*daily/i.test(highlight));
 const standardizedCapabilities = [
 offer.crypto ? "Crypto" : null,
 offer.highlights.some((highlight) => /live betting/i.test(highlight)) ? "Live Betting" : null,
 offer.highlights.some((highlight) => /mobile/i.test(highlight)) ? "Mobile App" : null,
 offer.highlights.some((highlight) => /cash out/i.test(highlight)) ? "Cash Out" : null,
 marketVolumeHighlight ? `${marketVolumeHighlight}` : null,
 ].filter((capability): capability is string => Boolean(capability)).slice(0, 3);
 const quickCompare = [
 offer.oddsVerified ? "Market confirmed" : "Live market",
 ...standardizedCapabilities,
 `Rated ${offer.rating.toFixed(1)}/5`,
 ];
 const reasons = index === 0 ? quickCompare : standardizedCapabilities;
 const cta = offer.oddsVerified ? "View Live Odds" : "Visit Sportsbook";
 const reasonCandidates = [
 offer.oddsVerified ? "Verified market odds supplied" : null,
 offer.linkType === "fixture-deeplink" || offer.linkType === "market-deeplink" ? "Direct access to this market" : null,
 detail?.visitorCountry ? "Available in your region" : null,
 offer.highlights.some((highlight) => /live betting/i.test(highlight)) ? "Live betting supported" : null,
 offer.highlights.some((highlight) => /mobile/i.test(highlight)) ? "Mobile app available" : null,
 offer.crypto ? "Crypto payments supported" : null,
 "Partner access available",
 ].filter((reason): reason is string => Boolean(reason));
 const whyChoose = reasonCandidates.find((reason) => !assignedReasons.has(reason)) ?? reasonCandidates[0];
 assignedReasons.add(whyChoose);
 return (
 <div key={offer.partnerId} ref={(node) => { if (node) partnerCardRefs.current.set(offer.slug, node); else partnerCardRefs.current.delete(offer.slug); }} data-operator-slug={offer.slug} className={`group flex min-w-0 items-center justify-between gap-3 border border-transparent px-3 py-2.5 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-[var(--hero-line)] hover:${index === 0 ? "bg-[var(--hero-ink)] text-background " : "bg-card text-[var(--hero-ink)]"}`}>
 <div className="flex min-w-0 items-center gap-3">
 {offer.logo ? <span className="flex h-14 w-16 shrink-0 items-center justify-center border border-border bg-white p-1 "><Image src={offer.logo} alt={`${offer.displayName} logo`} width={64} height={48} className="h-full w-full object-contain" /></span> : <span className={`flex h-14 w-16 shrink-0 items-center justify-center text-sm font-semibold ${index === 0 ? "bg-[var(--hero-ink)] text-background" : "bg-[rgb(32_30_29_/_0.05)] text-[var(--hero-ink)]"}`}>{offer.displayName.slice(0, 1)}</span>}
 <div className="min-w-0">
 <div className="flex items-center gap-1.5">
 <p className={`truncate text-sm font-semibold ${index === 0 ? "text-background" : "text-[var(--hero-ink)]"}`}>{offer.displayName}</p>
 {index === 0 && <span title="Selected using market verification, regional eligibility and configured partner priority." className="inline-flex cursor-help bg-[var(--hero-ink)] px-1.5 py-0.5 text-metadata font-medium uppercase tracking-label text-background">Top pick</span>}
 </div>
 {offer.oddsVerified ? (
 <div className={`mt-0.5 flex items-baseline gap-1.5 ${index === 0 ? "text-background/85" : "text-[var(--hero-ink)]/75"}`}>
 <span className="text-metadata">Verified odds</span><strong className="font-mono text-sm tabular-nums">{offer.odds?.toFixed(2)}</strong>
 </div>
 ) : <p className={`mt-0.5 text-metadata ${index === 0 ? "text-background/80" : "text-[var(--hero-ink)]/75"}`}>Live markets available</p>}
 <p className={`mt-0.5 text-metadata ${index === 0 ? "text-background/75" : "text-[var(--hero-ink)]/60"}`}>Why choose: {whyChoose}</p>
 <div className="mt-1.5 flex flex-wrap gap-1">
 {(index === 0 ? quickCompare : reasons).map((reason) => <span key={reason} className={`px-1.5 py-0.5 text-metadata ${index === 0 ? "bg-[var(--hero-ink)] text-background" : "bg-[rgb(32_30_29_/_0.05)] text-[var(--hero-ink)]"}`}>{reason}</span>)}
 </div>
 </div>
 </div>
 <div className="shrink-0 text-right">
 <a href={offer.outboundPath} className={`inline-flex items-center gap-1 text-xs font-medium hover:underline ${index === 0 ? "text-background" : "text-[var(--hero-ink)]"}`}>{cta}<span className="transition-transform duration-200 ease-out group-hover:translate-x-0.5">→</span></a>
 </div>
 </div>
 );
 });
 })()}
 </div>
 {detail?.visitorCountry && <p className="mt-3 flex items-center gap-1 text-metadata text-[var(--hero-ink)]/65"><MapPin className="h-3 w-3" aria-hidden />Available in your region</p>}
 {partnerOffers.length > 4 && <button type="button" onClick={() => { setPartnersOpen((open) => !open); trackAnalyticsEvent({ event_name: "partner_list_expand", fixture_id: fixture.matchId, market: fixture.marketKind, operator_slug: null, locale: "en", user_id: null }); }} className="mt-3 inline-flex border border-[var(--hero-line)] bg-card px-3 py-1.5 text-xs font-medium text-[var(--hero-ink)] transition-colors hover:bg-card">{partnersOpen ? "Show fewer operators" : "View all partners →"}</button>}
 </section>
 )}

 {detail && <FixtureHistory fixture={fixture} history={detail.history} />}

 {research.limitations.length > 0 && <section className="mb-8" aria-labelledby={`limitations-${fixture.id}`}>
 <h2 id={`limitations-${fixture.id}`} className="flex items-center gap-2 text-metadata font-medium uppercase tracking-label text-[var(--amber-primary)]">
 <AlertTriangle className="h-3.5 w-3.5" aria-hidden />Model limitations
 </h2>
 <ul className="mt-3 space-y-2 border border-[var(--amber-border)] bg-[var(--amber-surface)] p-4 text-sm leading-relaxed text-[var(--ink-secondary)]">
 {research.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}
 </ul>
 </section>}

 {research.counterEvidence.length > 0 && <section className="mb-8" aria-labelledby={`counter-${fixture.id}`}>
 <h2 id={`counter-${fixture.id}`} className="flex items-center gap-2 text-metadata font-medium uppercase tracking-label text-[var(--amber-primary)]">
 <AlertTriangle className="h-3.5 w-3.5" aria-hidden />Counter-evidence
 </h2>
 <div className="mt-3 divide-y divide-[var(--amber-border)] border border-[var(--amber-border)] bg-[var(--amber-surface)]">
 {research.counterEvidence.map((metric) => (
 <div key={metric.id} className="grid gap-2 px-4 py-3 sm:grid-cols-[1fr_auto]">
 <div>
 <p className="text-sm font-medium text-[var(--amber-primary)]">{metric.label}</p>
 <p className="mt-1 text-sm text-[var(--amber-primary)]">{metric.interpretation}</p>
 <p className="mt-1 text-xs text-[var(--amber-primary)]">{metric.sampleLabel}</p>
 </div>
 <strong className="font-mono text-xl text-[var(--amber-primary)]">{metric.displayValue}</strong>
 </div>
 ))}
 </div>
 </section>}

 <section className="mb-8">
 <button
 type="button"
 onClick={() => setMethodologyOpen((open) => !open)}
 aria-expanded={methodologyOpen}
 aria-controls={`methodology-${fixture.id}`}
 className="flex items-center gap-2 text-metadata font-medium uppercase tracking-label text-[var(--ink-secondary)] hover:text-foreground"
 >
 <Info className="h-3.5 w-3.5" aria-hidden />Methodology
 {methodologyOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
 </button>
 {methodologyOpen && (
 <div id={`methodology-${fixture.id}`} className="mt-3 border border-[var(--border-subtle)] bg-background p-4 text-sm leading-relaxed text-[var(--ink-secondary)]">
 This screen shows provider-supplied market probabilities. It does not infer an
 evidence agreement score, counter-evidence count, sample size, or operator edge
 where those inputs are unavailable.
 </div>
 )}
 </section>

 <div className="mt-6 flex items-center justify-between border-t border-[var(--border-subtle)] pt-4">
 <button type="button" onClick={onSave} aria-pressed={saved} className="flex items-center gap-1.5 text-sm text-[var(--ink-secondary)] hover:text-foreground">
 {saved ? <BookmarkCheck className="h-4 w-4 text-[var(--hero-ink)]" aria-hidden /> : <Bookmark className="h-4 w-4" aria-hidden />}
 {saved ? "Saved to research notes" : "Save to research notes"}
 </button>
 <a href={`/${locale}/methodology`} className="flex items-center gap-1.5 text-sm text-[var(--hero-ink)] hover:underline">
 Methodology <ExternalLink className="h-3.5 w-3.5" aria-hidden />
 </a>
 </div>
 </div>
 );
}

export function BibleFixtureExplorer({
 lists,
 dict,
}: {
 lists: DailyMatchLists;
 dict: FullDictionary;
}) {
 const params = useParams();
 const locale = typeof params?.locale === "string" ? params.locale : "en";
 const [expandedId, setExpandedId] = useState<string | null>(null);
 const [savedIds, setSavedIds] = useState<Set<string>>(() => new Set());
 const [league, setLeague] = useState("All");
 const [market, setMarket] = useState("All");
 const [searchQuery, setSearchQuery] = useState("");
 const [searchFixtureId, setSearchFixtureId] = useState<number | null>(null);
 const [page, setPage] = useState(1);
 const fixtures = useMemo(() => mapDailyListsToQualifiedFixtures(lists), [lists]);
 const [matchDetails, setMatchDetails] = useState<Record<string, MatchDetailPublic>>({});
 const [loadingDetail, setLoadingDetail] = useState<number | null>(null);
 const [detailErrors, setDetailErrors] = useState<Record<string, string>>({});
 const fixtureCardRefs = useRef(new Map<string, HTMLElement>());
 const fixtureListHeadingRef = useRef<HTMLDivElement>(null);
 const fixtureOpenedAt = useRef<{ fixtureId: number; fixtureLabel: string; market: string; league: string; openedAt: number } | null>(null);
 const localeRef = useRef(locale);
 const deepOpenApplied = useRef(false);
 localeRef.current = locale;
 const leagues = useMemo(() => ["All", ...new Set(fixtures.map((fixture) => fixture.league))], [fixtures]);
 const visible = fixtures.filter((fixture) =>
 (league === "All" || fixture.league === league) &&
 (market === "All" || fixture.marketCode === market) &&
 (searchFixtureId ? fixture.matchId === searchFixtureId : true) &&
 (!searchQuery || searchFixtureId || [fixture.home, fixture.away, fixture.league]
 .some((value) => normalizeHomepageSearch(value).includes(searchQuery)))
 );
 const totalPages = totalPagesFor(visible.length, FIXTURE_PAGE_SIZE);
 const currentPage = clampPage(page, totalPages);
 const pagedFixtures = pageItems(visible, currentPage, FIXTURE_PAGE_SIZE);

 useEffect(() => {
 setSavedIds(new Set(loadSavedFixtures().map((item) => item.id)));
 }, []);

 useEffect(() => {
 const handleSearch = (event: Event) => {
 const detail = (event as CustomEvent<{ query?: string; fixtureId?: number; market?: string }>).detail;
 setSearchQuery(normalizeHomepageSearch(detail?.query ?? ""));
 const fixtureId = typeof detail?.fixtureId === "number" ? detail.fixtureId : null;
 setSearchFixtureId(fixtureId);
 if (detail?.market && isHomepageMarketFilter(detail.market)) {
 setMarket(detail.market);
 }
 setPage(1);
 if (fixtureId != null) {
 const match =
 fixtures.find(
 (fixture) =>
 fixture.matchId === fixtureId &&
 (!detail?.market ||
 detail.market === "All" ||
 fixture.marketCode === detail.market)
 ) ?? fixtures.find((fixture) => fixture.matchId === fixtureId);
 if (match) void openFixture(match);
 }
 requestAnimationFrame(() =>
 fixtureListHeadingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
 );
 };
 window.addEventListener("rankwagers:home-search", handleSearch);
 return () => window.removeEventListener("rankwagers:home-search", handleSearch);
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [fixtures]);

 useEffect(() => {
 const observer = new IntersectionObserver((entries) => {
 for (const entry of entries) {
 if (!entry.isIntersecting || entry.intersectionRatio < IMPRESSION_INTERSECTION_THRESHOLD) continue;
 const fixtureId = (entry.target as HTMLElement).dataset.fixtureId;
 const fixture = pagedFixtures.find((candidate) => candidate.id === fixtureId);
 if (!fixture || !rememberImpression(trackedFixtureImpressions, fixture.id)) continue;
 observer.unobserve(entry.target);
 trackAnalyticsEvent({
 event_name: "fixture_impression",
 fixture_id: fixture.matchId,
 market: fixture.marketKind,
 operator_slug: null,
 locale,
 user_id: null,
 properties: {
 league: fixture.league,
 fixture_label: `${fixture.home} vs ${fixture.away}`,
 intersection_threshold: IMPRESSION_INTERSECTION_THRESHOLD,
 },
 });
 }
 }, { threshold: IMPRESSION_INTERSECTION_THRESHOLD }); // Count after 60% of a fixture card is visible.
 for (const card of fixtureCardRefs.current.values()) observer.observe(card);
 return () => observer.disconnect();
 }, [locale, pagedFixtures]);

 function changePage(nextPage: number) {
 const targetPage = Math.max(1, Math.min(nextPage, totalPages));
 if (targetPage === currentPage) return;
 const paginationProperties = {
 previous_page: currentPage,
 next_page: targetPage,
 total_pages: totalPages,
 result_count: visible.length,
 active_market: market,
 active_league: league,
 };
 trackAnalyticsEvent({
 event_name: "pagination_clicked",
 fixture_id: null,
 market: market === "All" ? null : market,
 operator_slug: null,
 locale,
 user_id: null,
 properties: paginationProperties,
 });
 setPage(targetPage);
 requestAnimationFrame(() => fixtureListHeadingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
 trackAnalyticsEvent({
 event_name: "pagination_page_viewed",
 fixture_id: null,
 market: market === "All" ? null : market,
 operator_slug: null,
 locale,
 user_id: null,
 properties: paginationProperties,
 });
 }

 function flushFixtureTime() {
 const openState = fixtureOpenedAt.current;
 if (!openState) return;
 trackFixtureTimeSpent({
 fixtureId: openState.fixtureId,
 fixtureLabel: openState.fixtureLabel,
 market: openState.market,
 league: openState.league,
 seconds: (Date.now() - openState.openedAt) / 1000,
 locale: localeRef.current,
 });
 fixtureOpenedAt.current = null;
 }

 async function loadMatchDetail(fixture: QualifiedFixture) {
 if (matchDetails[String(fixture.matchId)]) return;
 setLoadingDetail(fixture.matchId);
 setDetailErrors((current) => {
 const next = { ...current };
 delete next[String(fixture.matchId)];
 return next;
 });
 try {
 const context = new URLSearchParams({
 matchId: String(fixture.matchId),
 locale,
 competition: fixture.league,
 ...(fixture.country ? { country: fixture.country } : {}),
 });
 const response = await fetch(`/api/match-detail?${context.toString()}`);
 if (!response.ok) {
 setDetailErrors((current) => ({
 ...current,
 [String(fixture.matchId)]:
 "We could not load match evidence right now. You can retry without leaving this page.",
 }));
 return;
 }
 const detail = (await response.json()) as MatchDetailPublic;
 setMatchDetails((current) => ({ ...current, [fixture.matchId]: detail }));
 } catch {
 setDetailErrors((current) => ({
 ...current,
 [String(fixture.matchId)]:
 "Match evidence is temporarily unavailable. Check your connection and retry.",
 }));
 } finally {
 setLoadingDetail(null);
 }
 }

 async function openFixture(fixture: QualifiedFixture) {
 flushFixtureTime();
 setExpandedId(fixture.id);
 fixtureOpenedAt.current = {
 fixtureId: fixture.matchId,
 fixtureLabel: `${fixture.home} vs ${fixture.away}`,
 market: fixture.marketKind,
 league: fixture.league,
 openedAt: Date.now(),
 };
 trackAnalyticsEvent({
 event_name: "fixture_view",
 fixture_id: fixture.matchId,
 market: fixture.marketKind,
 operator_slug: null,
 locale,
 user_id: null,
 properties: { league: fixture.league, fixture_label: `${fixture.home} vs ${fixture.away}` },
 });
 trackAnalyticsEvent({
 event_name: "fixture_expand",
 fixture_id: fixture.matchId,
 market: fixture.marketKind,
 operator_slug: null,
 locale,
 user_id: null,
 properties: { league: fixture.league, fixture_label: `${fixture.home} vs ${fixture.away}` },
 });
 await loadMatchDetail(fixture);
 }

 async function toggleFixture(fixture: QualifiedFixture, open: boolean) {
 if (open) {
 flushFixtureTime();
 setExpandedId(null);
 return;
 }
 await openFixture(fixture);
 }

 useEffect(() => {
 if (deepOpenApplied.current || !fixtures.length) return;
 const params = new URLSearchParams(window.location.search);
 const fixtureRaw = params.get("fixture");
 const marketRaw = params.get("market");
 const fixtureId = fixtureRaw ? Number(fixtureRaw) : NaN;
 const hasFixture = Number.isFinite(fixtureId);
 const hasMarket = Boolean(marketRaw && isHomepageMarketFilter(marketRaw));

 if (!hasFixture && !hasMarket) return;
 deepOpenApplied.current = true;

 const preferredMarket =
 hasMarket && marketRaw && isHomepageMarketFilter(marketRaw) ? marketRaw : null;

 if (hasFixture) {
 const match =
 fixtures.find(
 (fixture) =>
 fixture.matchId === fixtureId &&
 (!preferredMarket ||
 preferredMarket === "All" ||
 fixture.marketCode === preferredMarket)
 ) ?? fixtures.find((fixture) => fixture.matchId === fixtureId);

 if (!match) {
 if (preferredMarket) setMarket(preferredMarket);
 setSearchFixtureId(fixtureId);
 setPage(1);
 requestAnimationFrame(() =>
 fixtureListHeadingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
 );
 return;
 }

 const nextMarket =
 preferredMarket && preferredMarket !== "All" ? preferredMarket : match.marketCode;
 setMarket(nextMarket);
 setSearchFixtureId(fixtureId);
 const filtered = fixtures.filter(
 (fixture) =>
 fixture.matchId === fixtureId &&
 (nextMarket === "All" || fixture.marketCode === nextMarket)
 );
 const index = filtered.findIndex((row) => row.id === match.id);
 setPage(index >= 0 ? Math.floor(index / FIXTURE_PAGE_SIZE) + 1 : 1);
 void openFixture(match);
 requestAnimationFrame(() => {
 fixtureListHeadingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
 fixtureCardRefs.current
 .get(match.id)
 ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
 });
 return;
 }

 if (preferredMarket) {
 setMarket(preferredMarket);
 setSearchFixtureId(null);
 setPage(1);
 requestAnimationFrame(() =>
 fixtureListHeadingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
 );
 }
 // One-shot deep-open from URL; openFixture is stable enough for mount.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [fixtures]);

 useEffect(() => {
 const onHide = () => flushFixtureTime();
 window.addEventListener("pagehide", onHide);
 return () => {
 window.removeEventListener("pagehide", onHide);
 flushFixtureTime();
 };
 // flushFixtureTime only reads refs (fixtureOpenedAt, localeRef).
 }, []);

 return (
 <div>
 <div ref={fixtureListHeadingRef} id="fixture-list-heading" className="mb-6">
 {/*
  THE MAP'S TWO FILTER ROWS. League and market were one undifferentiated scroller separated by a
  hairline, so the reader had to infer where one axis ended and the other began. Each row now
  states what it filters.
 */}
 <div className="mb-2 flex flex-wrap items-center gap-2.5">
 <span className="rw-m mr-1 shrink-0 text-[var(--hero-ink-2)]">{FILTER_LABEL_LEAGUE}</span>
 <div
 className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] snap-x snap-mandatory [&::-webkit-scrollbar]:hidden"
 role="toolbar"
 aria-label="League filters"
 >
 {leagues.map((label) => (
 <FilterButton
 key={label}
 label={label}
 active={league === label}
 onClick={() => {
 setLeague(label);
 setPage(1);
 trackHomepageFilter("league", label, locale);
 }}
 />
 ))}
 </div>
 </div>

 <div className="flex flex-wrap items-center gap-2.5">
 <span className="rw-m mr-1 shrink-0 text-[var(--hero-ink-2)]">{FILTER_LABEL_MARKET}</span>
 <div
 className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] snap-x snap-mandatory [&::-webkit-scrollbar]:hidden"
 role="toolbar"
 aria-label="Market filters"
 >
 {FILTER_GROUPS.market.map((label) => (
 <FilterButton
 key={label}
 label={label}
 active={market === label}
 onClick={() => {
 setMarket(label);
 setPage(1);
 trackHomepageFilter("market", label, locale);
 }}
 />
 ))}
 {(searchQuery || searchFixtureId) && (
 <button
 type="button"
 onClick={() => {
 setSearchQuery("");
 setSearchFixtureId(null);
 setPage(1);
 }}
 className="rw-m min-h-9 shrink-0 snap-start border border-[var(--hero-line)] px-2.5 py-1.5 tracking-[0.1em] text-[var(--hero-ink-2)] hover:text-[var(--hero-ink)]"
 >
 Clear search
 </button>
 )}
 </div>
 </div>
 </div>

 {/* The column head. Hidden below sm, where the rows collapse to stacked blocks. */}
 <div className={`rw-label hidden border-y-[0.5px] border-[var(--hero-ink-2)] py-1.5 text-[var(--hero-ink-2)] ${DESK_COLUMNS}`}>
 <span>No.</span>
 <span>Fixture</span>
 <span>League</span>
 <span>KO UTC</span>
 <span className="text-center">Market</span>
 <span className="text-right">{DESK_POTENTIAL_LABEL}</span>
 <span />
 </div>

 <div className="border-t-[0.5px] border-[var(--hero-ink-2)]">
 {pagedFixtures.map((fixture, index) => {
 const open = expandedId === fixture.id;
 const isSaved = savedIds.has(fixture.id);
 const detailId = `fixture-detail-${fixture.id}`;
 return (
 <article key={fixture.id} ref={(node) => { if (node) fixtureCardRefs.current.set(fixture.id, node); else fixtureCardRefs.current.delete(fixture.id); }} data-fixture-id={fixture.id} className="border-b border-[var(--hero-line)]">
 <button
 type="button"
 className={`rw-row w-full py-2.5 text-left sm:items-center ${DESK_COLUMNS}`}
 onClick={() => void toggleFixture(fixture, open)}
 aria-expanded={open}
 aria-controls={detailId}
 >
 <span className="rw-tnum rw-m hidden text-[var(--hero-ink-2)] sm:block">{String(index + 1).padStart(2, "0")}</span>
 <span className="flex min-w-0 items-center gap-2">
 <TeamLogo src={fixture.homeImage} name={fixture.home} size="sm" />
 <TeamLogo src={fixture.awayImage} name={fixture.away} size="sm" />
 <span className="truncate text-[14px] font-semibold tracking-[-0.01em] text-[var(--hero-ink)]">{fixture.home} v {fixture.away}</span>
 </span>
 <span className="mt-1.5 block sm:mt-0"><V2LeagueCell country={fixture.country} league={fixture.league} /></span>
 <time dateTime={fixture.kickoffDateTime} className="rw-tnum rw-m mt-1.5 block text-[var(--hero-ink-2)] sm:mt-0">{fixture.kickoff}</time>
 <span className="rw-m mt-1.5 inline-block border border-[var(--hero-line)] px-2 py-0.5 text-[var(--hero-ink-2)] sm:mt-0 sm:justify-self-center">{fixture.marketCode}</span>
 {/*
  THE POTENTIAL COLUMN. It read "Market probability" in brand green, which named the figure
  with a word the vocabulary reserves and coloured it like a result. It is the provider's
  potential, in ink, at the heading face — the same figure the ranked section leads with.
 */}
 <span className="rw-h rw-tnum mt-1.5 block text-[20px] tracking-[-0.03em] text-[var(--hero-ink)] sm:mt-0 sm:text-right">
 {fixture.modelProbability}
 <span className="rw-mono align-baseline text-[11px] font-normal tracking-normal">%</span>
 </span>
 <span aria-hidden className="hidden text-[13px] text-[var(--hero-ink-2)] sm:block sm:justify-self-end">
 {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
 </span>
 </button>
 {open && (
 <FixtureDetail
 locale={locale}
 fixture={fixture}
 detail={matchDetails[String(fixture.matchId)]}
 qualifiedMarkets={fixtures.filter((candidate) => candidate.matchId === fixture.matchId)}
 research={mapFootyStatsEvidence(matchDetails[String(fixture.matchId)], fixture.marketKind)}
 saved={isSaved}
 detailLoading={loadingDetail === fixture.matchId}
 detailError={detailErrors[String(fixture.matchId)] ?? null}
 onRetryDetail={() => {
 setMatchDetails((current) => {
 const next = { ...current };
 delete next[String(fixture.matchId)];
 return next;
 });
 void loadMatchDetail(fixture);
 }}
 onSave={() => {
 const record: SavedFixtureRecord = {
 id: fixture.id,
 matchId: fixture.matchId,
 marketCode: fixture.marketCode,
 home: fixture.home,
 away: fixture.away,
 league: fixture.league,
 modelProbability: fixture.modelProbability,
 savedAt: new Date().toISOString(),
 };
 const next = toggleSavedFixture(loadSavedFixtures(), record);
 setSavedIds(new Set(next.map((item) => item.id)));
 }}
 />
 )}
 </article>
 );
 })}
 {!visible.length && <div className="border border-border bg-card py-12 text-center text-sm text-[var(--ink-secondary)]">{searchQuery ? "No fixtures match this search." : dict.predictions.empty}</div>}
 </div>
 {totalPages > 1 && <nav className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-4" aria-label="Fixture list pagination">
 <button type="button" disabled={currentPage === 1} onClick={() => changePage(currentPage - 1)} className="border border-border px-3 py-1.5 text-sm text-foreground disabled:cursor-not-allowed disabled:opacity-[var(--opacity-disabled)]">Previous</button>
 <span className="font-mono text-xs text-muted-foreground">Page {currentPage} of {totalPages}</span>
 <button type="button" disabled={currentPage === totalPages} onClick={() => changePage(currentPage + 1)} className="border border-border px-3 py-1.5 text-sm text-foreground disabled:cursor-not-allowed disabled:opacity-[var(--opacity-disabled)]">Next</button>
 </nav>}
 </div>
 );
}

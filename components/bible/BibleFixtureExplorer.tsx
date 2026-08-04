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
 ExternalLink,
 Filter,
 Info,
 MapPin,
 ShieldCheck,
 Target,
} from "lucide-react";
import type { FullDictionary } from "@/lib/dictionaries";
import type { DailyMatchLists } from "@/lib/footystats/types";
import {
 mapDailyListsToQualifiedFixtures,
 type QualifiedFixture,
} from "@/lib/research/qualifiedFixture";
import { V2LeagueCell } from "@/components/homepage/v2Chrome";
import { leagueKeyFor } from "@/lib/homepage/heroModel";
import { railTintStyle } from "@/components/homepage/hero/leagueTint";
import { TeamLogo } from "@/components/predictions/TeamLogo";
import { fromFixtureResearch } from "@/lib/evidence-ui";
import { EvidenceCard } from "@/components/evidence-ui/EvidenceCard";
import { EvidenceSection } from "@/components/evidence-ui/EvidenceSection";
import { EvidenceSummaryChip } from "@/components/evidence-ui/EvidenceSummaryChip";
import { QualificationPanel } from "@/components/evidence-ui/QualificationPanel";
import { trackAnalyticsEvent } from "@/lib/analytics/client";
import { trackHomepageFilter } from "@/lib/analytics/homepage";
import { normalizeHomepageSearch } from "@/lib/search/homeFixtureSearch";
import {
 HOMEPAGE_MARKET_FILTERS,
 isHomepageMarketFilter,
} from "@/lib/search/homeSearchRoutes";
import { clampPage, pageItems, totalPagesFor } from "@/lib/pagination";
import {
 IMPRESSION_INTERSECTION_THRESHOLD,
 rememberImpression,
} from "@/lib/analytics/impressions";
import { fixturePath } from "@/lib/fixtures/paths";


const FILTER_GROUPS = {
 market: HOMEPAGE_MARKET_FILTERS,
} as const;

const trackedFixtureImpressions = new Set<string>();
const FIXTURE_PAGE_SIZE = 12;

/**
 * The desk's column track, stated once so the head cannot drift from its rows.
 *
 * Stacked below `sm` — a seven-column table at 360px is a table nobody can read.
 */
const DESK_COLUMNS =
  "pl-3.5 sm:grid sm:grid-cols-[44px_minmax(0,1.5fr)_minmax(0,1.1fr)_minmax(0,0.7fr)_78px_92px_32px] sm:gap-x-3.5";

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

/* ============================================================================
   WHAT THIS FILE NO LONGER CONTAINS, AND WHY.

   `FixtureDetail` — the expand-down accordion — is DELETED, with everything only it reached:
   `ComparisonRow`, `FixtureHistory`, the odds panel mount, the partner-offer cards and their
   impression tracking, the in-place save button, the match-detail fetch/retry machinery and the
   time-on-fixture metric. The map's desk rows are LINKS: a reader reaching for a row is going to
   the fixture's research page, which carries all of the above at full width, maintained once.
   An accordion that re-implements the fixture page inside a table row is a second fixture page
   that drifts from the first.

   Deleted rather than unmounted, per the live-desk lesson: an unreachable interior is one import
   away from returning.
   ========================================================================== */

export function BibleFixtureExplorer({
 lists,
 dict,
}: {
 lists: DailyMatchLists;
 dict: FullDictionary;
}) {
 const params = useParams();
 const locale = typeof params?.locale === "string" ? params.locale : "en";
 const [league, setLeague] = useState("All");
 const [market, setMarket] = useState("All");
 const [searchQuery, setSearchQuery] = useState("");
 const [searchFixtureId, setSearchFixtureId] = useState<number | null>(null);
 const [page, setPage] = useState(1);
 const fixtures = useMemo(() => mapDailyListsToQualifiedFixtures(lists), [lists]);
 const fixtureCardRefs = useRef(new Map<string, HTMLElement>());
 const fixtureListHeadingRef = useRef<HTMLDivElement>(null);
 const deepOpenApplied = useRef(false);
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
 /* The row is a LINK now: a deep link lands the reader ON it — filtered, paged, scrolled —
    and the click through to the research is theirs to make. Nothing expands. */
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
 // One-shot deep-open from URL: filter, page and scroll to the row.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [fixtures]);

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
 {pagedFixtures.map((fixture, index) => (
 <article key={fixture.id} ref={(node) => { if (node) fixtureCardRefs.current.set(fixture.id, node); else fixtureCardRefs.current.delete(fixture.id); }} data-fixture-id={fixture.id} className="border-b border-[var(--hero-line)]">
 {/*
  THE ROW IS A LINK — the map's desk row, and what the accordion was replaced by. A reader
  reaching for a row in a table of fixtures is going to that fixture's research; the page it
  lands on carries everything the expand-down panel duplicated. No chevron: the trailing →
  is the map's own close, static, and the tinted rail states which row is live under the
  pointer. `fixture_view` still fires — the click IS the view intent it always measured.
 */}
 <Link
 href={fixturePath(locale, fixture.matchId, fixture.marketKind, "recently_qualified")}
 className={`rw-row block w-full py-2.5 text-left sm:items-center ${DESK_COLUMNS}`}
 style={railTintStyle(leagueKeyFor(fixture.league), fixture.country)}
 onClick={() => {
 trackAnalyticsEvent({
 event_name: "fixture_view",
 fixture_id: fixture.matchId,
 market: fixture.marketKind,
 operator_slug: null,
 locale,
 user_id: null,
 properties: { league: fixture.league, fixture_label: `${fixture.home} vs ${fixture.away}` },
 });
 }}
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
 <span className="rw-h rw-tnum mt-1.5 block text-[20px] tracking-[-0.03em] text-[var(--hero-ink)] sm:mt-0 sm:text-right">
 {fixture.modelProbability}
 <span className="rw-mono align-baseline text-[11px] font-normal tracking-normal">%</span>
 </span>
 <span aria-hidden className="rw-cell-arrow hidden sm:grid sm:justify-self-end">→</span>
 </Link>
 </article>
 ))}
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

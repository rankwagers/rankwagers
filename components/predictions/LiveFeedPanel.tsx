"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import type { FullDictionary } from "@/lib/dictionaries";
import type { LiveFeedResponse, LiveSignalPublic } from "@/lib/live-feed/types";
import { LIVE_SIGNALS_FRAMING } from "@/lib/trust/claims";
import { resolveTelegramBotUrl } from "@/lib/telegram";
import {
 LiveFeaturedCard,
 LiveHistoryModal,
 LiveUnlockModal,
 UpcomingFeaturedCard,
 UpcomingLockedRow,
} from "./LiveFeedParts";
import { trackAnalyticsEvent } from "@/lib/analytics/client";
import {
 IMPRESSION_INTERSECTION_THRESHOLD,
 rememberImpression,
} from "@/lib/analytics/impressions";

const POLL_MS = 30_000;

type UnlockMode = "live" | "upcoming" | null;

type ResultState = LiveSignalPublic["resultState"];

const RESULT_STATES: ResultState[] = ["live", "pending", "win_pending", "won", "lost"];
const trackedLiveSignalImpressions = new Set<string>();

function parseResultState(v: unknown): ResultState {
 if (typeof v === "string" && RESULT_STATES.includes(v as ResultState)) return v as ResultState;
 return "pending";
}

function normalizeFeatured(raw: unknown): LiveFeedResponse["featured"] {
 if (!raw || typeof raw !== "object") return null;
 const s = raw as Record<string, unknown>;
 if (typeof s.id !== "string") return null;
 return {
 ...(s as LiveSignalPublic),
 resultState: parseResultState(s.resultState),
 };
}

function normalizeFeed(raw: unknown): LiveFeedResponse | null {
 if (!raw || typeof raw !== "object") return null;
 const o = raw as Record<string, unknown>;
 if (typeof o.hourKey !== "string") return null;
 const lockedRaw = Array.isArray(o.locked) ? o.locked : [];
 const locked: LiveFeedResponse["locked"] = lockedRaw.map((item) => {
 const r = item as Record<string, unknown>;
 const cta: "telegram" | "unlock" =
 r.cta === "unlock" ? "unlock" : "telegram";
 return {
 ...(item as LiveFeedResponse["locked"][number]),
 cta,
 };
 });
 return {
 hourKey: o.hourKey,
 featured: normalizeFeatured(o.featured),
 locked,
 history: Array.isArray(o.history) ? (o.history as LiveFeedResponse["history"]) : [],
 upcomingFeatured: (o.upcomingFeatured as LiveFeedResponse["upcomingFeatured"]) ?? null,
 upcomingLocked: Array.isArray(o.upcomingLocked)
 ? (o.upcomingLocked as LiveFeedResponse["upcomingLocked"])
 : [],
 upcomingBatchKey: typeof o.upcomingBatchKey === "string" ? o.upcomingBatchKey : null,
 nextUpcomingRefreshAt:
 typeof o.nextUpcomingRefreshAt === "string" ? o.nextUpcomingRefreshAt : null,
 telegramBotUrl:
 typeof o.telegramBotUrl === "string" ? o.telegramBotUrl : o.telegramBotUrl === null ? null : null,
 source:
 o.source === "telegram-eng" ||
 o.source === "footystats-fallback" ||
 o.source === "empty"
 ? o.source
 : "empty",
 };
}

function LiveSignalsHeader({
 dict,
 historyCount,
 onHistory,
}: {
 dict: FullDictionary;
 historyCount: number;
 onHistory: () => void;
}) {
 const p = dict.predictions;
 return (
 <div className="mb-2">
 <div className="flex items-center justify-between gap-2">
 <div className="flex min-w-0 items-center gap-2">
 <span className="relative flex h-2 w-2 shrink-0 max-lg:h-2.5 max-lg:w-2.5">
 <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-40" />
 <span className="relative inline-flex h-2 w-2 rounded-full bg-brand max-lg:h-2.5 max-lg:w-2.5" />
 </span>
 <span className="text-xs font-semibold uppercase tracking-label text-muted-foreground max-lg:text-metadata max-lg:tracking-label">
 {p.liveSoonTitle}
 </span>
 </div>
 <button
 type="button"
 onClick={onHistory}
 className="shrink-0 rounded-md border border-border bg-muted px-2.5 py-1 text-metadata font-semibold uppercase tracking-label text-[var(--ink-secondary)] transition-colors hover:border-brand/35 hover:text-brand"
 >
 {p.liveHistoryButton}
 {historyCount > 0 ? (
 <span className="ml-1.5 rounded-full bg-brand/20 px-1.5 py-px text-metadata text-brand">
 {historyCount}
 </span>
 ) : null}
 </button>
 </div>
 {/*
 Sprint 27 — claim integrity (backlog P1-10,"Live Signals tipster risk").
 A live-updating feed of"signals" behind a pulsing indicator reads as a tip service
 unless it says otherwise. The framing sits directly under the title, before any signal,
 so a reader cannot see the feed without seeing what it is. Copy comes from the shared
 claim vocabulary so this surface cannot drift from the rest of the product.
 */}
 <p className="mt-1.5 text-metadata leading-snug text-muted-foreground max-lg:text-metadata">
 {LIVE_SIGNALS_FRAMING}
 </p>
 </div>
 );
}

export function LiveFeedPanel({ dict }: { dict: FullDictionary }) {
 const p = dict.predictions;
 const params = useParams();
 const locale = typeof params?.locale === "string" ? params.locale : "en";

 const [feed, setFeed] = useState<LiveFeedResponse | null>(null);
 const [loading, setLoading] = useState(true);
 const [fetchError, setFetchError] = useState(false);
 const [unlockMode, setUnlockMode] = useState<UnlockMode>(null);
 const [historyModalOpen, setHistoryModalOpen] = useState(false);
 const panelRef = useRef<HTMLDivElement>(null);

 const telegramUrl = resolveTelegramBotUrl(feed?.telegramBotUrl);

 const openTelegram = useCallback((source: string, signalId?: string, market?: string) => {
 trackAnalyticsEvent({ event_name: "live_signal_card_clicked", fixture_id: null, market: market ?? null, operator_slug: null, locale, user_id: null, properties: { source, signal_id: signalId ?? null } });
 window.open(telegramUrl, "_blank", "noopener,noreferrer");
 }, [locale, telegramUrl]);

 const load = useCallback(async () => {
 try {
 setFetchError(false);
 const res = await fetch("/api/live-feed", { cache: "no-store" });
 if (!res.ok) {
 setFetchError(true);
 return;
 }
 const data = normalizeFeed(await res.json());
 if (!data) {
 setFetchError(true);
 return;
 }
 setFeed(data);
 } catch {
 setFetchError(true);
 } finally {
 setLoading(false);
 }
 }, []);

 useEffect(() => {
 load();
 const id = window.setInterval(load, POLL_MS);
 return () => window.clearInterval(id);
 }, [load]);

 useEffect(() => {
 const root = panelRef.current;
 if (!root || !("IntersectionObserver" in window)) return;
 const observer = new IntersectionObserver((entries) => {
 for (const entry of entries) {
 if (!entry.isIntersecting || entry.intersectionRatio < IMPRESSION_INTERSECTION_THRESHOLD) continue;
 const element = entry.target as HTMLElement;
 const signalId = element.dataset.liveSignalId;
 if (!signalId || !rememberImpression(trackedLiveSignalImpressions, signalId)) continue;
 observer.unobserve(element);
 trackAnalyticsEvent({
 event_name: "live_signal_impression",
 fixture_id: null,
 market: element.dataset.market ?? null,
 operator_slug: null,
 locale,
 user_id: null,
 properties: {
 signal_id: signalId,
 source: element.dataset.source ?? "live_feed",
 intersection_threshold: IMPRESSION_INTERSECTION_THRESHOLD,
 },
 });
 }
 }, { threshold: IMPRESSION_INTERSECTION_THRESHOLD }); // Count only after 60% of a live-signal card is visible.
 root.querySelectorAll<HTMLElement>("[data-live-signal-id]").forEach((element) => observer.observe(element));
 return () => observer.disconnect();
 }, [feed, locale]);

 const locked = feed?.locked ?? [];
 const upcomingLocked = feed?.upcomingLocked ?? [];
 const history = feed?.history ?? [];
 const hasLiveContent = Boolean(feed?.featured) || locked.length > 0;
 const hasUpcoming = feed?.upcomingFeatured != null || upcomingLocked.length > 0;

 const mobileAlertBadge = (() => {
 const featured = feed?.featured;
 if (featured?.resultState === "won") {
 return {
 label: p.liveFeaturedWonBadge,
 ring: "",
 bg: "bg-[var(--green-surface)] text-brand",
 };
 }
 if (featured?.resultState === "win_pending") {
 return {
 label: p.liveFeaturedWinPendingBadge,
 ring: "",
 bg: "bg-[var(--amber-surface)] text-[var(--amber-primary)]",
 };
 }
 if (locked.some((l) => l.isNew)) {
 return {
 label: p.liveNewBadge,
 /*
  * `ring-1` supplies the width these ring colours never had: Tailwind's `ring-<colour>` sets
  * only --tw-ring-color, so `ring-brand/50` alone computed to `box-shadow: none` and the two
  * brand badge states were separated by fill alpha alone. With the fill now shared (below),
  * the ring is what carries the new-vs-featured distinction, so it has to actually render.
  */
 ring: "ring-1 ring-brand/50",
 /*
  * Was `bg-brand/25 text-brand-light` — 3.47:1, the last axe-core node on /en at 390. The
  * alpha-tinted brand fill resolved to #c0d6cb under the card, and --green-positive on that
  * is short of the 4.5:1 floor. This is the pairing the `won` variant above already ships
  * (#0e6b4f on solid --green-surface, 5.73:1), so the badge set converges on one measured
  * green rather than three tints of it. Note this variant only renders when the feed has a
  * new locked item, which is why the scan reached it on one run and not the next.
  */
 bg: "bg-[var(--green-surface)] text-brand",
 };
 }
 if (featured?.resultState === "live") {
 return {
 label: p.statusLive,
 ring: "",
 bg: "bg-[var(--amber-surface)] text-[var(--amber-primary)]",
 };
 }
 if (featured) {
 return {
 label: p.liveFeaturedLabel,
 /* See the `isNew` variant above: `ring-1` is what makes this ring colour render at all. */
 ring: "ring-1 ring-brand/35",
 /*
  * Was `bg-brand/15 text-brand-light` — 4.06:1. axe never reported it, because this is the
  * fallback variant and the feed was serving a different state on every scan; it was found by
  * measuring all five variants directly rather than whichever one the data happened to pick.
  * Same measured pairing as the other green badges (5.73:1); the lighter ring keeps it
  * subordinate to the `isNew` badge now that both share a fill.
  */
 bg: "bg-[var(--green-surface)] text-brand",
 };
 }
 return null;
 })();

 return (
 <>
 <div ref={panelRef} id="live-feed" className="rounded-lg border border-border bg-card p-5 shadow-card">
 <div className="mb-3 rounded-lg border border-brand/20 bg-accent/50 p-3 lg:hidden">
 <LiveSignalsHeader
 dict={dict}
 historyCount={history.length}
 onHistory={() => setHistoryModalOpen(true)}
 />
 {mobileAlertBadge && (
 <div className="mt-2 flex justify-end">
 <span
 className={`shrink-0 rounded-full px-2.5 py-0.5 text-metadata font-semibold uppercase tracking-label ${mobileAlertBadge.bg} ${mobileAlertBadge.ring}`}
 >
 {mobileAlertBadge.label}
 </span>
 </div>
 )}
 {feed?.featured && (
 <p className="mt-1.5 truncate text-xs font-semibold text-foreground">
 {feed.featured.home} vs {feed.featured.away}
 <span className="text-muted-foreground"> · {feed.featured.marketLabel}</span>
 </p>
 )}
 </div>

 <div className="max-lg:hidden">
 <LiveSignalsHeader
 dict={dict}
 historyCount={history.length}
 onHistory={() => setHistoryModalOpen(true)}
 />
 </div>
 <p className="text-xs leading-relaxed text-muted-foreground max-lg:hidden">
 {feed?.source === "footystats-fallback" ? p.liveSoonBodyStats : p.liveSoonBody}
 </p>
 <p className="mt-2 text-metadata font-medium uppercase tracking-label text-brand max-lg:hidden">
 {p.liveFeedHourlyNote}
 </p>

 {fetchError && (
 <p
 className="mt-3 rounded-lg border border-[var(--amber-border)] bg-[var(--amber-surface)] px-3 py-2 text-xs text-[var(--amber-primary)]"
 role="alert"
 >
 {p.apiError}
 </p>
 )}

 <div className="mt-4 space-y-3">
 {loading && !feed && (
 <div
 className="h-28 animate-pulse rounded-xl bg-[var(--border-subtle)]"
 aria-hidden
 />
 )}

 {!loading && !fetchError && !hasLiveContent && (
 <p
 className="rounded-lg border border-border bg-[var(--canvas-secondary)] px-3 py-4 text-center text-xs text-muted-foreground"
 role="status"
 >
 {feed?.source === "footystats-fallback" ? p.liveEmptySoft : p.liveEmpty}
 </p>
 )}

 {feed?.featured && (
 <div>
 <p className="mb-1.5 text-metadata font-semibold uppercase tracking-label text-brand">
 {p.liveFeaturedLabel}
 </p>
 <div data-live-signal-id={feed.featured.id} data-market={feed.featured.marketLabel} data-source="featured"><LiveFeaturedCard signal={feed.featured} dict={dict} /></div>
 <button
 type="button"
 onClick={() => openTelegram("featured_cta", feed.featured?.id, feed.featured?.marketLabel)}
 className="mt-2 w-full card py-2.5 text-center text-xs font-semibold text-foreground transition-colors hover:border-brand/35 hover:bg-brand/10 hover:text-brand"
 >
 {p.liveFeaturedMoreCta}
 </button>
 </div>
 )}

 {locked.map((item) => (
 <button
 key={item.id}
 data-live-signal-id={item.id}
 data-market={item.strategy}
 data-source="locked"
 type="button"
 onClick={() => openTelegram("locked_card", item.id, item.strategy)}
 className="relative w-full overflow-hidden rounded-xl border border-border bg-muted/80 p-3 text-left transition-colors hover:border-brand/30"
 >
 <div className="pointer-events-none select-none blur-[5px]">
 <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
 <span className="h-8 w-8 rounded-full bg-card" />
 <span>Home Team</span>
 <span className="font-mono text-brand-light">?–?</span>
 <span>Away Team</span>
 <span className="h-8 w-8 rounded-full bg-card" />
 </div>
 <p className="mt-1 text-xs text-muted-foreground">████████ League</p>
 </div>
 <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/55 px-2">
 {item.isNew && (
 <span className="mb-1 rounded-full bg-brand/20 px-2 py-0.5 text-metadata font-semibold uppercase text-brand">
 {p.liveNewBadge}
 </span>
 )}
 <span className="text-center text-xs font-semibold text-foreground">{item.teaser}</span>
 <span className="mt-0.5 text-metadata text-[var(--ink-secondary)]">{p.liveTapTelegram}</span>
 </div>
 </button>
 ))}
 </div>

 {hasUpcoming && (
 <div className="mt-6 border-t border-border pt-4">
 <p className="mb-3 text-metadata font-semibold uppercase tracking-label text-[var(--info-primary)]">
 {p.upcomingSectionLabel}
 </p>
 <div className="space-y-3">
 {feed?.upcomingFeatured && (
 <div>
 <p className="mb-1.5 text-metadata font-medium text-muted-foreground">
 {p.upcomingFeaturedLabel}
 </p>
 <div data-live-signal-id={feed.upcomingFeatured.id} data-market={feed.upcomingFeatured.marketLabel} data-source="upcoming"><UpcomingFeaturedCard match={feed.upcomingFeatured} /></div>
 </div>
 )}

 {upcomingLocked.map((item) => (
 <div
 key={item.id}
 data-live-signal-id={item.id}
 data-market={item.predictionLabel}
 data-source="upcoming_locked"
 >
 <UpcomingLockedRow
 item={item}
 seePickLabel={p.upcomingTapSeePick}
 startsInLabel={p.upcomingStartsIn.replace("{mins}", String(item.startsInMinutes))}
 onClick={() => openTelegram("upcoming_locked", item.id, item.predictionLabel)}
 />
 </div>
 ))}
 </div>
 </div>
 )}
 </div>

 <LiveHistoryModal
 open={historyModalOpen}
 onClose={() => setHistoryModalOpen(false)}
 items={history}
 dict={dict}
 />

 <LiveUnlockModal
 open={unlockMode !== null}
 onClose={() => setUnlockMode(null)}
 dict={dict}
 locale={locale}
 telegramBotUrl={feed?.telegramBotUrl ?? null}
 variant={unlockMode === "upcoming" ? "upcoming" : "live"}
 />
 </>
 );
}

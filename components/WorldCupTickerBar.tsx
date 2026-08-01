"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PredictionStrings } from "@/lib/translations/predictionsEn";
import type { WorldCupBarItem, WorldCupBarPayload } from "@/lib/api-football/worldCupBar";
import { abbreviateTeamName } from "@/lib/footystats/teamName";
import { TeamLogo } from "@/components/predictions/TeamLogo";
import { Trophy } from "lucide-react";

const POLL_MS = 45_000;
const SCROLL_STEP = 220;

type BarResponse = WorldCupBarPayload & { visible: boolean };

function formatLocalKickoff(iso: string): string {
 try {
 return new Intl.DateTimeFormat(undefined, {
 hour: "2-digit",
 minute: "2-digit",
 hour12: false,
 }).format(new Date(iso));
 } catch {
 return "?";
 }
}

function useCountdown(kickoffIso: string | null): string {
 const [text, setText] = useState("");

 useEffect(() => {
 if (!kickoffIso) {
 setText("");
 return;
 }
 const tick = () => {
 const ms = new Date(kickoffIso).getTime() - Date.now();
 if (ms <= 0) {
 setText("");
 return;
 }
 const h = Math.floor(ms / 3_600_000);
 const m = Math.floor((ms % 3_600_000) / 60_000);
 const s = Math.floor((ms % 60_000) / 1000);
 if (h > 0) {
 setText(`${h}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`);
 } else {
 setText(`${m}:${String(s).padStart(2,"0")}`);
 }
 };
 tick();
 const id = window.setInterval(tick, 1000);
 return () => window.clearInterval(id);
 }, [kickoffIso]);

 return text;
}

function shortenRound(label?: string): string | undefined {
 if (!label) return undefined;
 return label.replace(/^Group Stage\s*-\s*/i, "Grp").replace(/^Round of\s*/i, "R");
}

function MatchPill({
 item,
 liveLabel,
}: {
 item: WorldCupBarItem;
 liveLabel: string;
}) {
 const isLive = item.kind === "live";
 const home = abbreviateTeamName(item.home);
 const away = abbreviateTeamName(item.away);
 const scoreMid =
 isLive || item.homeScore > 0 || item.awayScore > 0
 ? `${item.homeScore}–${item.awayScore}`
 : "vs";
 const round = shortenRound(item.roundLabel);

 return (
 <div
 className={`flex shrink-0 snap-start items-center gap-1.5 rounded-lg border px-2 py-1.5 sm:gap-2 sm:px-2.5 ${
 isLive
 ?"border-[var(--green-primary)] bg-[var(--green-surface)]/[0.1]"
 :"border-[var(--border-subtle)] bg-card"
 }`}
 >
 {isLive && (
 <span className="flex shrink-0 items-center gap-1 rounded-full bg-[var(--green-surface)] px-1.5 py-0.5 text-metadata font-semibold uppercase tracking-label text-brand sm:text-metadata">
 <span className="h-1.5 w-1.5 rounded-full bg-[var(--green-surface)]" />
 {liveLabel}
 </span>
 )}
 <TeamLogo
 src={item.homeLogo}
 name={item.home}
 size="md"
 className="!h-7 !w-7 sm:!h-8 sm:!w-8"
 />
 <div className="flex min-w-0 items-center gap-1 text-metadata font-semibold leading-none text-foreground sm:text-xs">
 <span className="max-w-[3.5rem] truncate sm:max-w-[4.25rem]">{home}</span>
 <span className="shrink-0 px-0.5 font-mono text-metadata font-semibold tabular-nums text-brand-light sm:text-metadata">
 {scoreMid}
 </span>
 <span className="max-w-[3.5rem] truncate sm:max-w-[4.25rem]">{away}</span>
 </div>
 <TeamLogo
 src={item.awayLogo}
 name={item.away}
 size="md"
 className="!h-7 !w-7 sm:!h-8 sm:!w-8"
 />
 {isLive && item.minuteLabel ? (
 <span className="shrink-0 rounded bg-background/70 px-1.5 py-0.5 font-mono text-metadata font-semibold text-brand sm:text-metadata">
 {item.minuteLabel}
 </span>
 ) : (
 <span className="shrink-0 rounded border border-[var(--info-primary)] bg-[var(--info-surface)] px-1.5 py-0.5 font-mono text-metadata font-semibold text-[var(--info-primary)] sm:text-metadata">
 {formatLocalKickoff(item.kickoffIso)}
 </span>
 )}
 {round && (
 <span className="hidden shrink-0 text-metadata text-muted-foreground md:inline">{round}</span>
 )}
 </div>
 );
}

function ScrollButton({
 dir,
 onClick,
}: {
 dir: "left" | "right";
 onClick: () => void;
}) {
 return (
 <button
 type="button"
 onClick={onClick}
 aria-label={dir === "left" ? "Scroll matches left" : "Scroll matches right"}
 className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-background/90 text-[var(--ink-secondary)] transition-colors hover:border-brand/40 hover:text-brand-light sm:h-8 sm:w-8"
 >
 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
 {dir === "left" ? (
 <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
 ) : (
 <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
 )}
 </svg>
 </button>
 );
}

export function WorldCupTickerBar({
 labels,
}: {
 labels: Pick<
 PredictionStrings, "wcBarTitle" | "wcBarSeason" | "wcBarLive" | "wcBarFt" | "wcBarNextIn"
 >;
}) {
 const [data, setData] = useState<BarResponse | null>(null);
 const [canScrollLeft, setCanScrollLeft] = useState(false);
 const [canScrollRight, setCanScrollRight] = useState(false);
 const scrollRef = useRef<HTMLDivElement>(null);
 const countdown = useCountdown(data?.nextKickoffIso ?? null);

 const updateScrollHints = useCallback(() => {
 const el = scrollRef.current;
 if (!el) return;
 const max = el.scrollWidth - el.clientWidth;
 if (max <= 2) {
 setCanScrollLeft(false);
 setCanScrollRight(false);
 return;
 }
 setCanScrollLeft(el.scrollLeft > 4);
 setCanScrollRight(el.scrollLeft < max - 4);
 }, []);

 const scrollBy = (delta: number) => {
 scrollRef.current?.scrollBy({ left: delta, behavior: "smooth" });
 };

 const load = useCallback(async () => {
 try {
 const res = await fetch("/api/world-cup-bar", { cache: "no-store" });
 if (!res.ok) return;
 const json = (await res.json()) as BarResponse;
 if (!json.visible) {
 setData(null);
 return;
 }
 setData(json);
 } catch {
 /* keep previous */
 }
 }, []);

 useEffect(() => {
 load();
 const id = window.setInterval(load, POLL_MS);
 return () => window.clearInterval(id);
 }, [load]);

 useEffect(() => {
 updateScrollHints();
 const el = scrollRef.current;
 if (!el) return;
 const onScroll = () => updateScrollHints();
 el.addEventListener("scroll", onScroll, { passive: true });
 const ro = new ResizeObserver(() => updateScrollHints());
 ro.observe(el);
 return () => {
 el.removeEventListener("scroll", onScroll);
 ro.disconnect();
 };
 }, [data?.items, updateScrollHints]);

 if (!data?.items?.length) return null;

 return (
 <div className="wc-ticker-bar relative w-full max-w-full">
 <div className="wc-ticker-shine pointer-events-none absolute inset-0" aria-hidden />
 <div className="container-wide relative min-w-0 py-2">
 <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
 <div className="wc-ticker-badge flex max-w-[5.5rem] shrink-0 items-center gap-1 rounded-lg px-1.5 py-1.5 sm:max-w-none sm:gap-1.5 sm:px-2.5">
 <Trophy className="h-4 w-4 shrink-0" aria-hidden />
 <div className="min-w-0 text-left leading-none">
 <p className="truncate text-metadata font-semibold uppercase tracking-label text-brand-light sm:text-metadata sm:tracking-label">
 {labels.wcBarTitle}
 </p>
 <p className="hidden text-metadata font-semibold text-[var(--ink-secondary)] sm:block">
 {labels.wcBarSeason.replace("{year}", String(data.season))}
 </p>
 </div>
 </div>

 {canScrollLeft && (
 <ScrollButton dir="left" onClick={() => scrollBy(-SCROLL_STEP)} />
 )}

 <div className="relative min-w-0 flex-1">
 {canScrollRight && <div className="wc-ticker-fade-edge pointer-events-none" aria-hidden />}
 <div
 ref={scrollRef}
 className="wc-ticker-scroll flex min-w-0 items-center gap-2 overflow-x-auto py-0.5 sm:gap-2"
 style={{ WebkitOverflowScrolling: "touch" }}
 >
 {data.items.map((item) => (
 <MatchPill key={item.fixtureId} item={item} liveLabel={labels.wcBarLive} />
 ))}
 </div>
 </div>

 {canScrollRight && (
 <ScrollButton dir="right" onClick={() => scrollBy(SCROLL_STEP)} />
 )}

 {data.nextKickoffIso && countdown && (
 <div className="hidden min-w-0 shrink-0 flex-col items-end justify-center border-l border-border pl-2 sm:flex sm:pl-3">
 <span className="text-metadata font-semibold uppercase tracking-label text-muted-foreground sm:text-metadata">
 {labels.wcBarNextIn}
 </span>
 <span className="font-mono text-sm font-semibold tabular-nums tracking-display text-foreground sm:text-base">
 {countdown}
 </span>
 <span className="text-metadata text-[var(--ink-secondary)] sm:text-metadata">
 {formatLocalKickoff(data.nextKickoffIso)}
 </span>
 </div>
 )}
 </div>
 </div>
 </div>
 );
}

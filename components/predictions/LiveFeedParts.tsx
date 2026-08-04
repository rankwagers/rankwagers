"use client";

import Link from "next/link";
import type { FullDictionary } from "@/lib/dictionaries";
import { resolveTelegramBotUrl } from "@/lib/telegram";
import { formatTeamName } from "@/lib/live-feed/formatTeamName";
import type { LiveSignalPublic, LiveHistoryItem, UpcomingMatchLocked, UpcomingMatchPublic } from "@/lib/live-feed/types";
import { TeamLogo } from "./TeamLogo";
import { X } from "lucide-react";

type LiveStrategyId = LiveSignalPublic["strategy"];

function strategyBadge(strategy: LiveStrategyId) {
 return strategy === "fh05"
 ? "bg-[var(--green-surface)] text-brand"
 : "bg-[var(--amber-surface)] text-[var(--amber-primary)]";
}

function FeedMatchRow({
 home,
 away,
 homeLogo,
 awayLogo,
 children,
 blurTeams = false,
}: {
 home: string;
 away: string;
 homeLogo?: string;
 awayLogo?: string;
 children: React.ReactNode;
 blurTeams?: boolean;
}) {
 const teamBlur = blurTeams ? "blur-[2px] opacity-70" : "";

 /*
  * When the teams are blurred this is a locked teaser: the pick is withheld until the reader
  * opens Telegram, and the 2px blur is the point. That blur also dropped the text to 2.8:1
  * against its surface, which axe-core reported as a contrast failure across every locked row.
  *
  * Raising the opacity would have cleared the checker while leaving the text exactly as
  * unreadable, so the fix is the honest one: the blurred copy is decorative — no sighted reader
  * can resolve it — and it is marked `aria-hidden`, with an `sr-only` copy carrying the same
  * fixture to assistive technology. Screen-reader users get the teams in full, which is strictly
  * more than the blurred pixels offered them before, and the contrast rule no longer applies to
  * a layer that is not meant to be read.
  *
  * `relative` on the grid is required, not incidental: `sr-only` is `position: absolute`, and
  * without a positioned ancestor it resolves against the document and drags the page's scroll
  * width out with it. That is the same failure mode fixed in BibleFixtureExplorer's FilterButton.
  */
 return (
 <div className="relative grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5">
 <TeamLogo src={homeLogo} name={home} size="md" className="row-span-1 self-center" />
 <div
 className={`min-w-0 flex flex-col items-center justify-center self-center ${teamBlur}`}
 aria-hidden={blurTeams || undefined}
 >
 {children}
 </div>
 {blurTeams ? <span className="sr-only">{`${home} vs ${away}`}</span> : null}
 <TeamLogo src={awayLogo} name={away} size="md" className="self-center" />
 </div>
 );
}

function WonCheckIcon() {
 return (
 <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden className="text-brand">
 <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" className="opacity-40" />
 <path
 d="M7 12.5l3 3 6-7"
 stroke="currentColor"
 strokeWidth="2.5"
 strokeLinecap="round"
 strokeLinejoin="round"
 />
 </svg>
 );
}

export function LiveFeaturedCard({
 signal,
 dict,
}: {
 signal: LiveSignalPublic;
 dict: FullDictionary;
}) {
 const p = dict.predictions;
 const isWon = signal.resultState === "won";
 const isWinPending = signal.resultState === "win_pending";
 const o25WonLive = isWon && signal.strategy === "o25" && signal.minute !== "FT";
 const showScoreLine = !o25WonLive;

 const shellClass = isWon
 ? "border border-[var(--green-primary)]"
 : isWinPending
 ? "border border-[var(--amber-border)] animate-[pulse_2.5s_ease-in-out_infinite]"
 : "border border-brand/25";

 return (
 <article className={`relative overflow-hidden rounded-xl p-3 ${shellClass}`}>
 {isWon && (
 <div
 className="pointer-events-none absolute inset-0"
 aria-hidden
 />
 )}

 {isWon && (
 <div className="relative mb-3 flex flex-col items-center gap-1 border-b border-[var(--green-primary)] pb-3">
 <div className="flex items-center gap-2">
 <WonCheckIcon />
 <span className="text-lg font-semibold uppercase tracking-label text-brand drop-shadow-card">
 {p.liveFeaturedWonBadge}
 </span>
 </div>
 <p className="text-center text-metadata font-semibold text-brand">{p.liveFeaturedWonLine}</p>
 </div>
 )}

 {isWinPending && !isWon && (
 <div className="relative mb-3 flex flex-col items-center gap-0.5 border-b border-[var(--amber-border)] pb-2">
 <span className="rounded-full bg-[var(--amber-surface)] px-3 py-0.5 text-metadata font-semibold uppercase tracking-label text-[var(--amber-primary)]">
 {p.liveFeaturedWinPendingBadge}
 </span>
 <p className="text-center text-metadata text-[var(--amber-primary)]">{p.liveFeaturedWinPendingLine}</p>
 </div>
 )}

 <div className="relative mb-2 flex items-center justify-between gap-2">
 <span
 className={`rounded-md px-1.5 py-0.5 text-metadata font-semibold uppercase ${strategyBadge(signal.strategy)}`}
 >
 {signal.marketLabel}
 </span>
 {signal.minute && !isWon && (
 <span className="rw-live-minute font-mono text-xs font-semibold text-[var(--amber-primary)]">{signal.minute}</span>
 )}
 {isWon && signal.minute && (
 <span className="rw-live-minute bg-[var(--green-surface)] px-2 py-0.5 font-mono text-metadata font-semibold text-brand">
 {signal.minute}
 </span>
 )}
 </div>

 <p className="relative truncate text-metadata text-muted-foreground">{signal.league}</p>

 <div className="relative mt-2">
 <FeedMatchRow
 home={signal.home}
 away={signal.away}
 homeLogo={signal.homeLogo}
 awayLogo={signal.awayLogo}
 >
 <div className="flex flex-wrap items-center justify-center gap-x-1 gap-y-0.5 text-sm font-semibold text-foreground">
 <span className="max-w-[5.5rem] truncate sm:max-w-none">{formatTeamName(signal.home)}</span>
 {showScoreLine ? (
 <span className={`shrink-0 font-mono ${isWon ?"text-brand" :"text-brand-light"}`}>
 {signal.homeScore}–{signal.awayScore}
 </span>
 ) : (
 <span className="shrink-0 text-muted-foreground">vs</span>
 )}
 <span className="max-w-[5.5rem] truncate sm:max-w-none">{formatTeamName(signal.away)}</span>
 </div>
 {signal.liveOdd != null && !isWon && (
 <p className="mt-1 text-metadata text-[var(--ink-secondary)]">
 Live odd <span className="font-mono text-foreground">{signal.liveOdd.toFixed(2)}</span>
 </p>
 )}
 </FeedMatchRow>
 </div>
 </article>
 );
}

export function LiveHistoryList({
 items,
 dict,
}: {
 items: LiveHistoryItem[];
 dict: FullDictionary;
}) {
 const p = dict.predictions;

 if (items.length === 0) {
 return (
 <p className="card px-4 py-8 text-center text-sm text-muted-foreground">
 {p.liveHistoryEmpty}
 </p>
 );
 }

 return (
 <ul className="max-h-[min(70vh,28rem)] space-y-2 overflow-y-auto pr-1">
 {items.map((h) => {
 const isWon = h.resultState === "won";
 const isLost = h.resultState === "lost";
 const o25WonLive = isWon && h.strategy === "o25" && h.minute !== "FT";
 const showScore = !o25WonLive;

 return (
 <li
 key={h.id}
 className={
 isWon
 ? "rounded-xl border border-[var(--green-primary)] p-2.5"
 : isLost
 ? "card p-2.5"
 : "rounded-xl border border-brand/20 bg-brand/[0.04] p-2.5"
 }
 >
 <div className="flex items-center justify-between gap-2">
 <span
 className={`rounded-md px-1.5 py-0.5 text-metadata font-semibold uppercase ${strategyBadge(h.strategy)}`}
 >
 {h.marketLabel}
 </span>
 {isWon ? (
 <span className="flex items-center gap-1 text-metadata font-semibold uppercase tracking-label text-brand">
 {p.liveFeaturedWonBadge}
 {h.minute && (
 <span className="rw-live-minute font-mono font-semibold text-brand">{h.minute}</span>
 )}
 </span>
 ) : isLost ? (
 <span className="text-metadata font-semibold text-[var(--red-primary)]">{p.listResultLost}</span>
 ) : (
 <span className="text-metadata font-semibold uppercase text-[var(--ink-secondary)]">
 {h.resultState === "live"
 ? p.statusLive
 : h.resultState === "win_pending"
 ? p.liveFeaturedWinPendingBadge
 : p.statusScheduled}
 </span>
 )}
 </div>
 <p className="mt-1 truncate text-metadata text-muted-foreground">{h.league}</p>
 <div className="mt-2">
 <FeedMatchRow
 home={h.home}
 away={h.away}
 homeLogo={h.homeLogo}
 awayLogo={h.awayLogo}
 >
 <div className="flex flex-wrap items-center justify-center gap-x-1 text-xs font-semibold text-foreground">
 <span className="max-w-[4.5rem] truncate">{formatTeamName(h.home)}</span>
 {showScore ? (
 <span
 className={`font-mono ${isWon ?"text-brand" :"text-brand-light"}`}
 >
 {h.homeScore}–{h.awayScore}
 </span>
 ) : (
 <span className="text-muted-foreground">vs</span>
 )}
 <span className="max-w-[4.5rem] truncate">{formatTeamName(h.away)}</span>
 </div>
 </FeedMatchRow>
 </div>
 </li>
 );
 })}
 </ul>
 );
}

export function LiveHistoryModal({
 open,
 onClose,
 items,
 dict,
}: {
 open: boolean;
 onClose: () => void;
 items: LiveHistoryItem[];
 dict: FullDictionary;
}) {
 const p = dict.predictions;
 if (!open) return null;

 return (
 <div
 className="fixed inset-0 z-[130] flex justify-end bg-background/75 backdrop-blur-sm"
 role="dialog"
 aria-modal="true"
 aria-labelledby="live-history-title"
 onClick={onClose}
 >
 <div
 className="flex h-full w-full max-w-md flex-col border-l border-border bg-muted shadow-elevated"
 onClick={(e) => e.stopPropagation()}
 >
 <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-4">
 <div>
 <h2 id="live-history-title" className="text-base font-semibold text-foreground">
 {p.liveHistoryModalTitle}
 </h2>
 <p className="mt-0.5 text-metadata uppercase tracking-label text-muted-foreground">
 {p.liveHistoryLabel} · {items.length}
 </p>
 </div>
 <button
 type="button"
 onClick={onClose}
 className="rounded-lg px-2 py-1 text-[var(--ink-secondary)] hover:bg-card hover:text-foreground"
 aria-label="Close"
 >
 <X className="h-4 w-4" aria-hidden />
 </button>
 </div>
 <div className="flex-1 overflow-hidden p-4">
 <LiveHistoryList items={items} dict={dict} />
 </div>
 </div>
 </div>
 );
}

/** @deprecated Use LiveHistoryModal — kept for gradual removal */
export function LiveHistorySlider({
 items,
 dict,
 open,
 onToggle,
}: {
 items: LiveHistoryItem[];
 dict: FullDictionary;
 open: boolean;
 onToggle: () => void;
}) {
 const p = dict.predictions;
 if (items.length === 0) return null;

 return (
 <div className="mt-4 border-t border-border pt-3">
 <button
 type="button"
 onClick={onToggle}
 className="flex w-full items-center justify-between gap-2 card px-3 py-2 text-left transition-colors hover:border-brand/30"
 aria-expanded={open}
 >
 <span className="text-metadata font-semibold uppercase tracking-label text-[var(--ink-secondary)]">
 {p.liveHistoryLabel}
 </span>
 <svg
 width="14"
 height="14"
 viewBox="0 0 24 24"
 fill="none"
 className={`shrink-0 text-muted-foreground transition-transform duration-300 ${open ?"rotate-180" :""}`}
 aria-hidden
 >
 <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
 </svg>
 </button>
 <div
 className={`grid transition-[grid-template-rows] duration-300 ease-out ${
 open ?"grid-rows-[1fr]" :"grid-rows-[0fr]"
 }`}
 >
 <div className="min-h-0 overflow-hidden">
 <ul className="mt-2 max-h-80 space-y-2 overflow-y-auto pr-1">
 {items.map((h) => {
 const isWon = h.resultState === "won";
 const o25WonLive = isWon && h.strategy === "o25" && h.minute !== "FT";
 const showScore = !o25WonLive;

 return (
 <li
 key={h.id}
 className={
 isWon
 ? "rounded-xl border border-[var(--green-primary)] p-2.5"
 : "card p-2.5"
 }
 >
 <div className="flex items-center justify-between gap-2">
 <span
 className={`rounded-md px-1.5 py-0.5 text-metadata font-semibold uppercase ${strategyBadge(h.strategy)}`}
 >
 {h.marketLabel}
 </span>
 {isWon ? (
 <span className="flex items-center gap-1 text-metadata font-semibold uppercase tracking-label text-brand">
 {p.liveFeaturedWonBadge}
 {h.minute && (
 <span className="rw-live-minute font-mono font-semibold text-brand">{h.minute}</span>
 )}
 </span>
 ) : (
 <span className="text-metadata font-semibold text-[var(--red-primary)]">{p.listResultLost}</span>
 )}
 </div>
 <p className="mt-1 truncate text-metadata text-muted-foreground">{h.league}</p>
 <div className="mt-2">
 <FeedMatchRow
 home={h.home}
 away={h.away}
 homeLogo={h.homeLogo}
 awayLogo={h.awayLogo}
 >
 <div className="flex flex-wrap items-center justify-center gap-x-1 text-xs font-semibold text-foreground">
 <span className="max-w-[4.5rem] truncate">{formatTeamName(h.home)}</span>
 {showScore ? (
 <span
 className={`font-mono ${isWon ?"text-brand" :"text-brand-light"}`}
 >
 {h.homeScore}–{h.awayScore}
 </span>
 ) : (
 <span className="text-muted-foreground">vs</span>
 )}
 <span className="max-w-[4.5rem] truncate">{formatTeamName(h.away)}</span>
 </div>
 </FeedMatchRow>
 </div>
 </li>
 );
 })}
 </ul>
 </div>
 </div>
 </div>
 );
}

export function UpcomingFeaturedCard({ match }: { match: UpcomingMatchPublic }) {
 const hours = Math.floor(match.startsInMinutes / 60);
 const mins = match.startsInMinutes % 60;
 const countdown = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

 return (
 <article className="rounded-xl border border-[var(--info-primary)] p-3">
 <div className="mb-2 flex items-center justify-between gap-2">
 <span className="rounded-md bg-[var(--info-surface)] px-1.5 py-0.5 text-metadata font-semibold uppercase text-[var(--info-primary)]">
 {match.marketLabel}
 </span>
 <span className="font-mono text-xs font-semibold text-[var(--info-primary)]">{countdown}</span>
 </div>
 <p className="truncate text-metadata text-muted-foreground">{match.league}</p>
 <div className="mt-2">
 <FeedMatchRow home={match.home} away={match.away} homeLogo={match.homeLogo} awayLogo={match.awayLogo}>
 <div className="flex flex-wrap items-center justify-center gap-x-1 text-sm font-semibold text-foreground">
 <span className="max-w-[5.5rem] truncate sm:max-w-none">{formatTeamName(match.home)}</span>
 <span className="text-muted-foreground">vs</span>
 <span className="max-w-[5.5rem] truncate sm:max-w-none">{formatTeamName(match.away)}</span>
 </div>
 <p className="mt-1 text-metadata font-medium text-[var(--info-primary)]">{match.predictionLabel}</p>
 </FeedMatchRow>
 </div>
 </article>
 );
}

export function UpcomingLockedRow({
 item,
 seePickLabel,
 startsInLabel,
 onClick,
}: {
 item: UpcomingMatchLocked;
 seePickLabel: string;
 startsInLabel: string;
 onClick: () => void;
}) {
 return (
 <button
 type="button"
 onClick={onClick}
 className="relative w-full overflow-hidden rounded-xl border border-border bg-muted/80 p-3 text-left transition-colors hover:border-[var(--info-primary)]"
 >
 <p className="truncate text-metadata font-medium text-[var(--ink-secondary)]">{item.league}</p>
 <div className="mt-2">
 <FeedMatchRow
 home={item.home}
 away={item.away}
 homeLogo={item.homeLogo}
 awayLogo={item.awayLogo}
 blurTeams
 >
 <div className="flex flex-wrap items-center justify-center gap-x-1 text-sm font-semibold text-foreground">
 <span>{formatTeamName(item.home)}</span>
 {/*
  * Weight, not colour, separates "vs" from the team names here. This row is already
  * de-emphasised once by the lock treatment (`blur-[2px] opacity-70` on the wrapper), and
  * layering `text-muted-foreground` on top of that 70% opacity resolved to #919893 on the
  * card — 2.8:1, which was the last nine axe-core colour-contrast nodes on /en, at both
  * viewports. Inheriting the row's foreground ink puts the separator at 5.81:1 through the
  * same opacity, while `font-normal` keeps it visibly subordinate to the semibold team
  * names. The lock treatment is untouched: the blur is the product behaviour, not a defect.
  */}
 <span className="font-normal">vs</span>
 <span>{formatTeamName(item.away)}</span>
 </div>
 </FeedMatchRow>
 </div>
 <div className="pointer-events-none absolute inset-x-0 bottom-0 top-8 flex flex-col items-center justify-end from-ink/90 via-ink/50 to-transparent pb-3 pt-6">
 <span className="text-center text-xs font-semibold text-foreground">{seePickLabel}</span>
 <span className="mt-0.5 text-metadata text-[var(--ink-secondary)]">{startsInLabel}</span>
 </div>
 </button>
 );
}

export function LiveUnlockModal({
 open,
 onClose,
 dict,
 locale,
 telegramBotUrl,
 variant = "live",
}: {
 open: boolean;
 onClose: () => void;
 dict: FullDictionary;
 locale: string;
 telegramBotUrl: string | null;
 variant?: "live" | "upcoming";
}) {
 const p = dict.predictions;
 const botUrl = resolveTelegramBotUrl(telegramBotUrl);
 if (!open) return null;

 const title = variant === "upcoming" ? p.upcomingUnlockTitle : p.liveUnlockTitle;
 const body = variant === "upcoming" ? p.upcomingUnlockBody : p.liveUnlockBody;

 return (
 <div
 className="fixed inset-0 z-[120] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
 role="dialog"
 aria-modal="true"
 onClick={onClose}
 >
 <div className="card max-w-md border-brand/30 p-6" onClick={(e) => e.stopPropagation()}>
 <h3 className="text-lg font-semibold text-foreground">{title}</h3>
 <p className="mt-3 text-sm leading-relaxed text-[var(--ink-secondary)]">{body}</p>
 <div className="mt-6 flex flex-col gap-2">
 {variant === "upcoming" ? (
 <>
 <a
 href={botUrl}
 target="_blank"
 rel="noopener noreferrer"
 className="btn-primary text-center text-sm"
 onClick={onClose}
 >
 {p.liveUnlockTelegram}
 </a>
 <Link
 href={`/${locale}/best-betting-sites`}
 className="btn-ghost text-center text-sm"
 onClick={onClose}
 >
 {p.liveUnlockAffiliate}
 </Link>
 </>
 ) : (
 <>
 <a
 href={botUrl}
 target="_blank"
 rel="noopener noreferrer"
 className="btn-primary text-center text-sm"
 onClick={onClose}
 >
 {p.liveUnlockTelegram}
 </a>
 <Link
 href={`/${locale}/best-betting-sites`}
 className="btn-ghost text-center text-sm"
 onClick={onClose}
 >
 {p.liveUnlockAffiliate}
 </Link>
 </>
 )}
 <button type="button" className="mt-1 text-xs text-muted-foreground hover:text-[var(--ink-secondary)]" onClick={onClose}>
 Close
 </button>
 </div>
 </div>
 </div>
 );
}

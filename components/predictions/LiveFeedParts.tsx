"use client";

import Link from "next/link";
import type { FullDictionary } from "@/lib/dictionaries";
import { resolveTelegramBotUrl } from "@/lib/telegram";
import { formatTeamName } from "@/lib/live-feed/formatTeamName";
import type { LiveSignalPublic, LiveHistoryItem } from "@/lib/live-feed/types";
import { TeamLogo } from "./TeamLogo";
import { X } from "lucide-react";

/* ============================================================================
   WHAT THIS FILE NO LONGER CONTAINS, AND WHY.

   `LiveFeaturedCard`, `UpcomingFeaturedCard`, `UpcomingLockedRow`, `LiveUnlockModal` and
   `LiveHistorySlider` are DELETED, not unmounted. They were the live desk's old interior — the
   rounded green-badged card, the blurred locked teasers and the unlock modal behind them — and
   twice a pass "converted" the desk while they kept painting it, because the deletions happened
   around them rather than to them. The desk's interior is `LiveDeskCard` now; what remains here
   is the history dialog and the helpers only it uses.
   ========================================================================== */

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
}: {
 home: string;
 away: string;
 homeLogo?: string;
 awayLogo?: string;
 children: React.ReactNode;
}) {
 /*
  * The `blurTeams` capability this row used to carry is deleted with the locked teasers that
  * were its only caller. A row that can blur its teams is a teaser waiting for a prop, and the
  * history list — the one consumer left — publishes every fixture it names.
  */
 return (
 <div className="relative grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5">
 <TeamLogo src={homeLogo} name={home} size="md" className="row-span-1 self-center" />
 <div className="min-w-0 flex flex-col items-center justify-center self-center">
 {children}
 </div>
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

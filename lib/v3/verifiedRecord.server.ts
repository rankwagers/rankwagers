import "server-only";

import { queryArchive } from "@/lib/archive/load";
import type { Locale } from "@/lib/i18n";

/* ============================================================================
   THE VERIFIED RECORD CARD (v3 polish, group 7).

   One source: the ARCHIVE's settled record — the same `queryArchive` call,
   the same 60-day window, the same metrics /archive prints in its lead
   line. The card can no longer drift from the page it links to: a probe
   pins builder output == archive metrics. Zero settled → null → the card
   is omitted whole (never 0%, never a dash).
   ========================================================================== */

export type VerifiedRecordCard = {
  /** Integer — group 9's law: whole percentages everywhere. */
  hitRatePct: number;
  won: number;
  lost: number;
  settled: number;
  /** The stated window: the archive's own date range. */
  windowLabel: string;
};

/** "Apr 2026" — locale-aware month+year for the window's bounds (group 3). */
function monthLabel(date: string, locale: string): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

export async function buildVerifiedRecordCard(
  locale: Locale,
  /** The dictionary's word for the open end ("today"), localized by the caller. */
  todayWord: string
): Promise<VerifiedRecordCard | null> {
  const { metrics, dates } = await queryArchive(locale, {}, { dateLimit: 60 });
  const settled = metrics.won + metrics.lost;
  if (settled === 0 || metrics.hitRatePct === null) return null;
  const newest = dates[0];
  const oldest = dates[dates.length - 1];

  /*
   * GROUP 3 — the window reads "Apr 2026 → today", never two wrapping ISO
   * dates: the from-bound as a locale-aware month, the to-bound as the
   * dictionary's own "today" when the window reaches the present day
   * (its month otherwise). Same real bounds, human units.
   */
  const todayIso = new Date().toISOString().slice(0, 10);
  const from = oldest ? monthLabel(oldest, locale) : "";
  const to = newest ? (newest >= todayIso ? todayWord : monthLabel(newest, locale)) : "";
  return {
    hitRatePct: Math.round(metrics.hitRatePct),
    won: metrics.won,
    lost: metrics.lost,
    settled,
    windowLabel: from && to && from !== to ? `${from} → ${to}` : to || from,
  };
}

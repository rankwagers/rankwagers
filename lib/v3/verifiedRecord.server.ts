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

export async function buildVerifiedRecordCard(
  locale: Locale
): Promise<VerifiedRecordCard | null> {
  const { metrics, dates } = await queryArchive(locale, {}, { dateLimit: 60 });
  const settled = metrics.won + metrics.lost;
  if (settled === 0 || metrics.hitRatePct === null) return null;
  const newest = dates[0];
  const oldest = dates[dates.length - 1];
  return {
    hitRatePct: Math.round(metrics.hitRatePct),
    won: metrics.won,
    lost: metrics.lost,
    settled,
    windowLabel: oldest && newest && oldest !== newest ? `${oldest} → ${newest}` : newest ?? "",
  };
}

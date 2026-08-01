import { trackAnalyticsEvent } from "@/lib/analytics/client";
import type { AnalyticsEventName } from "@/lib/analytics/types";
import { stakeModel } from "./odds";
import type { AccaSlip } from "./types";

export const ACCA_ANALYTICS_EVENTS = [
  "acca_opened",
  "acca_selection_added",
  "acca_selection_removed",
  "acca_cleared",
  "acca_undo",
  "acca_stake_entered",
  "acca_operator_selected",
  "acca_affiliate_handoff",
  "acca_share_clicked",
  "acca_copy_clicked",
  "acca_telegram_export",
  "acca_named_saved",
  "acca_named_loaded",
] as const satisfies readonly AnalyticsEventName[];

export type AccaAnalyticsEvent = (typeof ACCA_ANALYTICS_EVENTS)[number];

function slipProps(slip: AccaSlip): Record<string, string | number | boolean | null> {
  const stake = stakeModel(slip.selections, slip.stake);
  const markets = slip.selections.map((s) => s.marketKey).join(",");
  const teams = slip.selections
    .flatMap((s) => [s.homeTeam, s.awayTeam])
    .slice(0, 12)
    .join("|");
  return {
    acca_id: slip.id,
    selection_count: slip.selections.length,
    combined_odds: stake.combinedOdds,
    stake: stake.stake,
    markets,
    teams,
    odds_complete: stake.oddsComplete,
  };
}

export function trackAccaEvent(
  event_name: AccaAnalyticsEvent,
  input: {
    locale?: string | null;
    slip?: AccaSlip;
    fixture_id?: number | null;
    market?: string | null;
    operator_slug?: string | null;
    properties?: Record<string, string | number | boolean | null>;
  }
): void {
  trackAnalyticsEvent({
    event_name,
    fixture_id: input.fixture_id ?? null,
    market: input.market ?? null,
    operator_slug: input.operator_slug ?? null,
    locale: input.locale ?? null,
    user_id: null,
    properties: {
      ...(input.slip ? slipProps(input.slip) : {}),
      ...input.properties,
    },
  });
}

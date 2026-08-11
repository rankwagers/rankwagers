import "server-only";

import { publicationOddsForFixture } from "@/lib/odds-history/publication";
import { listOperators } from "@/lib/operators/registry";
import { resolveOperatorAvailability } from "@/lib/operators/availability";
import { buildGoPath } from "@/lib/operators/go-path";
import type { Locale } from "@/lib/i18n";

/* ============================================================================
   THE PRICE PANEL DATA — observed publication prices per operator, per market,
   for one fixture. Server-only: rows arrive fully signed and fully ordered so
   the client renders and never ranks.

   Laws: availability is a precondition for the Continue (an unavailable
   operator's observed price still renders — the observation is research —
   but carries no commercial link); verified-first then price orders the rows;
   a market with no stored observation is simply ABSENT from the map, so the
   affordance upstream has nothing to render (the empty-state law: no empty
   panels, no "not observed" panels).
   ========================================================================== */

export type PricePanelRow = {
  operatorSlug: string;
  operatorName: string;
  verified: boolean;
  available: boolean;
  decimal: number;
  observedAt: string;
  /** Signed commercial redirect — null when the operator is unavailable or unconfigured. */
  continueHref: string | null;
};

export type PricePanelData = Record<string, PricePanelRow[]>;

export async function buildPricePanelData(input: {
  fixtureId: number;
  kickoffIso: string | null | undefined;
  locale: Locale | string;
  country: string | null;
}): Promise<PricePanelData> {
  const prices = await publicationOddsForFixture(input.fixtureId, input.kickoffIso);
  if (!prices.length) return {};

  const operators = listOperators();
  const byBookmakerId = new Map<number, (typeof operators)[number]>();
  for (const operator of operators) {
    for (const id of operator.apiFootballBookmakerIds) byBookmakerId.set(id, operator);
  }

  const panel: PricePanelData = {};
  for (const price of prices) {
    const operator = byBookmakerId.get(price.operatorId);
    if (!operator) continue; // an unregistered bookmaker is not a surface we can stand behind
    const availability = resolveOperatorAvailability(operator, input.country ?? "");
    const continueHref =
      availability.available && operator.affiliateEnabled
        ? buildGoPath({
            slug: operator.slug,
            placement: "price_panel",
            subid: `pp_${input.fixtureId}_${price.market}_${operator.slug}`.toLowerCase(),
            locale: String(input.locale),
            country: input.country ?? undefined,
            availability: "full",
            deeplinkType: "football_landing",
          })
        : null;
    const rows = panel[price.market] ?? [];
    rows.push({
      operatorSlug: operator.slug,
      operatorName: operator.name,
      verified: operator.verificationStatus === "verified",
      available: availability.available,
      decimal: price.decimal,
      observedAt: price.observedAt,
      continueHref,
    });
    panel[price.market] = rows;
  }

  for (const market of Object.keys(panel)) {
    panel[market].sort(
      (a, b) =>
        Number(b.available) - Number(a.available) ||
        Number(b.verified) - Number(a.verified) ||
        b.decimal - a.decimal ||
        a.operatorSlug.localeCompare(b.operatorSlug)
    );
  }
  return panel;
}

/** Signal/acca market keys → odds-history market keys. Unmapped markets are never observed. */
export const PRICE_PANEL_MARKET_BY_SIGNAL: Record<string, string> = {
  over15: "over15",
  over25: "over25",
  fh05: "fh",
  sh05: "sh",
};

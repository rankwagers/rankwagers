/**
 * Canonical MatchListKind ↔ (marketKey, selectionKey) mapping (Sprint 23B, Phase 2).
 *
 * Blocker-resolution correction #2 (authoritative): every daily-list tab is a
 * single binary over/under selection, so `selectionKey` is always "over". Each
 * `MatchListKind` therefore maps to exactly one primary `(marketKey, selectionKey)`
 * pair. Used by both capture (to fill `supportedMarkets`) and settlement.
 *
 * Pure and side-effect-free; safe to import anywhere.
 */

import type { MatchListKind } from "@/lib/footystats/types";

export type EvidenceMarketSelection = {
  marketKey: string;
  selectionKey: string;
};

/** The one canonical selection per daily-list tab. */
export const MARKET_SELECTION_BY_KIND: Record<
  MatchListKind,
  EvidenceMarketSelection
> = {
  fh: { marketKey: "fh", selectionKey: "over" },
  over15: { marketKey: "over15", selectionKey: "over" },
  over25: { marketKey: "over25", selectionKey: "over" },
  sh: { marketKey: "sh", selectionKey: "over" },
};

/** Forward mapping: daily-list tab → evidence market/selection. */
export function marketSelectionForKind(
  kind: MatchListKind
): EvidenceMarketSelection {
  return MARKET_SELECTION_BY_KIND[kind];
}

// Reverse index, derived from the forward map so the two never drift apart.
const KIND_BY_MARKET_KEY: Record<string, MatchListKind> = Object.fromEntries(
  (Object.keys(MARKET_SELECTION_BY_KIND) as MatchListKind[]).map((kind) => [
    MARKET_SELECTION_BY_KIND[kind].marketKey,
    kind,
  ])
);

/** Reverse mapping: evidence marketKey → daily-list tab (null if unknown). */
export function kindForMarketKey(marketKey: string): MatchListKind | null {
  return KIND_BY_MARKET_KEY[marketKey] ?? null;
}

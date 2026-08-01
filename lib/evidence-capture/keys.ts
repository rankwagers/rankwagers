/**
 * Canonical market/selection key registry (Sprint 23B — Milestone M1).
 *
 * The single, closed, immutable vocabulary for every `marketKey`/`selectionKey`
 * written to the evidence and odds archives, per Implementation Contract §2.B.
 * Pure and side-effect-free.
 *
 * Fail-closed by construction: unknown markets, unknown selections, invalid
 * pairings, and unknown provider/list kinds all resolve to `null`/`false`/`[]`.
 * There is NO fuzzy matching, NO alias outside the frozen set, and NO implicit
 * normalization that could mint a new canonical value.
 *
 * The frozen Sprint 23 contracts type these fields as free-form strings; this
 * registry is the application-layer constraint that closes them — it does not
 * modify those contracts. `marketLabel`/`selectionLabel` are the sole human
 * strings; keys are never rendered.
 */

import type { MatchListKind } from "@/lib/footystats/types";
import { MARKET_SELECTION_BY_KIND } from "./markets";

/** Closed set of canonical market keys (Contract §2.B). Order is stable. */
export const CANONICAL_MARKET_KEYS = [
  "over15",
  "over25",
  "fh",
  "sh",
  "1x2",
  "btts",
] as const;
export type CanonicalMarketKey = (typeof CANONICAL_MARKET_KEYS)[number];

/** Closed set of canonical selection keys (Contract §2.B). Order is stable. */
export const CANONICAL_SELECTION_KEYS = [
  "over",
  "under",
  "home",
  "draw",
  "away",
  "yes",
  "no",
] as const;
export type CanonicalSelectionKey = (typeof CANONICAL_SELECTION_KEYS)[number];

export type CanonicalMarketSelection = {
  marketKey: CanonicalMarketKey;
  selectionKey: CanonicalSelectionKey;
};

type CanonicalSelectionDef = {
  readonly key: CanonicalSelectionKey;
  readonly label: string;
};
type CanonicalMarketDef = {
  readonly label: string;
  readonly selections: readonly CanonicalSelectionDef[];
};

/**
 * The only valid `(marketKey → selectionKey)` pairings and their labels
 * (Contract §2.B): `over15,over25,fh,sh → {over,under}` · `1x2 → {home,draw,away}`
 * · `btts → {yes,no}`. Labels for the daily-list markets/`over` selections match
 * the existing archive labels (guarded by test).
 */
export const CANONICAL_MARKETS: Readonly<
  Record<CanonicalMarketKey, CanonicalMarketDef>
> = {
  over15: {
    label: "Over 1.5 Goals",
    selections: [
      { key: "over", label: "Over 1.5" },
      { key: "under", label: "Under 1.5" },
    ],
  },
  over25: {
    label: "Over 2.5 Goals",
    selections: [
      { key: "over", label: "Over 2.5" },
      { key: "under", label: "Under 2.5" },
    ],
  },
  fh: {
    label: "1st Half Over 0.5",
    selections: [
      { key: "over", label: "FH Over 0.5" },
      { key: "under", label: "FH Under 0.5" },
    ],
  },
  sh: {
    label: "2nd Half Over 0.5",
    selections: [
      { key: "over", label: "SH Over 0.5" },
      { key: "under", label: "SH Under 0.5" },
    ],
  },
  "1x2": {
    label: "Match Result",
    selections: [
      { key: "home", label: "Home" },
      { key: "draw", label: "Draw" },
      { key: "away", label: "Away" },
    ],
  },
  btts: {
    label: "Both Teams To Score",
    selections: [
      { key: "yes", label: "Yes" },
      { key: "no", label: "No" },
    ],
  },
};

/** Non-throwing membership test for the canonical market-key set. */
export function isCanonicalMarketKey(
  value: string
): value is CanonicalMarketKey {
  return (CANONICAL_MARKET_KEYS as readonly string[]).includes(value);
}

/** Non-throwing membership test for the canonical selection-key set. */
export function isCanonicalSelectionKey(
  value: string
): value is CanonicalSelectionKey {
  return (CANONICAL_SELECTION_KEYS as readonly string[]).includes(value);
}

/** Canonical selection keys valid for a market, in registry order; `[]` if unknown. */
export function allowedSelectionsFor(
  marketKey: string
): readonly CanonicalSelectionKey[] {
  if (!isCanonicalMarketKey(marketKey)) return [];
  return CANONICAL_MARKETS[marketKey].selections.map((s) => s.key);
}

/** True only for a `(marketKey, selectionKey)` pair present in the registry. */
export function isCanonicalPairing(
  marketKey: string,
  selectionKey: string
): boolean {
  if (!isCanonicalMarketKey(marketKey)) return false;
  return CANONICAL_MARKETS[marketKey].selections.some(
    (s) => s.key === selectionKey
  );
}

/** Human label for a canonical market; `null` if unknown (fail closed). */
export function marketLabel(marketKey: string): string | null {
  return isCanonicalMarketKey(marketKey)
    ? CANONICAL_MARKETS[marketKey].label
    : null;
}

/** Human label for a canonical `(market, selection)`; `null` if invalid (fail closed). */
export function selectionLabel(
  marketKey: string,
  selectionKey: string
): string | null {
  if (!isCanonicalMarketKey(marketKey)) return null;
  const sel = CANONICAL_MARKETS[marketKey].selections.find(
    (s) => s.key === selectionKey
  );
  return sel ? sel.label : null;
}

// ---- provider/list-kind ↔ canonical mapping (daily-list markets only) ------

const LIST_KINDS: readonly MatchListKind[] = ["fh", "over15", "over25", "sh"];

/** Non-throwing test: is this a known daily-list kind? */
export function isListKind(value: string): value is MatchListKind {
  return (LIST_KINDS as readonly string[]).includes(value);
}

/**
 * Map a provider/list kind to its canonical `(marketKey, selectionKey)`.
 * Fail-closed: an unknown kind — or a mapping that is not a canonical pairing —
 * returns `null`. The list-kind mapping is sourced once from `markets.ts` and
 * re-validated here against the canonical registry, so the two cannot drift and
 * no non-canonical value can escape.
 */
export function canonicalForListKind(
  kind: string
): CanonicalMarketSelection | null {
  if (!isListKind(kind)) return null;
  const pair = MARKET_SELECTION_BY_KIND[kind];
  if (
    !isCanonicalMarketKey(pair.marketKey) ||
    !isCanonicalPairing(pair.marketKey, pair.selectionKey) ||
    !isCanonicalSelectionKey(pair.selectionKey)
  ) {
    return null;
  }
  return { marketKey: pair.marketKey, selectionKey: pair.selectionKey };
}

/**
 * Reverse: canonical marketKey → provider/list kind, or `null` when the market
 * has no daily-list source (e.g. `1x2`, `btts`) or is unknown (fail closed).
 */
export function listKindForMarketKey(marketKey: string): MatchListKind | null {
  if (!isCanonicalMarketKey(marketKey)) return null;
  return isListKind(marketKey) ? marketKey : null;
}

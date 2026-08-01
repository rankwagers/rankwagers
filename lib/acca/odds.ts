import type { AccaSelection, AccaStakeModel } from "./types";

export function roundMoney(value: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

export function combinedDecimalOdds(
  selections: readonly Pick<AccaSelection, "odds">[]
): { combinedOdds: number | null; oddsComplete: boolean; missingOddsCount: number } {
  let missing = 0;
  let product = 1;
  for (const s of selections) {
    if (s.odds == null || !(s.odds > 1)) {
      missing += 1;
      continue;
    }
    product *= s.odds;
  }
  if (!selections.length) {
    return { combinedOdds: null, oddsComplete: true, missingOddsCount: 0 };
  }
  if (missing === selections.length) {
    return { combinedOdds: null, oddsComplete: false, missingOddsCount: missing };
  }
  return {
    combinedOdds: roundMoney(product, 4),
    oddsComplete: missing === 0,
    missingOddsCount: missing,
  };
}

export function stakeModel(
  selections: readonly Pick<AccaSelection, "odds">[],
  stake: number
): AccaStakeModel {
  const safeStake = Number.isFinite(stake) && stake > 0 ? stake : 0;
  const { combinedOdds, oddsComplete, missingOddsCount } = combinedDecimalOdds(selections);
  if (combinedOdds == null || safeStake <= 0) {
    return {
      stake: safeStake,
      combinedOdds,
      potentialReturn: null,
      potentialProfit: null,
      oddsComplete,
      missingOddsCount,
    };
  }
  const potentialReturn = roundMoney(safeStake * combinedOdds);
  return {
    stake: safeStake,
    combinedOdds,
    potentialReturn,
    potentialProfit: roundMoney(potentialReturn - safeStake),
    oddsComplete,
    missingOddsCount,
  };
}

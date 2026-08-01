export type ClosingLineValueInput = {
  opening: number;
  current: number;
  closing: number;
};

export type ClosingLineValueDirection = "positive" | "negative" | "neutral";

export type ClosingLineValueResult = {
  /**
   * Current-price CLV: the percentage advantage of the current price relative
   * to the final market price. A positive result means the current price is
   * higher than the close.
   */
  clvPercent: number;
  direction: ClosingLineValueDirection;
  openingToCurrentPercent: number;
  openingToClosingPercent: number;
};

function assertDecimalOdds(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 1) {
    throw new RangeError(`${label} must be valid decimal odds greater than 1`);
  }
}

function percentChange(from: number, to: number): number {
  return ((from / to) - 1) * 100;
}

function directionFor(value: number): ClosingLineValueDirection {
  if (value > 0) return "positive";
  if (value < 0) return "negative";
  return "neutral";
}

export class ClosingLineValueService {
  calculate(input: ClosingLineValueInput): ClosingLineValueResult {
    assertDecimalOdds(input.opening, "Opening odds");
    assertDecimalOdds(input.current, "Current odds");
    assertDecimalOdds(input.closing, "Closing odds");

    const clvPercent = percentChange(input.current, input.closing);
    return {
      clvPercent,
      direction: directionFor(clvPercent),
      openingToCurrentPercent: percentChange(input.opening, input.current),
      openingToClosingPercent: percentChange(input.opening, input.closing),
    };
  }
}

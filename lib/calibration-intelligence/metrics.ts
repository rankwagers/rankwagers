/** Safe ratio helpers — null when denominator is zero. */

export function hitRate(won: number, lost: number): number | null {
  const d = won + lost;
  if (d <= 0) return null;
  return won / d;
}

export function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Observed success rate among W+L (voids excluded). */
export function observedSuccessRate(won: number, lost: number): number | null {
  return hitRate(won, lost);
}

/**
 * Calibration gap = average published confidence (0–1) − observed success rate.
 * Positive ⇒ overconfident; negative ⇒ underconfident.
 */
export function calibrationGap(
  averageConfidence0to1: number | null,
  observedRate: number | null,
): number | null {
  if (averageConfidence0to1 == null || observedRate == null) return null;
  return averageConfidence0to1 - observedRate;
}

/** Brier score for binary outcomes; p in [0,1], y in {0,1}. */
export function brierScore(pairs: Array<{ p: number; y: 0 | 1 }>): number | null {
  if (pairs.length === 0) return null;
  let sum = 0;
  for (const { p, y } of pairs) {
    const clamped = Math.max(0, Math.min(1, p));
    sum += (clamped - y) ** 2;
  }
  return sum / pairs.length;
}

const LOG_LOSS_EPS = 1e-15;

/** Binary log loss with clipping. */
export function logLoss(pairs: Array<{ p: number; y: 0 | 1 }>): number | null {
  if (pairs.length === 0) return null;
  let sum = 0;
  for (const { p, y } of pairs) {
    const clamped = Math.max(LOG_LOSS_EPS, Math.min(1 - LOG_LOSS_EPS, p));
    sum += y === 1 ? -Math.log(clamped) : -Math.log(1 - clamped);
  }
  return sum / pairs.length;
}

export type ReliabilityBin = {
  binStart: number;
  binEnd: number;
  count: number;
  avgConfidence: number;
  observedRate: number;
};

/**
 * Expected Calibration Error (ECE) with equal-width bins on [0,1].
 */
export function expectedCalibrationError(
  pairs: Array<{ p: number; y: 0 | 1 }>,
  bins = 10,
): { ece: number | null; mce: number | null; table: ReliabilityBin[] } {
  if (pairs.length === 0 || bins <= 0) {
    return { ece: null, mce: null, table: [] };
  }
  const buckets: Array<{ confSum: number; ySum: number; n: number }> = Array.from(
    { length: bins },
    () => ({ confSum: 0, ySum: 0, n: 0 }),
  );
  for (const { p, y } of pairs) {
    const clamped = Math.max(0, Math.min(1, p));
    let idx = Math.floor(clamped * bins);
    if (idx >= bins) idx = bins - 1;
    buckets[idx].confSum += clamped;
    buckets[idx].ySum += y;
    buckets[idx].n += 1;
  }
  const table: ReliabilityBin[] = [];
  let ece = 0;
  let mce = 0;
  const total = pairs.length;
  for (let i = 0; i < bins; i++) {
    const b = buckets[i];
    if (b.n === 0) continue;
    const avgConf = b.confSum / b.n;
    const obs = b.ySum / b.n;
    const gap = Math.abs(avgConf - obs);
    ece += (b.n / total) * gap;
    mce = Math.max(mce, gap);
    table.push({
      binStart: i / bins,
      binEnd: (i + 1) / bins,
      count: b.n,
      avgConfidence: avgConf,
      observedRate: obs,
    });
  }
  return { ece, mce, table };
}

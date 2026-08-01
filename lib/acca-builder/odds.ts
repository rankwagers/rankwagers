/** Odds helpers for Acca Builder — never invent decimals. */

export function normalizeDecimalOdds(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 1) return null;
  return Math.round(n * 1000) / 1000;
}

export function isOddsStale(
  fetchedAt: string | null | undefined,
  now = Date.now(),
  maxAgeMs = 30 * 60 * 1000
): boolean {
  if (!fetchedAt) return false;
  const t = Date.parse(fetchedAt);
  if (!Number.isFinite(t)) return false;
  return now - t > maxAgeMs;
}

export function combineDecimalOddsSafe(
  odds: readonly (number | null | undefined)[]
): { combined: number | null; complete: boolean; missing: number } {
  let missing = 0;
  let product = 1;
  for (const o of odds) {
    const n = normalizeDecimalOdds(o);
    if (n == null) {
      missing += 1;
      continue;
    }
    product *= n;
  }
  if (!odds.length) return { combined: null, complete: true, missing: 0 };
  if (missing === odds.length) {
    return { combined: null, complete: false, missing };
  }
  return {
    combined: Math.round(product * 10000) / 10000,
    complete: missing === 0,
    missing,
  };
}

import type { Locale } from "@/lib/i18n";

/** Canonical localized match-detail path (stable matchId). */
export function fixturePath(
  locale: Locale | string,
  matchId: number,
  market?: string | null,
  source?: string | null
): string {
  const base = `/${locale}/fixtures/${matchId}`;
  const params = new URLSearchParams();
  if (market && market.trim()) params.set("market", market.trim());
  if (source && source.trim()) params.set("source", source.trim());
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

export function parseFixtureMatchId(raw: string): number | null {
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  return id;
}

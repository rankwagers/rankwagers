const MAX_DISPLAY = 17;

/** Uzun takım adlarını kısalt: "Manchester United" → "Manchester Un." */
export function abbreviateTeamName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length <= MAX_DISPLAY) return trimmed;

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return trimmed.slice(0, MAX_DISPLAY - 1) + "…";
  }

  const first = parts[0];
  const second = parts[1];
  const letters = second.length >= 4 ? 2 : 1;
  const short = `${first} ${second.slice(0, letters)}.`;
  if (short.length <= MAX_DISPLAY) return short;

  return `${first.slice(0, 10)} ${second.slice(0, letters)}.`;
}

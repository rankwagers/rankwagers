/** Display team names; longer than maxLen become first maxLen chars plus a trailing period. */
export function formatTeamName(name: string, maxLen = 10): string {
  const trimmed = name.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen)}.`;
}

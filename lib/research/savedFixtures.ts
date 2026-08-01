/**
 * Browser-local saved fixture workspace (session research notes).
 * Client-only persistence — never import secrets or server modules here.
 */

export type SavedFixtureRecord = {
  id: string;
  matchId: number;
  marketCode: string;
  home: string;
  away: string;
  league: string;
  modelProbability: number;
  savedAt: string;
};

const STORAGE_KEY = "rankwagers:saved-fixtures:v1";

export function loadSavedFixtures(): SavedFixtureRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSavedFixtureRecord);
  } catch {
    return [];
  }
}

export function saveSavedFixtures(records: SavedFixtureRecord[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    window.dispatchEvent(new CustomEvent("rankwagers:saved-fixtures-changed"));
  } catch {
    // Quota / private mode — fail silently; UI still works in-memory for the session.
  }
}

export function toggleSavedFixture(
  current: SavedFixtureRecord[],
  record: SavedFixtureRecord
): SavedFixtureRecord[] {
  const exists = current.some((item) => item.id === record.id);
  const next = exists
    ? current.filter((item) => item.id !== record.id)
    : [record, ...current.filter((item) => item.id !== record.id)];
  saveSavedFixtures(next);
  return next;
}

function isSavedFixtureRecord(value: unknown): value is SavedFixtureRecord {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    typeof row.matchId === "number" &&
    typeof row.marketCode === "string" &&
    typeof row.home === "string" &&
    typeof row.away === "string" &&
    typeof row.league === "string" &&
    typeof row.modelProbability === "number" &&
    typeof row.savedAt === "string"
  );
}

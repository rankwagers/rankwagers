"use client";

const STORAGE_KEY = "rw_recent_searches_v1";
const MAX_RECENT = 8;

export function loadRecentSearchQueries(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((row): row is string => typeof row === "string" && row.trim().length > 0)
      .map((row) => row.trim())
      .slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

export function rememberSearchQuery(query: string): string[] {
  const normalized = query.trim();
  if (!normalized || typeof window === "undefined") return loadRecentSearchQueries();
  const next = [
    normalized,
    ...loadRecentSearchQueries().filter(
      (row) => row.toLowerCase() !== normalized.toLowerCase()
    ),
  ].slice(0, MAX_RECENT);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota */
  }
  return next;
}

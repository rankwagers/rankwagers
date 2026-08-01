import type { SearchIndexSnapshot } from "./types";

const DEFAULT_TTL_MS = 5 * 60_000;

type CacheState = {
  snapshot: SearchIndexSnapshot;
  expiresAt: number;
};

let cache: CacheState | undefined;

export function getCachedSearchIndex(): SearchIndexSnapshot | null {
  if (!cache) return null;
  if (cache.expiresAt <= Date.now()) return null;
  return cache.snapshot;
}

export function setCachedSearchIndex(
  snapshot: SearchIndexSnapshot,
  ttlMs = DEFAULT_TTL_MS
): void {
  cache = {
    snapshot,
    expiresAt: Date.now() + ttlMs,
  };
}

export function peekSearchCacheMeta(ttlMs = DEFAULT_TTL_MS): {
  warm: boolean;
  builtAt: number | null;
  ttlMs: number;
  ageMs: number | null;
  expiresAt: number | null;
} {
  if (!cache) {
    return { warm: false, builtAt: null, ttlMs, ageMs: null, expiresAt: null };
  }
  const now = Date.now();
  const warm = cache.expiresAt > now;
  return {
    warm,
    builtAt: cache.snapshot.builtAt,
    ttlMs,
    ageMs: now - cache.snapshot.builtAt,
    expiresAt: cache.expiresAt,
  };
}

export function resetSearchIndexCache(): void {
  cache = undefined;
}

export function searchIndexCacheTtlMs(): number {
  return DEFAULT_TTL_MS;
}

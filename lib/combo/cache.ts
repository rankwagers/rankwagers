import { CANDIDATE_CACHE_TTL_MS, FEATURED_CACHE_TTL_MS, COMBO_CONFIG_VERSION } from "./config";
import type { ComboCandidate, ComboRequest } from "./types";

type CacheEntry<T> = { value: T; expiresAt: number };

const candidateCache = new Map<string, CacheEntry<ComboCandidate[]>>();
const featuredCache = new Map<string, CacheEntry<unknown>>();

export function candidateCacheKey(input: {
  date?: string;
  country?: string;
  markets: string[];
  riskProfile: string;
  configVersion?: number;
}): string {
  return [
    input.date ?? "today",
    input.country ?? "XX",
    [...input.markets].sort().join(","),
    input.riskProfile,
    String(input.configVersion ?? COMBO_CONFIG_VERSION),
  ].join("|");
}

export function getCachedCandidates(key: string): ComboCandidate[] | null {
  const hit = candidateCache.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    candidateCache.delete(key);
    return null;
  }
  return hit.value;
}

export function setCachedCandidates(
  key: string,
  value: ComboCandidate[],
  ttlMs = CANDIDATE_CACHE_TTL_MS
): void {
  candidateCache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function getCachedFeatured(key: string): unknown | null {
  const hit = featuredCache.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    featuredCache.delete(key);
    return null;
  }
  return hit.value;
}

export function setCachedFeatured(
  key: string,
  value: unknown,
  ttlMs = FEATURED_CACHE_TTL_MS
): void {
  featuredCache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function resetComboCaches(): void {
  candidateCache.clear();
  featuredCache.clear();
}

export function comboCacheStats(): {
  candidateEntries: number;
  featuredEntries: number;
} {
  return {
    candidateEntries: candidateCache.size,
    featuredEntries: featuredCache.size,
  };
}

export function requestCacheKey(request: ComboRequest, date?: string): string {
  return candidateCacheKey({
    date,
    country: request.country,
    markets: request.marketPreferences,
    riskProfile: request.riskProfile,
  });
}

import type { DiscoveryBundle } from "./types";

const DEFAULT_TTL_MS = 5 * 60_000;

type RecCacheEntry = {
  bundle: DiscoveryBundle;
  expiresAt: number;
};

type PopularCacheEntry = {
  items: DiscoveryBundle["popular"];
  expiresAt: number;
};

const recommendationCache = new Map<string, RecCacheEntry>();
const popularCache = new Map<string, PopularCacheEntry>();
let lastBuiltAt: number | null = null;

export function discoveryCacheKey(input: {
  type: string;
  slug: string;
  locale: string;
  country?: string | null;
  depth: number;
  limitPerPanel: number;
}): string {
  return [
    input.type,
    input.slug,
    input.locale,
    input.country ?? "",
    input.depth,
    input.limitPerPanel,
  ].join("|");
}

export function getCachedRecommendation(key: string): DiscoveryBundle | null {
  const entry = recommendationCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    recommendationCache.delete(key);
    return null;
  }
  return entry.bundle;
}

export function setCachedRecommendation(
  key: string,
  bundle: DiscoveryBundle,
  ttlMs = DEFAULT_TTL_MS
): void {
  recommendationCache.set(key, { bundle, expiresAt: Date.now() + ttlMs });
  lastBuiltAt = Date.now();
}

export function getCachedPopular(locale: string): DiscoveryBundle["popular"] | null {
  const entry = popularCache.get(locale);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    popularCache.delete(locale);
    return null;
  }
  return entry.items;
}

export function setCachedPopular(
  locale: string,
  items: DiscoveryBundle["popular"],
  ttlMs = DEFAULT_TTL_MS
): void {
  popularCache.set(locale, { items, expiresAt: Date.now() + ttlMs });
  lastBuiltAt = Date.now();
}

export function peekDiscoveryCacheMeta(ttlMs = DEFAULT_TTL_MS): {
  warm: boolean;
  builtAt: number | null;
  ttlMs: number;
  ageMs: number | null;
  recommendationEntries: number;
} {
  const now = Date.now();
  const warm = recommendationCache.size > 0 || popularCache.size > 0;
  return {
    warm,
    builtAt: lastBuiltAt,
    ttlMs,
    ageMs: lastBuiltAt == null ? null : now - lastBuiltAt,
    recommendationEntries: recommendationCache.size,
  };
}

export function discoveryCacheTtlMs(): number {
  return DEFAULT_TTL_MS;
}

export function resetDiscoveryCache(): void {
  recommendationCache.clear();
  popularCache.clear();
  lastBuiltAt = null;
}

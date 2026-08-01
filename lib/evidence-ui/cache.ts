import type { EvidenceBundle } from "./types";

const DEFAULT_TTL_MS = 5 * 60_000;

type Entry = { bundle: EvidenceBundle; expiresAt: number; builtAt: number };

const cache = new Map<string, Entry>();
const adapterDurations: number[] = [];
const MAX_SAMPLES = 100;

export function getCachedEvidenceBundle(key: string): EvidenceBundle | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.bundle;
}

export function setCachedEvidenceBundle(
  key: string,
  bundle: EvidenceBundle,
  ttlMs = DEFAULT_TTL_MS
): void {
  cache.set(key, {
    bundle,
    expiresAt: Date.now() + ttlMs,
    builtAt: Date.now(),
  });
}

export function recordAdapterDuration(ms: number): void {
  adapterDurations.push(ms);
  if (adapterDurations.length > MAX_SAMPLES) adapterDurations.shift();
}

export function averageAdapterMs(): number {
  if (!adapterDurations.length) return 0;
  const sum = adapterDurations.reduce((a, b) => a + b, 0);
  return Math.round((sum / adapterDurations.length) * 100) / 100;
}

export function evidenceCacheStats(): { entries: number; averageAdapterMs: number } {
  return { entries: cache.size, averageAdapterMs: averageAdapterMs() };
}

export function resetEvidenceUiCache(): void {
  cache.clear();
  adapterDurations.length = 0;
}

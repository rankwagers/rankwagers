import type { DiscoveryEntityType, RecentEntityRecord } from "./types";

export type { DiscoveryEntityType, RecentEntityRecord };

export const RECENT_STORAGE_KEY = "rw_recent_entities";
export const RECENT_SESSION_KEY = "rw_recent_entities_session";
export const RECENT_MAX_SIZE = 12;

export function recentEntityKey(entityType: string, slug: string): string {
  return `${entityType}:${slug}`;
}

/** Deduplicate by type:slug (keep newest), enforce max size. */
export function normalizeRecentHistory(
  records: readonly RecentEntityRecord[],
  maxSize = RECENT_MAX_SIZE
): RecentEntityRecord[] {
  const seen = new Set<string>();
  const sorted = [...records].sort((a, b) => b.viewedAt - a.viewedAt);
  const out: RecentEntityRecord[] = [];
  for (const row of sorted) {
    const key = recentEntityKey(row.entityType, row.slug);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
    if (out.length >= maxSize) break;
  }
  return out;
}

export function pushRecentEntity(
  records: readonly RecentEntityRecord[],
  next: Omit<RecentEntityRecord, "viewedAt"> & { viewedAt?: number },
  maxSize = RECENT_MAX_SIZE
): RecentEntityRecord[] {
  const record: RecentEntityRecord = {
    entityType: next.entityType,
    slug: next.slug,
    title: next.title,
    href: next.href,
    viewedAt: next.viewedAt ?? Date.now(),
  };
  return normalizeRecentHistory([record, ...records], maxSize);
}

export function parseRecentHistory(raw: string | null | undefined): RecentEntityRecord[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const rows: RecentEntityRecord[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const row = item as Partial<RecentEntityRecord>;
      if (
        typeof row.entityType !== "string" ||
        typeof row.slug !== "string" ||
        typeof row.title !== "string" ||
        typeof row.href !== "string" ||
        typeof row.viewedAt !== "number"
      ) {
        continue;
      }
      rows.push({
        entityType: row.entityType as DiscoveryEntityType,
        slug: row.slug,
        title: row.title,
        href: row.href,
        viewedAt: row.viewedAt,
      });
    }
    return normalizeRecentHistory(rows);
  } catch {
    return [];
  }
}

export function serializeRecentHistory(records: readonly RecentEntityRecord[]): string {
  return JSON.stringify(normalizeRecentHistory(records));
}

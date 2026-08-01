"use client";

import { useEffect, useState } from "react";
import {
  RECENT_MAX_SIZE,
  RECENT_SESSION_KEY,
  RECENT_STORAGE_KEY,
  parseRecentHistory,
  type RecentEntityRecord,
} from "@/lib/discovery/recent";
import { DiscoveryTrackLink } from "./DiscoveryTrackLink";

function readRecent(): RecentEntityRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const fromLocal = parseRecentHistory(window.localStorage.getItem(RECENT_STORAGE_KEY));
    if (fromLocal.length) return fromLocal.slice(0, RECENT_MAX_SIZE);
  } catch {
    // ignore quota / privacy mode
  }
  try {
    return parseRecentHistory(window.sessionStorage.getItem(RECENT_SESSION_KEY)).slice(
      0,
      RECENT_MAX_SIZE
    );
  } catch {
    return [];
  }
}

export function RecentlyViewed({
  locale,
  country,
  excludeKey,
}: {
  locale: string;
  country?: string | null;
  /** Skip current entity `type:slug`. */
  excludeKey?: string;
}) {
  const [items, setItems] = useState<RecentEntityRecord[]>([]);

  useEffect(() => {
    const rows = readRecent().filter(
      (row) => `${row.entityType}:${row.slug}` !== excludeKey
    );
    setItems(rows);
  }, [excludeKey]);

  if (!items.length) return null;

  return (
    <section className="mt-8" aria-labelledby="recently-viewed">
      <h2 id="recently-viewed" className="font-display text-xl font-semibold text-foreground">
        Recently Viewed
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Stored in this browser only — not synced to the server.
      </p>
      <ul className="mt-3 divide-y divide-border border-y border-border">
        {items.map((item) => (
          <li key={`${item.entityType}-${item.slug}-${item.viewedAt}`}>
            <DiscoveryTrackLink
              href={item.href}
              eventName="recent_click"
              sourceEntity="recent"
              targetEntity={`${item.entityType}:${item.slug}`}
              relationship="recent"
              locale={locale}
              country={country}
              className="flex items-baseline justify-between gap-3 py-2.5 text-sm text-foreground hover:text-brand"
            >
              <span>{item.title}</span>
              <span className="shrink-0 text-metadata uppercase tracking-label text-muted-foreground">
                {item.entityType}
              </span>
            </DiscoveryTrackLink>
          </li>
        ))}
      </ul>
    </section>
  );
}

"use client";

import { useEffect } from "react";
import { trackEntityView } from "@/lib/analytics/knowledgeGraph";
import type { GraphEntityType } from "@/lib/knowledge-graph/entity";
import {
  RECENT_SESSION_KEY,
  RECENT_STORAGE_KEY,
  parseRecentHistory,
  pushRecentEntity,
  serializeRecentHistory,
  type DiscoveryEntityType,
} from "@/lib/discovery/recent";

const DISCOVERY_TYPES = new Set([
  "competition",
  "season",
  "team",
  "fixture",
  "market",
  "operator",
]);

function persistRecent(record: {
  entityType: DiscoveryEntityType;
  slug: string;
  title: string;
  href: string;
}): void {
  if (typeof window === "undefined") return;
  let existing: string | null = null;
  try {
    existing = window.localStorage.getItem(RECENT_STORAGE_KEY);
  } catch {
    existing = null;
  }
  if (!existing) {
    try {
      existing = window.sessionStorage.getItem(RECENT_SESSION_KEY);
    } catch {
      existing = null;
    }
  }
  const next = pushRecentEntity(parseRecentHistory(existing), record);
  const payload = serializeRecentHistory(next);
  try {
    window.localStorage.setItem(RECENT_STORAGE_KEY, payload);
  } catch {
    try {
      window.sessionStorage.setItem(RECENT_SESSION_KEY, payload);
    } catch {
      // ignore storage failures
    }
  }
}

export function EntityViewTracker({
  entityType,
  entitySlug,
  locale,
  title,
  href,
}: {
  entityType: GraphEntityType;
  entitySlug: string;
  locale: string;
  /** Optional — when provided, writes Recently Viewed without bundling the graph. */
  title?: string;
  href?: string;
}) {
  useEffect(() => {
    trackEntityView({ entityType, entitySlug, locale });

    if (!DISCOVERY_TYPES.has(entityType) || !title || !href) return;
    persistRecent({
      entityType: entityType as DiscoveryEntityType,
      slug: entitySlug,
      title,
      href,
    });
  }, [entityType, entitySlug, locale, title, href]);

  return null;
}

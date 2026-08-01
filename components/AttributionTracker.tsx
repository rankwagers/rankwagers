"use client";

import { useEffect } from "react";
import {
  FIRST_TOUCH_COOKIE,
  FIRST_TOUCH_MAX_AGE,
  LAST_TOUCH_COOKIE,
  LAST_TOUCH_MAX_AGE,
  isEmptyTouch,
  parseTouch,
  type Touch,
} from "@/lib/attribution/attribution";

function readCookie(name: string): string | undefined {
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? m[1] : undefined;
}

function writeCookie(name: string, value: Touch, maxAge: number): void {
  try {
    document.cookie = `${name}=${encodeURIComponent(
      JSON.stringify(value)
    )}; path=/; max-age=${maxAge}; SameSite=Lax`;
  } catch {
    /* best-effort */
  }
}

/**
 * Captures first-touch (persist-once) and last-touch attribution on the client
 * and mirrors both into the dataLayer so GA4 can attribute the session. First-
 * party cookies only; readable server-side for later event enrichment.
 * Measurement only — no redirect, no UI, runs once per navigation.
 */
export function AttributionTracker() {
  useEffect(() => {
    try {
      const touch = parseTouch({
        search: window.location.search,
        referrer: document.referrer || "",
        landingPath: window.location.pathname,
        currentHost: window.location.hostname.replace(/^www\./, ""),
        now: new Date().toISOString(),
      });

      // Pure internal navigation with no campaign signal — nothing to record.
      if (isEmptyTouch(touch) && readCookie(FIRST_TOUCH_COOKIE)) return;

      const hasFirst = Boolean(readCookie(FIRST_TOUCH_COOKIE));
      if (!hasFirst) {
        writeCookie(FIRST_TOUCH_COOKIE, touch, FIRST_TOUCH_MAX_AGE);
      }
      // Last-touch refreshes only when a real acquisition signal is present.
      if (!isEmptyTouch(touch)) {
        writeCookie(LAST_TOUCH_COOKIE, touch, LAST_TOUCH_MAX_AGE);
      }

      const w = window as unknown as { dataLayer?: unknown[] };
      w.dataLayer = w.dataLayer || [];
      w.dataLayer.push({
        event: "attribution",
        ft_new: !hasFirst,
        lt_source: touch.source,
        lt_medium: touch.medium,
        lt_campaign: touch.campaign,
        lt_gclid: touch.gclid || undefined,
        lt_msclkid: touch.msclkid || undefined,
      });
    } catch {
      /* best-effort; attribution must never break the page */
    }
  }, []);

  return null;
}

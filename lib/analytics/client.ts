"use client";

import { createBrowserAnalytics } from "./service";
import type { AnalyticsEventInput } from "./types";

let analytics: ReturnType<typeof createBrowserAnalytics> | null = null;

export function trackAnalyticsEvent(event: AnalyticsEventInput): void {
  if (typeof window === "undefined") return;
  analytics ??= createBrowserAnalytics();
  void analytics.track(event).catch(() => {});
}

"use client";

import { useEffect } from "react";
import { useParams, usePathname } from "next/navigation";
import {
  trackHomepageSectionImpression,
  trackPageExit,
  trackScrollDepth,
  type HomepageSectionId,
} from "@/lib/analytics/engagement";
import { IMPRESSION_INTERSECTION_THRESHOLD } from "@/lib/analytics/impressions";

const SECTION_IDS: HomepageSectionId[] = [
  "hero",
  "top_picks",
  "trending_markets",
  "live_matches",
  "live_signals",
  "verified_performance",
  "recent_results",
  "featured_leagues",
  "acca_entry",
  "top_operators",
  "why_trust",
  "prediction_archive",
  "recently_qualified",
  "latest_insights",
  "saved",
];

function currentScrollDepth(): number {
  const documentElement = document.documentElement;
  const scrollable = documentElement.scrollHeight - window.innerHeight;
  if (scrollable <= 0) return 100;
  const ratio = (window.scrollY / scrollable) * 100;
  if (ratio >= 100) return 100;
  if (ratio >= 75) return 75;
  if (ratio >= 50) return 50;
  if (ratio >= 25) return 25;
  return 0;
}

export function HomepageEngagementTracker() {
  const pathname = usePathname() ?? "/";
  const params = useParams();
  const locale = typeof params?.locale === "string" ? params.locale : "en";

  useEffect(() => {
    const onScroll = () => {
      const depth = currentScrollDepth();
      for (const threshold of [25, 50, 75, 100] as const) {
        if (depth >= threshold) trackScrollDepth(threshold, locale);
      }
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [locale]);

  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || entry.intersectionRatio < IMPRESSION_INTERSECTION_THRESHOLD) continue;
          const section = (entry.target as HTMLElement).dataset.analyticsSection as HomepageSectionId | undefined;
          if (!section || !SECTION_IDS.includes(section)) continue;
          trackHomepageSectionImpression(section, locale);
          observer.unobserve(entry.target);
        }
      },
      { threshold: IMPRESSION_INTERSECTION_THRESHOLD }
    );

    for (const section of SECTION_IDS) {
      const node = document.querySelector(`[data-analytics-section="${section}"]`);
      if (node) observer.observe(node);
    }
    return () => observer.disconnect();
  }, [locale, pathname]);

  useEffect(() => {
    const onExit = () => trackPageExit(pathname, locale);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") onExit();
    };
    window.addEventListener("pagehide", onExit);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", onExit);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [locale, pathname]);

  return null;
}

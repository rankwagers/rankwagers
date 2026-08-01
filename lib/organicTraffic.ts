import type { SiteEvent } from "./events";
import { classifyTraffic } from "./trafficClassify";

/** Arama motorundan gelen organik trafik (GSC tıklamalarına yakın sinyal). */
const ORGANIC_SEARCH_HOST =
  /(^|\.)google\.|(^|\.)bing\.com|duckduckgo\.com|search\.yahoo\.com|(^|\.)yandex\.|baidu\.com/i;

export function refererHost(referer: string): string | null {
  const raw = (referer || "").trim();
  if (!raw) return null;
  try {
    return new URL(raw).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function isOrganicSearchReferer(referer: string): boolean {
  const host = refererHost(referer);
  if (!host) return false;
  return ORGANIC_SEARCH_HOST.test(host);
}

export function siteHostname(): string {
  const url = process.env.SITE_URL || "https://rankwagers.com";
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "rankwagers.com";
  }
}

export function isSameSiteReferer(referer: string): boolean {
  const host = refererHost(referer);
  if (!host) return false;
  const site = siteHostname();
  return host === site || host === `www.${site}` || site === `www.${host}`;
}

export type OrganicSummary = {
  organicViews: number;
  organicViewsToday: number;
  organicVisitors: number;
  organicVisitorsToday: number;
  humanViews: number;
  humanViewsToday: number;
  humanVisitorsToday: number;
  bySearchEngine: { key: string; views: number; clicks: number }[];
};

function dayKey(ts: string): string {
  return ts.slice(0, 10);
}

export function summarizeOrganic(events: SiteEvent[]): OrganicSummary {
  const today = new Date().toISOString().slice(0, 10);
  const byEngine = new Map<string, { views: number; clicks: number }>();
  const organicIps = new Set<string>();
  const organicIpsToday = new Set<string>();
  const humanIpsToday = new Set<string>();

  let organicViews = 0;
  let organicViewsToday = 0;
  let humanViews = 0;
  let humanViewsToday = 0;

  for (const e of events) {
    const isToday = dayKey(e.ts) === today;
    const organic = isOrganicSearchReferer(e.referer);
    const badge = classifyTraffic(e);

    if (e.type === "view" && badge.kind === "human") {
      humanViews++;
      if (isToday) {
        humanViewsToday++;
        if (e.ip) humanIpsToday.add(e.ip);
      }
    }

    if (organic) {
      const host = refererHost(e.referer) || "search";
      const cur = byEngine.get(host) || { views: 0, clicks: 0 };
      if (e.type === "click") cur.clicks++;
      else cur.views++;
      byEngine.set(host, cur);

      if (e.type === "view") {
        organicViews++;
        if (e.ip) organicIps.add(e.ip);
        if (isToday) {
          organicViewsToday++;
          if (e.ip) organicIpsToday.add(e.ip);
        }
      }
    }
  }

  const bySearchEngine = Array.from(byEngine.entries())
    .map(([key, v]) => ({ key, ...v }))
    .sort((a, b) => b.views + b.clicks - (a.views + a.clicks));

  return {
    organicViews,
    organicViewsToday,
    organicVisitors: organicIps.size,
    organicVisitorsToday: organicIpsToday.size,
    humanViews,
    humanViewsToday,
    humanVisitorsToday: humanIpsToday.size,
    bySearchEngine,
  };
}

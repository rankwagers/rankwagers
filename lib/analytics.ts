import type { SiteEvent } from "./events";

function dayKey(ts: string): string {
  return ts.slice(0, 10); // YYYY-MM-DD
}

function topCounts(
  map: Map<string, { views: number; clicks: number }>
): { key: string; views: number; clicks: number }[] {
  return Array.from(map.entries())
    .map(([key, v]) => ({ key, ...v }))
    .sort((a, b) => b.views + b.clicks - (a.views + a.clicks));
}

export type Analytics = ReturnType<typeof buildAnalytics>;

export function buildAnalytics(events: SiteEvent[]) {
  const today = new Date().toISOString().slice(0, 10);

  let totalViews = 0;
  let totalClicks = 0;
  let todayViews = 0;
  let todayClicks = 0;

  const visitors = new Set<string>();
  const todayVisitors = new Set<string>();

  const byCountry = new Map<string, { views: number; clicks: number }>();
  const byLocale = new Map<string, { views: number; clicks: number }>();
  const reviewsByBrand = new Map<string, { views: number; clicks: number }>();
  const clicksByBrand = new Map<string, { views: number; clicks: number }>();
  const byReferrer = new Map<string, { views: number; clicks: number }>();
  const byPage = new Map<string, { views: number; clicks: number }>();

  const dailyMap = new Map<string, { views: number; clicks: number }>();

  function bump(
    map: Map<string, { views: number; clicks: number }>,
    key: string,
    isClick: boolean
  ) {
    if (!key) return;
    const cur = map.get(key) || { views: 0, clicks: 0 };
    if (isClick) cur.clicks++;
    else cur.views++;
    map.set(key, cur);
  }

  for (const e of events) {
    const isClick = e.type === "click";
    const d = dayKey(e.ts);
    const isToday = d === today;

    if (isClick) {
      totalClicks++;
      if (isToday) todayClicks++;
    } else {
      totalViews++;
      if (isToday) todayViews++;
    }

    if (e.ip) {
      visitors.add(e.ip);
      if (isToday) todayVisitors.add(e.ip);
    }

    bump(byCountry, e.country || "??", isClick);
    bump(byLocale, e.locale || "??", isClick);
    bump(byPage, e.page || "other", isClick);
    bump(dailyMap, d, isClick);

    if (e.brand) {
      if (e.page === "review" && !isClick) bump(reviewsByBrand, e.brand, false);
      if (isClick) bump(clicksByBrand, e.brand, true);
    }

    if (e.referer) {
      try {
        const host = new URL(e.referer).host;
        bump(byReferrer, host, isClick);
      } catch {
        bump(byReferrer, "direct", isClick);
      }
    } else if (isClick) {
      bump(byReferrer, "direct", isClick);
    }
  }

  // Son 14 gün serisi
  const daily: { date: string; views: number; clicks: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const dt = new Date();
    dt.setDate(dt.getDate() - i);
    const k = dt.toISOString().slice(0, 10);
    const v = dailyMap.get(k) || { views: 0, clicks: 0 };
    daily.push({ date: k, views: v.views, clicks: v.clicks });
  }

  const ctr = totalViews > 0 ? (totalClicks / totalViews) * 100 : 0;

  return {
    totalViews,
    totalClicks,
    todayViews,
    todayClicks,
    uniqueVisitors: visitors.size,
    todayVisitors: todayVisitors.size,
    ctr,
    daily,
    byCountry: topCounts(byCountry),
    byLocale: topCounts(byLocale),
    reviewsByBrand: topCounts(reviewsByBrand),
    clicksByBrand: topCounts(clicksByBrand),
    byReferrer: topCounts(byReferrer),
    byPage: topCounts(byPage),
  };
}

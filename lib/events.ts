import { promises as fs } from "fs";
import path from "path";
import { isInternalOrTestEvent } from "./analyticsTraffic";

export type EventType = "view" | "click";

export type SiteEvent = {
  ts: string; // ISO timestamp
  type: EventType;
  path: string;
  page: string; // home | crypto | sports | bonuses | review | compare | other
  brand?: string;
  subid?: string;
  locale: string;
  country: string;
  referer: string;
  ua: string;
  ip: string;
  // Traffic attribution (last-touch, falling back to first-touch) captured from
  // the rw_lt / rw_ft cookies — additive & optional so existing readers and
  // historical log lines are unaffected. Answers "how did they find us?" in our
  // own first-party data, independent of GA4/consent. See lib/attribution.
  source?: string;
  medium?: string;
  campaign?: string;
};

const DATA_DIR = path.join(process.cwd(), "data");
const EVENTS_FILE = path.join(DATA_DIR, "events.log");
const LEGACY_CLICKS_FILE = path.join(DATA_DIR, "clicks.log");

export function pageTypeFromPath(p: string): { page: string; brand?: string } {
  // /{locale}/... yapısını çözümle
  const parts = p.split("/").filter(Boolean);
  // parts[0] = locale
  const seg = parts[1] ?? "";
  if (!seg) return { page: "home" };
  if (seg === "best-crypto-betting-sites") return { page: "crypto" };
  if (seg === "best-betting-sites") return { page: "sports" };
  if (seg === "bonuses") return { page: "bonuses" };
  if (seg === "reviews") return { page: "review", brand: parts[2] };
  if (seg === "compare") return { page: "compare", brand: parts[2] };
  return { page: "other" };
}

export async function logEvent(event: SiteEvent): Promise<void> {
  if (isInternalOrTestEvent(event)) return;
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.appendFile(EVENTS_FILE, JSON.stringify(event) + "\n", "utf8");
  } catch {
    // loglama hatası akışı bozmasın
  }
}

type LegacyClickRow = {
  ts: string;
  brand: string;
  subid?: string;
  country?: string;
  locale?: string;
  referer?: string;
  ua?: string;
  ip?: string;
};

function legacyClickToEvent(row: LegacyClickRow): SiteEvent {
  return {
    ts: row.ts,
    type: "click",
    path: `/go/${row.brand}`,
    page: "other",
    brand: row.brand,
    subid: row.subid || "legacy",
    locale: row.locale || "en",
    country: row.country || "",
    referer: row.referer || "",
    ua: row.ua || "",
    ip: row.ip || "",
  };
}

async function readLegacyClicks(): Promise<SiteEvent[]> {
  try {
    const raw = await fs.readFile(LEGACY_CLICKS_FILE, "utf8");
    const events: SiteEvent[] = [];
    for (const line of raw.split("\n")) {
      if (!line.trim()) continue;
      try {
        events.push(legacyClickToEvent(JSON.parse(line) as LegacyClickRow));
      } catch {
        // bozuk satır
      }
    }
    return events;
  } catch {
    return [];
  }
}

export async function readEvents(limit = 50000): Promise<SiteEvent[]> {
  try {
    const raw = await fs.readFile(EVENTS_FILE, "utf8");
    const lines = raw.split("\n").filter((l) => l.trim().length > 0);
    const slice = lines.slice(-limit);
    const events: SiteEvent[] = [];
    for (const line of slice) {
      try {
        events.push(JSON.parse(line) as SiteEvent);
      } catch {
        // bozuk satırı atla
      }
    }
    return events;
  } catch {
    return [];
  }
}

/** Admin paneli: gerçek ziyaretçi trafiği (test, bot, localhost, /admin hariç) */
export async function readAnalyticsEvents(limit = 50000): Promise<SiteEvent[]> {
  const [current, legacy] = await Promise.all([
    readEvents(limit),
    readLegacyClicks(),
  ]);
  const merged = [...legacy, ...current].filter(
    (e) => !isInternalOrTestEvent(e)
  );
  merged.sort((a, b) => a.ts.localeCompare(b.ts));
  if (merged.length > limit) return merged.slice(-limit);
  return merged;
}

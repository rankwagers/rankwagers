import fs from "fs/promises";
import path from "path";

export type SiteFeedState = {
  livePinnedId: string | null;
  livePinnedHourKey: string | null;
  upcomingPinnedId: string | null;
  upcomingBatchKey: string | null;
  /** fh05 won display freeze when Telegram snapshot missing */
  winSnapshots?: Record<string, { homeScore: number; awayScore: number; minute?: string }>;
};

const STATE_PATH = path.join(process.cwd(), "telegram-eng", "data", "site_feed_state.json");

const DEFAULT: SiteFeedState = {
  livePinnedId: null,
  livePinnedHourKey: null,
  upcomingPinnedId: null,
  upcomingBatchKey: null,
};

export async function readSiteFeedState(): Promise<SiteFeedState> {
  try {
    const raw = await fs.readFile(STATE_PATH, "utf-8");
    const data = JSON.parse(raw) as Partial<SiteFeedState>;
    return { ...DEFAULT, ...data };
  } catch {
    return { ...DEFAULT };
  }
}

export async function writeSiteFeedState(patch: Partial<SiteFeedState>): Promise<SiteFeedState> {
  try {
    const current = await readSiteFeedState();
    const next = { ...current, ...patch };
    await fs.mkdir(path.dirname(STATE_PATH), { recursive: true });
    const tmp = STATE_PATH + ".tmp";
    await fs.writeFile(tmp, JSON.stringify(next, null, 2), "utf-8");
    await fs.rename(tmp, STATE_PATH);
    return next;
  } catch {
    return { ...DEFAULT, ...patch };
  }
}

/** 2 saatlik UTC slot (upcoming batch ile uyumlu). */
export function upcomingBatchKeyUtc(date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  const h = date.getUTCHours();
  const slot = Math.floor(h / 2) * 2;
  return `${y}-${m}-${d}T${String(slot).padStart(2, "0")}`;
}

export type UpcomingBatchFile = {
  batchKey: string;
  publishedAt: string;
  featuredId: string | null;
  fixtureIds: number[];
};

const BATCH_PATH = path.join(process.cwd(), "telegram-eng", "data", "upcoming_batch.json");

export async function readUpcomingBatch(): Promise<UpcomingBatchFile | null> {
  try {
    const raw = await fs.readFile(BATCH_PATH, "utf-8");
    return JSON.parse(raw) as UpcomingBatchFile;
  } catch {
    return null;
  }
}

import { unstable_cache } from "next/cache";
import { apiFootballGet } from "./request";

export type WorldCupBarItem = {
  fixtureId: number;
  kind: "live" | "upcoming";
  home: string;
  away: string;
  homeLogo?: string;
  awayLogo?: string;
  homeScore: number;
  awayScore: number;
  minuteLabel?: string;
  kickoffIso: string;
  roundLabel?: string;
};

export type WorldCupBarPayload = {
  leagueName: string;
  season: number;
  items: WorldCupBarItem[];
  nextKickoffIso: string | null;
  updatedAt: string;
};

type LeagueSearchRow = {
  league?: { id?: number; name?: string };
  seasons?: Array<{ year?: number; current?: boolean }>;
};

type FixtureRow = {
  fixture?: {
    id?: number;
    date?: string;
    status?: { short?: string; elapsed?: number | null };
  };
  league?: { id?: number; name?: string; round?: string };
  teams?: {
    home?: { name?: string; logo?: string };
    away?: { name?: string; logo?: string };
  };
  goals?: { home?: number | null; away?: number | null };
};

const LIVE_SHORT = new Set(["1H", "HT", "2H", "ET", "BT", "P", "LIVE", "INT"]);

function todayUtcParts(): { from: string; to: string } {
  const now = new Date();
  const from = now.toISOString().slice(0, 10);
  const end = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const to = end.toISOString().slice(0, 10);
  return { from, to };
}

async function resolveWorldCupLeague(): Promise<{
  id: number;
  season: number;
  name: string;
} | null> {
  const envId = process.env.WORLD_CUP_LEAGUE_ID?.trim();
  const envSeason = process.env.WORLD_CUP_SEASON?.trim();
  if (envId && envSeason) {
    return {
      id: Number(envId),
      season: Number(envSeason),
      name: process.env.WORLD_CUP_LEAGUE_NAME?.trim() || "World Cup",
    };
  }

  const data = await apiFootballGet<{ response?: LeagueSearchRow[] }>("leagues", {
    search: "World Cup",
  });
  const rows = data?.response ?? [];

  let best: { id: number; season: number; name: string; score: number } | null = null;

  for (const row of rows) {
    const id = row.league?.id;
    const name = row.league?.name?.trim() || "";
    if (!id || !name) continue;
    const lower = name.toLowerCase();
    if (lower !== "world cup" && lower !== "fifa world cup") continue;

    const seasons = row.seasons ?? [];
    const current = seasons.find((s) => s.current);
    const season = current?.year ?? seasons[seasons.length - 1]?.year;
    if (!season) continue;

    const score = lower === "world cup" ? 10 : 5;
    if (!best || score > best.score) {
      best = { id, season, name, score };
    }
  }

  if (!best) return null;
  return { id: best.id, season: best.season, name: best.name };
}

function minuteLabel(status?: string, elapsed?: number | null): string | undefined {
  const short = status ?? "";
  if (short === "HT") return "HT";
  if (elapsed != null && LIVE_SHORT.has(short)) return `${elapsed}'`;
  if (short === "FT" || short === "AET" || short === "PEN") return short;
  return undefined;
}

function mapFixture(row: FixtureRow, kind: WorldCupBarItem["kind"]): WorldCupBarItem | null {
  const id = row.fixture?.id;
  const home = row.teams?.home?.name;
  const away = row.teams?.away?.name;
  const kickoffIso = row.fixture?.date;
  if (!id || !home || !away || !kickoffIso) return null;

  const st = row.fixture?.status?.short ?? "";
  const isLive = kind === "live" || LIVE_SHORT.has(st);

  return {
    fixtureId: id,
    kind: isLive ? "live" : "upcoming",
    home,
    away,
    homeLogo: row.teams?.home?.logo,
    awayLogo: row.teams?.away?.logo,
    homeScore: Number(row.goals?.home ?? 0),
    awayScore: Number(row.goals?.away ?? 0),
    minuteLabel: isLive ? minuteLabel(st, row.fixture?.status?.elapsed) : undefined,
    kickoffIso,
    roundLabel: row.league?.round?.trim() || undefined,
  };
}

async function buildWorldCupBarUncached(): Promise<WorldCupBarPayload | null> {
  const meta = await resolveWorldCupLeague();
  if (!meta) return null;

  const liveData = await apiFootballGet<{ response?: FixtureRow[] }>("fixtures", {
    live: "all",
  });
  const liveRows = (liveData?.response ?? []).filter((f) => f.league?.id === meta.id);

  const { from, to } = todayUtcParts();
  const schedData = await apiFootballGet<{ response?: FixtureRow[] }>("fixtures", {
    league: String(meta.id),
    season: String(meta.season),
    from,
    to,
    timezone: "UTC",
  });
  const schedRows = schedData?.response ?? [];

  const now = Date.now();
  const horizon = now + 48 * 60 * 60 * 1000;

  const liveItems: WorldCupBarItem[] = [];
  for (const row of liveRows) {
    const item = mapFixture(row, "live");
    if (item) liveItems.push(item);
  }

  const liveIds = new Set(liveItems.map((i) => i.fixtureId));
  const upcomingItems: WorldCupBarItem[] = [];

  for (const row of schedRows) {
    const st = row.fixture?.status?.short ?? "";
    if (st !== "NS" && st !== "TBD" && st !== "PST") continue;
    const kickMs = new Date(row.fixture?.date ?? 0).getTime();
    if (kickMs < now - 5 * 60_000 || kickMs > horizon) continue;
    const item = mapFixture(row, "upcoming");
    if (!item || liveIds.has(item.fixtureId)) continue;
    upcomingItems.push(item);
  }

  upcomingItems.sort(
    (a, b) => new Date(a.kickoffIso).getTime() - new Date(b.kickoffIso).getTime()
  );

  const items = [...liveItems, ...upcomingItems].slice(0, 10);
  if (items.length === 0) return null;

  const nextUpcoming = upcomingItems[0]?.kickoffIso ?? null;

  return {
    leagueName: meta.name,
    season: meta.season,
    items,
    nextKickoffIso: nextUpcoming,
    updatedAt: new Date().toISOString(),
  };
}

export async function getWorldCupBar(): Promise<WorldCupBarPayload | null> {
  return unstable_cache(buildWorldCupBarUncached, ["world-cup-bar-v1"], {
    revalidate: 45,
  })();
}

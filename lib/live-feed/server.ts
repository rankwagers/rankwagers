import fs from "fs/promises";
import path from "path";
import type { FootyMatchRow } from "@/lib/footystats/types";
import type {
  LiveFeedResponse,
  LiveHistoryItem,
  LiveSignalLocked,
  LiveSignalPublic,
  LiveStrategyId,
  UpcomingMatchLocked,
  UpcomingMatchPublic,
} from "./types";
import { enrichSignalFromLiveRows, findLiveRowForSignal } from "./signalResult";
import { resolveTelegramBotUrl } from "@/lib/telegram";
import {
  readSiteFeedState,
  readUpcomingBatch,
  upcomingBatchKeyUtc,
  writeSiteFeedState,
} from "./siteState";

const UPCOMING_MIN_MINUTES = 30;
const UPCOMING_MAX_MINUTES = 180;

const DATA_DIR = path.join(process.cwd(), "telegram-eng", "data");
const STRATEGIES: LiveStrategyId[] = ["fh05", "o25"];

type RawSignal = {
  fixture_id?: number;
  strategy?: string;
  signaled_at?: string;
  status?: string;
  home?: string;
  away?: string;
  league?: string;
  country?: string;
  home_logo?: string;
  away_logo?: string;
  signal_live_odd?: number;
  signal_live_fh05?: number;
  signal_live_o25?: number;
  home_score?: number;
  away_score?: number;
  minute?: string;
  win_home_score?: number;
  win_away_score?: number;
  win_minute?: string;
};

const UPCOMING_BADGE = "Upcoming";

function strategyPickLabel(strategy: LiveStrategyId): string {
  return strategy === "fh05" ? "1H 0.5+" : "Over 2.5";
}

function buildPredictionLabel(strategies: LiveStrategyId[]): string {
  const order: LiveStrategyId[] = ["fh05", "o25"];
  return order.filter((s) => strategies.includes(s)).map(strategyPickLabel).join(" \u00B7 ");
}

function upcomingMergeKey(home: string, away: string, kickoffIso: string): string {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .replace(/[^a-z0-9]/g, "");
  const t = new Date(kickoffIso).getTime();
  const bucket = Number.isNaN(t) ? "0" : String(Math.floor(t / 300_000));
  return `${norm(home)}|${norm(away)}|${bucket}`;
}

function mergeAccum(existing: UpcomingAccum, incoming: UpcomingAccum): void {
  for (const s of incoming.strategies) {
    if (!existing.strategies.includes(s)) existing.strategies.push(s);
  }
  if (!existing.homeLogo && incoming.homeLogo) existing.homeLogo = incoming.homeLogo;
  if (!existing.awayLogo && incoming.awayLogo) existing.awayLogo = incoming.awayLogo;
  if (incoming.home.length > existing.home.length) existing.home = incoming.home;
  if (incoming.away.length > existing.away.length) existing.away = incoming.away;
  if (incoming.fh05Odd != null) existing.fh05Odd = incoming.fh05Odd;
  if (incoming.o25Odd != null) existing.o25Odd = incoming.o25Odd;
  existing.startsInMinutes = Math.min(existing.startsInMinutes, incoming.startsInMinutes);
}

type UpcomingAccum = {
  fixtureKey: string;
  home: string;
  away: string;
  league: string;
  country?: string;
  kickoffIso: string;
  startsInMinutes: number;
  strategies: LiveStrategyId[];
  fh05Odd?: number;
  o25Odd?: number;
  homeLogo?: string;
  awayLogo?: string;
};

function accumToPublic(a: UpcomingAccum): UpcomingMatchPublic {
  const strategies = [...new Set(a.strategies)];
  const primary = strategies[0] ?? "fh05";
  return {
    id: `up-${a.fixtureKey}`,
    strategy: primary,
    strategies,
    home: a.home,
    away: a.away,
    league: a.league,
    country: a.country,
    kickoffIso: a.kickoffIso,
    startsInMinutes: a.startsInMinutes,
    prematchOdd: a.fh05Odd ?? a.o25Odd,
    marketLabel: UPCOMING_BADGE,
    predictionLabel: buildPredictionLabel(strategies),
    homeLogo: a.homeLogo,
    awayLogo: a.awayLogo,
  };
}

function minutesUntilKickoff(isoOrUnix: string | number): number | null {
  try {
    const ms =
      typeof isoOrUnix === "number" ? isoOrUnix * 1000 : new Date(isoOrUnix).getTime();
    if (Number.isNaN(ms)) return null;
    return (ms - Date.now()) / 60_000;
  } catch {
    return null;
  }
}

type RawWatch = {
  fixture_id?: number;
  home?: string;
  away?: string;
  league?: string;
  country?: string;
  match_time?: string;
  home_logo?: string;
  away_logo?: string;
  fh05?: number;
  o25?: number;
  status?: string;
};

async function readWatchlist(strategy: LiveStrategyId): Promise<RawWatch[]> {
  const file = path.join(DATA_DIR, `watchlist_${strategy}.json`);
  try {
    const raw = await fs.readFile(file, "utf-8");
    const data = JSON.parse(raw) as Record<string, RawWatch>;
    return Object.values(data);
  } catch {
    return [];
  }
}

function addWatchToAccum(map: Map<string, UpcomingAccum>, w: RawWatch, strategy: LiveStrategyId) {
  if (!w.home || !w.away || !w.match_time) return;
  const mins = minutesUntilKickoff(w.match_time);
  if (mins == null || mins < UPCOMING_MIN_MINUTES || mins > UPCOMING_MAX_MINUTES) return;

  const key = upcomingMergeKey(w.home, w.away, w.match_time);
  const patch: UpcomingAccum = {
    fixtureKey: key,
    home: w.home,
    away: w.away,
    league: w.league || "League",
    country: w.country,
    kickoffIso: w.match_time,
    startsInMinutes: Math.round(mins),
    strategies: [strategy],
    fh05Odd: strategy === "fh05" && w.fh05 != null ? Number(w.fh05) : undefined,
    o25Odd: strategy === "o25" && w.o25 != null ? Number(w.o25) : undefined,
    homeLogo: w.home_logo,
    awayLogo: w.away_logo,
  };
  const acc = map.get(key);
  if (!acc) {
    map.set(key, { ...patch, strategies: [...patch.strategies] });
    return;
  }
  mergeAccum(acc, patch);
}

function addFootyListToAccum(
  map: Map<string, UpcomingAccum>,
  rows: FootyMatchRow[],
  strategy: LiveStrategyId
) {
  for (const r of rows) {
    if (r.isLive || r.isFinished || !r.kickoffTime) continue;
    const mins = minutesUntilKickoff(r.kickoffTime);
    if (mins == null || mins < UPCOMING_MIN_MINUTES || mins > UPCOMING_MAX_MINUTES) continue;

    const kickoffIso = new Date(r.kickoffTime * 1000).toISOString();
    const key = upcomingMergeKey(r.homeTeam, r.awayTeam, kickoffIso);
    const patch: UpcomingAccum = {
      fixtureKey: key,
      home: r.homeTeam,
      away: r.awayTeam,
      league: r.competition,
      country: r.country,
      kickoffIso,
      startsInMinutes: Math.round(mins),
      strategies: [strategy],
      homeLogo: r.homeImage,
      awayLogo: r.awayImage,
    };
    const acc = map.get(key);
    if (!acc) {
      map.set(key, { ...patch, strategies: [...patch.strategies] });
      continue;
    }
    mergeAccum(acc, patch);
  }
}

function nextUpcomingRefreshAtIso(): string {
  const now = new Date();
  const slotHour = Math.floor(now.getUTCHours() / 2) * 2;
  const next = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), slotHour + 2, 0, 0, 0)
  );
  if (next.getTime() <= now.getTime()) {
    next.setUTCDate(next.getUTCDate() + 1);
    next.setUTCHours(0, 0, 0, 0);
  }
  return next.toISOString();
}

async function pickUpcomingFeaturedAndLocked(candidates: UpcomingMatchPublic[]): Promise<{
  upcomingFeatured: UpcomingMatchPublic | null;
  upcomingLocked: UpcomingMatchLocked[];
  upcomingBatchKey: string;
  nextUpcomingRefreshAt: string;
}> {
  const upcomingBatchKey = upcomingBatchKeyUtc();
  const nextUpcomingRefreshAt = nextUpcomingRefreshAtIso();

  if (candidates.length === 0) {
    await writeSiteFeedState({ upcomingPinnedId: null, upcomingBatchKey });
    return {
      upcomingFeatured: null,
      upcomingLocked: [],
      upcomingBatchKey,
      nextUpcomingRefreshAt,
    };
  }

  const sorted = [...candidates].sort((a, b) => a.startsInMinutes - b.startsInMinutes);
  const batch = await readUpcomingBatch();
  let state = await readSiteFeedState();

  if (state.upcomingBatchKey !== upcomingBatchKey) {
    state = await writeSiteFeedState({ upcomingBatchKey, upcomingPinnedId: null });
  }

  let upcomingFeatured: UpcomingMatchPublic | null = null;

  if (batch?.batchKey === upcomingBatchKey && batch.featuredId) {
    upcomingFeatured = sorted.find((c) => c.id === batch.featuredId) ?? null;
  }

  if (!upcomingFeatured && state.upcomingPinnedId) {
    const pinned = sorted.find((c) => c.id === state.upcomingPinnedId);
    if (pinned && pinned.startsInMinutes >= UPCOMING_MIN_MINUTES) {
      upcomingFeatured = pinned;
    }
  }

  if (!upcomingFeatured) {
    upcomingFeatured = sorted[0];
    await writeSiteFeedState({
      upcomingPinnedId: upcomingFeatured.id,
      upcomingBatchKey,
    });
  }

  const upcomingLocked: UpcomingMatchLocked[] = sorted
    .filter((u) => u.id !== upcomingFeatured!.id)
    .slice(0, 12)
    .map((u) => ({
      id: u.id,
      home: u.home,
      away: u.away,
      league: u.league,
      homeLogo: u.homeLogo,
      awayLogo: u.awayLogo,
      startsInMinutes: u.startsInMinutes,
      predictionLabel: u.predictionLabel,
    }));

  return { upcomingFeatured, upcomingLocked, upcomingBatchKey, nextUpcomingRefreshAt };
}

async function buildUpcoming(
  listSources: { fh: FootyMatchRow[]; over25: FootyMatchRow[] } | undefined,
  dedupeRows: FootyMatchRow[]
): Promise<{
  upcomingFeatured: UpcomingMatchPublic | null;
  upcomingLocked: UpcomingMatchLocked[];
  upcomingBatchKey: string;
  nextUpcomingRefreshAt: string;
}> {
  const map = new Map<string, UpcomingAccum>();

  const lists = await Promise.all(STRATEGIES.map((s) => readWatchlist(s)));
  for (let i = 0; i < STRATEGIES.length; i++) {
    for (const w of lists[i]) {
      addWatchToAccum(map, w, STRATEGIES[i]);
    }
  }

  if (listSources) {
    addFootyListToAccum(map, listSources.fh, "fh05");
    addFootyListToAccum(map, listSources.over25, "o25");
  } else {
    addFootyListToAccum(map, dedupeRows, "fh05");
  }

  const candidates = [...map.values()].map(accumToPublic);
  return await pickUpcomingFeaturedAndLocked(candidates);
}

function hourKeyUtc(date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}T${String(date.getUTCHours()).padStart(2, "0")}`;
}

function marketLabel(strategy: LiveStrategyId): string {
  return strategy === "fh05" ? "1st half goal (live)" : "Over 2.5 goals (live)";
}

function strategyTeaser(strategy: LiveStrategyId): string {
  return strategy === "fh05" ? "New 1H goal signal" : "New Over 2.5 signal";
}

async function readStrategySignals(strategy: LiveStrategyId): Promise<RawSignal[]> {
  const file = path.join(DATA_DIR, `signals_${strategy}.json`);
  try {
    const raw = await fs.readFile(file, "utf-8");
    const data = JSON.parse(raw) as Record<string, RawSignal>;
    return Object.entries(data).map(([key, val]) => ({
      ...val,
      fixture_id: val.fixture_id ?? Number(key),
      strategy,
    }));
  } catch {
    return [];
  }
}

function toPublic(signal: RawSignal, strategy: LiveStrategyId): LiveSignalPublic | null {
  if (!signal.home || !signal.away || !signal.signaled_at) return null;
  const liveOdd =
    signal.signal_live_odd ??
    signal.signal_live_fh05 ??
    signal.signal_live_o25 ??
    undefined;
  return {
    id: `${strategy}-${signal.fixture_id}`,
    strategy,
    home: signal.home,
    away: signal.away,
    league: signal.league || "Live",
    country: signal.country,
    homeScore: Number(signal.home_score ?? 0),
    awayScore: Number(signal.away_score ?? 0),
    minute: signal.minute,
    winHomeScore:
      signal.win_home_score != null ? Number(signal.win_home_score) : undefined,
    winAwayScore:
      signal.win_away_score != null ? Number(signal.win_away_score) : undefined,
    winMinute: signal.win_minute,
    liveOdd: liveOdd != null ? Number(liveOdd) : undefined,
    marketLabel: marketLabel(strategy),
    status: signal.status || "pending_result",
    resultState: "pending",
    signaledAt: signal.signaled_at,
    homeLogo: signal.home_logo,
    awayLogo: signal.away_logo,
    featured: true,
  };
}

function footyFallback(rows: FootyMatchRow[]): LiveSignalPublic[] {
  const live = rows.filter((r) => r.isLive);
  live.sort((a, b) => b.highlightPct - a.highlightPct);
  return live.slice(0, 8).map((r, i) => {
    const strategy: LiveStrategyId = i % 2 === 0 ? "fh05" : "o25";
    return {
      id: `footy-${r.matchId}-${strategy}`,
      strategy,
      home: r.homeTeam,
      away: r.awayTeam,
      league: r.competition,
      country: r.country,
      homeScore: r.homeScore,
      awayScore: r.awayScore,
      minute: r.minute > 0 ? `${r.minute}'` : undefined,
      marketLabel: marketLabel(strategy),
      status: "live",
      resultState: "live",
      signaledAt: new Date().toISOString(),
      homeLogo: r.homeImage,
      awayLogo: r.awayImage,
      featured: true,
    };
  });
}

function isTerminalState(state: LiveSignalPublic["resultState"], row?: FootyMatchRow): boolean {
  if (state === "won" || state === "lost") return true;
  if (row?.isFinished) return true;
  return false;
}

function mergeWinSnapshotFromState(
  signal: LiveSignalPublic,
  state: Awaited<ReturnType<typeof readSiteFeedState>>
): LiveSignalPublic {
  if (signal.winHomeScore != null) return signal;
  const snap = state.winSnapshots?.[signal.id];
  if (!snap) return signal;
  return {
    ...signal,
    winHomeScore: snap.homeScore,
    winAwayScore: snap.awayScore,
    winMinute: snap.minute ?? signal.winMinute,
  };
}

async function persistFh05WinSnapshots(
  enriched: LiveSignalPublic[],
  before: LiveSignalPublic[],
  state: Awaited<ReturnType<typeof readSiteFeedState>>
): Promise<void> {
  const winSnapshots = { ...(state.winSnapshots ?? {}) };
  let changed = false;
  for (const e of enriched) {
    if (e.resultState !== "won" || e.strategy !== "fh05") continue;
    const prior = before.find((x) => x.id === e.id);
    if (prior?.winHomeScore != null || winSnapshots[e.id]) continue;
    winSnapshots[e.id] = {
      homeScore: e.homeScore,
      awayScore: e.awayScore,
      minute: e.minute,
    };
    changed = true;
  }
  if (changed) await writeSiteFeedState({ winSnapshots });
}

function buildHistory(
  candidates: LiveSignalPublic[],
  liveRows: FootyMatchRow[]
): LiveHistoryItem[] {
  const out: LiveHistoryItem[] = [];
  for (const c of candidates) {
    const enriched = enrichSignalFromLiveRows(c, liveRows);
    const state = enriched.resultState;
    if (
      state !== "won" &&
      state !== "lost" &&
      state !== "pending" &&
      state !== "live" &&
      state !== "win_pending"
    ) {
      continue;
    }
    out.push({
      id: enriched.id,
      strategy: enriched.strategy,
      home: enriched.home,
      away: enriched.away,
      league: enriched.league,
      marketLabel: enriched.marketLabel,
      resultState: state,
      homeScore: enriched.homeScore,
      awayScore: enriched.awayScore,
      minute: enriched.minute,
      signaledAt: enriched.signaledAt,
      homeLogo: enriched.homeLogo,
      awayLogo: enriched.awayLogo,
    });
  }
  out.sort((a, b) => new Date(b.signaledAt).getTime() - new Date(a.signaledAt).getTime());
  return out.slice(0, 120);
}

async function pickFeaturedAndLocked(
  candidates: LiveSignalPublic[],
  hour: string,
  liveRows: FootyMatchRow[]
): Promise<{ featured: LiveSignalPublic | null; locked: LiveSignalLocked[] }> {
  if (candidates.length === 0) {
    await writeSiteFeedState({ livePinnedId: null, livePinnedHourKey: null });
    return { featured: null, locked: [] };
  }

  const state = await readSiteFeedState();
  const withSnapshots = candidates.map((c) => mergeWinSnapshotFromState(c, state));
  const enrichedAll = withSnapshots.map((c) => enrichSignalFromLiveRows(c, liveRows));
  await persistFh05WinSnapshots(enrichedAll, withSnapshots, state);

  let featured: LiveSignalPublic | null = null;

  if (state.livePinnedId) {
    const pinned = enrichedAll.find((s) => s.id === state.livePinnedId);
    if (pinned && !isTerminalState(pinned.resultState, findLiveRowForPin(pinned, liveRows))) {
      featured = { ...pinned, featured: true as const };
    }
  }

  if (!featured) {
    const sorted = [...enrichedAll].sort(
      (a, b) => new Date(b.signaledAt).getTime() - new Date(a.signaledAt).getTime()
    );
    const inHour = sorted.filter((s) => hourKeyUtc(new Date(s.signaledAt)) === hour);
    const pool = inHour.length > 0 ? inHour : sorted;
    const pick = pool[0];
    featured = { ...pick, featured: true as const };
    await writeSiteFeedState({
      livePinnedId: pick.id,
      livePinnedHourKey: hour,
    });
  } else if (state.livePinnedHourKey !== hour) {
    await writeSiteFeedState({ livePinnedHourKey: hour });
  }

  const terminal = isTerminalState(
    featured.resultState,
    findLiveRowForPin(featured, liveRows)
  );
  if (terminal) {
    await writeSiteFeedState({ livePinnedId: null, livePinnedHourKey: null });
  }

  const rest = enrichedAll.filter((s) => s.id !== featured!.id);
  const locked: LiveSignalLocked[] = rest.slice(0, 12).map((s) => ({
    id: s.id,
    strategy: s.strategy,
    signaledAt: s.signaledAt,
    teaser: strategyTeaser(s.strategy),
    isNew: hourKeyUtc(new Date(s.signaledAt)) === hour,
    cta: "telegram" as const,
  }));

  return { featured, locked };
}

function findLiveRowForPin(
  signal: Pick<LiveSignalPublic, "home" | "away">,
  liveRows: FootyMatchRow[]
): FootyMatchRow | undefined {
  return findLiveRowForSignal(signal, liveRows);
}

export async function buildLiveFeed(
  liveRows: FootyMatchRow[],
  listSources?: { fh: FootyMatchRow[]; over25: FootyMatchRow[] }
): Promise<LiveFeedResponse> {
  const hour = hourKeyUtc();
  const telegramBotUrl = resolveTelegramBotUrl(
    process.env.NEXT_PUBLIC_TELEGRAM_BOT_URL?.trim() ||
      process.env.NEXT_PUBLIC_TELEGRAM_URL?.trim() ||
      null
  );

  const rawLists = await Promise.all(STRATEGIES.map((s) => readStrategySignals(s)));
  const fromTelegram: LiveSignalPublic[] = [];
  const historyPool: LiveSignalPublic[] = [];

  for (let i = 0; i < STRATEGIES.length; i++) {
    const strategy = STRATEGIES[i];
    for (const raw of rawLists[i]) {
      const pub = toPublic(raw, strategy);
      if (!pub) continue;
      if (raw.status === "lost") {
        historyPool.push(pub);
        continue;
      }
      fromTelegram.push(pub);
      historyPool.push(pub);
    }
  }

  let source: LiveFeedResponse["source"] = "empty";
  let candidates = fromTelegram;

  if (fromTelegram.length > 0) {
    source = "telegram-eng";
  } else {
    const fallback = footyFallback(liveRows);
    if (fallback.length > 0) {
      candidates = fallback;
      source = "footystats-fallback";
    }
  }

  const { featured, locked } = await pickFeaturedAndLocked(candidates, hour, liveRows);
  const feedState = await readSiteFeedState();
  const enrichedFeatured = featured
    ? enrichSignalFromLiveRows(mergeWinSnapshotFromState(featured, feedState), liveRows)
    : null;
  const history = buildHistory(
    historyPool.map((c) => mergeWinSnapshotFromState(c, feedState)),
    liveRows
  );
  const {
    upcomingFeatured,
    upcomingLocked,
    upcomingBatchKey,
    nextUpcomingRefreshAt,
  } = await buildUpcoming(listSources, liveRows);

  return {
    hourKey: hour,
    featured: enrichedFeatured,
    locked,
    history,
    upcomingFeatured,
    upcomingLocked,
    upcomingBatchKey,
    nextUpcomingRefreshAt,
    telegramBotUrl,
    source,
  };
}

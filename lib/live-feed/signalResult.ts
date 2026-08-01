import { htTotal, resolveHalfScores } from "@/lib/footystats/halfScores";
import type { FootyMatchRow } from "@/lib/footystats/types";
import type { LiveSignalPublic, LiveStrategyId } from "./types";

export type SignalResultState = "live" | "pending" | "win_pending" | "won" | "lost";

function normTeam(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]/g, "");
}

export function findLiveRowForSignal(
  signal: Pick<LiveSignalPublic, "home" | "away">,
  rows: FootyMatchRow[]
): FootyMatchRow | undefined {
  const h = normTeam(signal.home);
  const a = normTeam(signal.away);
  if (!h || !a) return undefined;

  return rows.find((r) => {
    const rh = normTeam(r.homeTeam);
    const ra = normTeam(r.awayTeam);
    return (rh === h && ra === a) || (rh.includes(h) && ra.includes(a)) || (h.includes(rh) && a.includes(ra));
  });
}

function statusFromTelegram(raw: string): SignalResultState | null {
  const s = raw.toLowerCase();
  if (s === "won") return "won";
  if (s === "win_scheduled") return "win_pending";
  if (s === "lost") return "lost";
  if (s === "pending_result" || s === "live") return null;
  return null;
}

function computeWinFromRow(strategy: LiveStrategyId, row: FootyMatchRow): SignalResultState | null {
  const total = row.homeScore + row.awayScore;
  const st = (row.status || "").toLowerCase();

  if (strategy === "o25") {
    if (total >= 3) return "won";
    if (row.isFinished && total < 3) return "lost";
    return null;
  }

  // fh05 — 1st half 0.5+
  const ht = htTotal(row);
  if (ht != null && ht >= 1) return "won";

  const halves = resolveHalfScores(row);
  if (halves.htKnown && halves.htHome + halves.htAway >= 1) return "won";

  if (st === "1h" && total > 0) return "win_pending";

  if (row.isFinished || st === "ht" || st === "2h" || st === "ft") {
    if (halves.htKnown && halves.htHome + halves.htAway === 0) return "lost";
    if (ht != null && ht === 0) return "lost";
  }

  return null;
}

export function resolveSignalResultState(
  signal: LiveSignalPublic,
  row?: FootyMatchRow
): SignalResultState {
  const fromTelegram = statusFromTelegram(signal.status);
  if (fromTelegram === "won" || fromTelegram === "lost") return fromTelegram;
  if (fromTelegram === "win_pending") return "win_pending";

  if (row) {
    const fromRow = computeWinFromRow(signal.strategy, row);
    if (fromRow === "won") return "won";
    if (fromRow === "lost") return "lost";
    if (fromRow === "win_pending") return "win_pending";
    if (row.isLive) return "live";
    if (row.isFinished) return "pending";
  }

  if (signal.status === "live") return "live";
  return "pending";
}

export function enrichSignalFromLiveRows(
  signal: LiveSignalPublic,
  liveRows: FootyMatchRow[]
): LiveSignalPublic {
  const row = findLiveRowForSignal(signal, liveRows);
  const resultState = resolveSignalResultState(signal, row);

  let homeScore = signal.homeScore;
  let awayScore = signal.awayScore;
  let minute = signal.minute;
  let homeLogo = signal.homeLogo;
  let awayLogo = signal.awayLogo;

  const winHome = signal.winHomeScore;
  const winAway = signal.winAwayScore;
  const winMinute = signal.winMinute;
  const hasWinSnapshot = winHome != null && winAway != null;

  if (row) {
    if (!homeLogo && row.homeImage) homeLogo = row.homeImage;
    if (!awayLogo && row.awayImage) awayLogo = row.awayImage;
  }

  if (resultState === "won") {
    if (signal.strategy === "fh05") {
      if (hasWinSnapshot) {
        homeScore = winHome!;
        awayScore = winAway!;
        minute = winMinute ?? minute;
      } else if (row) {
        const halves = resolveHalfScores(row);
        if (halves.htKnown) {
          homeScore = halves.htHome;
          awayScore = halves.htAway;
          minute = winMinute ?? (row.isFinished ? "FT" : "HT");
        }
      }
    } else if (signal.strategy === "o25") {
      if (row?.isFinished) {
        homeScore = row.homeScore;
        awayScore = row.awayScore;
        minute = "FT";
      } else {
        minute = undefined;
        if (hasWinSnapshot) {
          homeScore = winHome!;
          awayScore = winAway!;
        }
      }
    }
  } else if (resultState !== "lost" && row) {
    homeScore = row.homeScore;
    awayScore = row.awayScore;
    if (row.minute > 0) minute = `${row.minute}'`;
    if (row.isFinished) minute = "FT";
  }

  return {
    ...signal,
    homeScore,
    awayScore,
    minute,
    homeLogo,
    awayLogo,
    resultState,
  };
}

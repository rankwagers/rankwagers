import type { FootyMatchRow } from "./types";

export type HalfScoreLine = {
  htHome: number;
  htAway: number;
  shHome: number;
  shAway: number;
  htKnown: boolean;
  shKnown: boolean;
};

function statusLower(row: FootyMatchRow): string {
  return (row.status || "").toLowerCase();
}

/** İY / 2Y skor satırı — API ve canlı duruma göre */
export function resolveHalfScores(row: FootyMatchRow): HalfScoreLine {
  const st = statusLower(row);
  const totalH = row.homeScore;
  const totalA = row.awayScore;

  let htHome: number | null =
    row.htHome != null && row.htAway != null ? row.htHome : null;
  let htAway: number | null =
    row.htHome != null && row.htAway != null ? row.htAway : null;

  if (htHome == null && row.htGoalCount != null && row.isFinished) {
    // Toplam İY gol var ama dağılım yok — sadece toplam kullanılır
    htHome = null;
    htAway = null;
  }

  // İlk yarı devam ediyorsa anlık skor = İY skoru
  if (htHome == null && (st === "1h" || (row.isLive && row.minute > 0 && row.minute <= 45))) {
    htHome = totalH;
    htAway = totalA;
  }

  // Devre / 2. yarı / bitti → API İY skoru varsa kullan
  if (
    htHome == null &&
    row.htHome != null &&
    row.htAway != null &&
    ["ht", "2h", "complete", "finished", "ft"].includes(st)
  ) {
    htHome = row.htHome;
    htAway = row.htAway;
  }

  const htKnown = htHome != null && htAway != null;
  const htH = htKnown ? htHome! : 0;
  const htA = htKnown ? htAway! : 0;

  let shKnown = false;
  let shHome = 0;
  let shAway = 0;

  if (htKnown && (row.isFinished || st === "2h" || st === "ft" || st === "complete")) {
    shHome = Math.max(0, totalH - htH);
    shAway = Math.max(0, totalA - htA);
    shKnown = row.isFinished || st === "2h" || st === "ft" || st === "complete";
  }

  return {
    htHome: htH,
    htAway: htA,
    shHome,
    shAway,
    htKnown,
    shKnown,
  };
}

export function htTotal(row: FootyMatchRow): number | null {
  const h = resolveHalfScores(row);
  if (!h.htKnown) return null;
  return h.htHome + h.htAway;
}

export function shTotal(row: FootyMatchRow): number | null {
  const h = resolveHalfScores(row);
  if (!h.shKnown) return null;
  return h.shHome + h.shAway;
}

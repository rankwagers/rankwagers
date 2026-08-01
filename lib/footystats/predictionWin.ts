import { htTotal, shTotal, resolveHalfScores } from "./halfScores";
import type { FootyMatchRow, MatchListKind } from "./types";

function isHtPeriodEnded(row: FootyMatchRow): boolean {
  const st = (row.status || "").toLowerCase();
  if (row.isFinished) return true;
  return ["ht", "2h", "ft", "complete", "finished"].includes(st);
}

/** Bitmiş veya ilgili periyot netleşince tahmin tuttu mu */
export function isPredictionWin(row: FootyMatchRow, tab: MatchListKind): boolean {
  const total = row.homeScore + row.awayScore;

  switch (tab) {
    case "over15":
      return row.isFinished && total >= 2;
    case "over25":
      return row.isFinished && total >= 3;
    case "fh": {
      const ht = htTotal(row);
      if (ht != null && ht >= 1) return true;
      return false;
    }
    case "sh": {
      if (!row.isFinished) return false;
      const sh = shTotal(row);
      return sh != null && sh >= 1;
    }
    default:
      return false;
  }
}

export function statusScoresForTab(
  row: FootyMatchRow,
  tab: MatchListKind
): { main: string; sub?: string } {
  const halves = resolveHalfScores(row);
  const htLine = halves.htKnown
    ? `(${halves.htHome}-${halves.htAway} HT)`
    : undefined;

  if (row.isFinished) {
    return {
      main: `${row.homeScore}-${row.awayScore} FT`,
      sub: htLine,
    };
  }

  if (tab === "fh" && isHtPeriodEnded(row) && halves.htKnown) {
    return {
      main: `${halves.htHome}-${halves.htAway} HT`,
      sub: undefined,
    };
  }

  if (tab === "sh" && halves.shKnown && !row.isFinished) {
    return {
      main: `${halves.shHome}-${halves.shAway} 2H`,
      sub: htLine,
    };
  }

  return { main: "", sub: undefined };
}

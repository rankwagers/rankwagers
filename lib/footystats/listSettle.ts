import { isMatchPostponed } from "./matchStatus";
import { isPredictionWin } from "./predictionWin";
import type { FootyMatchRow, MatchListKind } from "./types";

export type ListSettleState = "won" | "lost" | "pending" | "postponed";

export function listSettleState(row: FootyMatchRow, tab: MatchListKind): ListSettleState {
  if (row.listResult === "postponed" || isMatchPostponed(row.status)) {
    return "postponed";
  }
  if (row.listResult === "won") return "won";
  if (row.listResult === "lost") return "lost";
  if (!row.isFinished) return "pending";
  return isPredictionWin(row, tab) ? "won" : "lost";
}

export function countSettledRows(
  rows: FootyMatchRow[],
  tab: MatchListKind
): { won: number; lost: number; pending: number; postponed: number } {
  let won = 0;
  let lost = 0;
  let pending = 0;
  let postponed = 0;
  for (const r of rows) {
    const s = listSettleState(r, tab);
    if (s === "won") won++;
    else if (s === "lost") lost++;
    else if (s === "postponed") postponed++;
    else pending++;
  }
  return { won, lost, pending, postponed };
}

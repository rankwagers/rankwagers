import type { ArchivePredictionRecord } from "@/lib/archive/types";

export type SettlementTotals = {
  won: number;
  lost: number;
  voided: number;
  pending: number;
  settled: number;
  decided: number;
};

export function aggregateSettlements(
  records: readonly ArchivePredictionRecord[],
): SettlementTotals {
  let won = 0;
  let lost = 0;
  let voided = 0;
  let pending = 0;
  for (const r of records) {
    if (r.status === "won") won += 1;
    else if (r.status === "lost") lost += 1;
    else if (r.status === "void") voided += 1;
    else pending += 1;
  }
  return {
    won,
    lost,
    voided,
    pending,
    settled: won + lost + voided,
    decided: won + lost,
  };
}

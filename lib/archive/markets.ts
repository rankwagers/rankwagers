import type { MatchListKind } from "@/lib/footystats/types";
import { marketForListKind } from "@/lib/research/fixturePresentation";
import type { ArchiveMarketKey } from "./types";

export const ARCHIVE_MARKETS: ArchiveMarketKey[] = [
  "fh",
  "over15",
  "over25",
  "sh",
];

export function archiveMarketLabel(key: ArchiveMarketKey): string {
  return marketForListKind(key).label;
}

export function archiveSelectionLabel(key: ArchiveMarketKey): string {
  switch (key) {
    case "over15":
      return "Over 1.5";
    case "over25":
      return "Over 2.5";
    case "fh":
      return "FH Over 0.5";
    case "sh":
      return "SH Over 0.5";
  }
}

export function isArchiveMarketKey(value: string): value is ArchiveMarketKey {
  return (ARCHIVE_MARKETS as string[]).includes(value);
}

export function confidenceForRow(
  row: { over15Pct: number; over25Pct: number; fhOver05Pct: number; shOver05Pct: number },
  market: MatchListKind
): number {
  const raw =
    market === "over15"
      ? row.over15Pct
      : market === "over25"
        ? row.over25Pct
        : market === "fh"
          ? row.fhOver05Pct
          : row.shOver05Pct;
  return Math.round(raw);
}

export function settlementReasonFor(
  status: "won" | "lost" | "void" | "pending",
  marketLabel: string
): string {
  switch (status) {
    case "won":
      return `Settled won for ${marketLabel} from final (or period) scores in the daily archive.`;
    case "lost":
      return `Settled lost for ${marketLabel} from final (or period) scores in the daily archive.`;
    case "void":
      return "Voided — match postponed or disrupted in the archive record.";
    case "pending":
      return "Pending — match had not finished when this archive snapshot was saved.";
  }
}

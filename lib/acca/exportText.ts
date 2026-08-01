import { assessAccaRisk } from "./risk";
import { stakeModel } from "./odds";
import type { AccaSlip } from "./types";

/** Plain-text / Telegram-friendly export. Never claims a bet was placed. */
export function formatAccaText(slip: AccaSlip, options?: { telegram?: boolean }): string {
  const stake = stakeModel(slip.selections, slip.stake);
  const risk = assessAccaRisk(slip.selections);
  const lines: string[] = [];

  lines.push(slip.name ? `RankWagers Acca — ${slip.name}` : "RankWagers Acca");
  lines.push(`Selections: ${slip.selections.length}`);
  if (stake.combinedOdds != null) {
    lines.push(
      `Combined odds: ${stake.combinedOdds.toFixed(2)}${stake.oddsComplete ? "" : " (incomplete)"}`
    );
  } else {
    lines.push("Combined odds: unavailable");
  }
  lines.push(`Stake (units): ${stake.stake}`);
  if (stake.potentialReturn != null) {
    lines.push(`Potential return: ${stake.potentialReturn.toFixed(2)} units`);
    lines.push(`Potential profit: ${stake.potentialProfit?.toFixed(2)} units`);
  }
  lines.push(`Risk class: ${risk.label}`);
  lines.push("");

  slip.selections.forEach((s, i) => {
    const odds = s.odds != null ? s.odds.toFixed(2) : "n/a";
    const conf = s.confidence != null ? `${s.confidence}%` : "n/a";
    lines.push(
      `${i + 1}. ${s.homeTeam} vs ${s.awayTeam} — ${s.marketLabel} (${s.selectionLabel}) @ ${odds} · model ${conf}`
    );
    if (s.competition) lines.push(`   ${s.competition}`);
  });

  lines.push("");
  lines.push("Research slip only — not a placed bet. Odds may change. 18+.");
  if (options?.telegram) {
    lines.push("Open RankWagers Acca Studio to review evidence and operators.");
  }
  return lines.join("\n");
}

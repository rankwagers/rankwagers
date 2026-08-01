/**
 * Server-safe, UI-independent prediction settlement.
 * Deterministic from score inputs — never invents missing results.
 */

import { resolveHalfScores } from "@/lib/footystats/halfScores";
import type { FootyMatchRow } from "@/lib/footystats/types";
import { isMatchPostponed } from "@/lib/footystats/matchStatus";
import type {
  PredictionSettlementStatus,
  SettledMarketKey,
} from "./types";
import { resolveMatchLifecycle } from "./status";

export type SettlementInput = {
  marketKey: SettledMarketKey;
  /** For 1X2 / DC / DNB */
  selection?: "home" | "draw" | "away" | "1X" | "12" | "X2" | "over" | "yes";
  homeScore: number | null;
  awayScore: number | null;
  htHome: number | null;
  htAway: number | null;
  status: string | null;
  isFinished: boolean;
  kickoffUnix?: number | null;
};

export type SettlementResult = {
  status: PredictionSettlementStatus;
  reason: string;
  /** Unit P/L at decimal odds 1u stake when settled won/lost; null otherwise */
  unitProfit: number | null;
};

/** Markets deferred until provider contracts are safe. */
export const DEFERRED_SETTLEMENT_MARKETS = [
  "corners",
  "cards",
  "asian_handicap",
  "correct_score",
  "player_props",
] as const;

export function settlePrediction(
  input: SettlementInput,
  originalOdds: number | null = null
): SettlementResult {
  const lifecycle = resolveMatchLifecycle({
    status: input.status,
    kickoffUnix: input.kickoffUnix,
  });

  if (
    lifecycle === "cancelled" ||
    lifecycle === "abandoned" ||
    (input.status && isMatchPostponed(input.status) && lifecycle !== "postponed")
  ) {
    if (lifecycle === "cancelled" || lifecycle === "abandoned") {
      return {
        status: "cancelled",
        reason: `Match ${lifecycle.replace("_", " ")}; prediction cancelled.`,
        unitProfit: 0,
      };
    }
  }

  if (lifecycle === "postponed") {
    return {
      status: "void",
      reason: "Match postponed; prediction void pending reschedule policy.",
      unitProfit: 0,
    };
  }

  if (lifecycle === "suspended") {
    return {
      status: "pending",
      reason: "Match suspended; settlement waits for a final result.",
      unitProfit: null,
    };
  }

  if (!input.isFinished && lifecycle !== "finished") {
    // FH can settle at HT when HT goals known
    if (input.marketKey === "fh") {
      const htTotal =
        input.htHome != null && input.htAway != null
          ? input.htHome + input.htAway
          : null;
      if (htTotal != null && (lifecycle === "half_time" || lifecycle === "live")) {
        if (htTotal >= 1) {
          return won("First-half over 0.5 hit (HT goals ≥ 1).", originalOdds);
        }
        // Only lose at HT when the period is complete; live 0–0 stays pending.
        if (lifecycle === "half_time") {
          return lost("First-half over 0.5 missed (0 goals at HT).", originalOdds);
        }
      }
    }
    return {
      status: "pending",
      reason: "Awaiting final (or period) result for settlement.",
      unitProfit: null,
    };
  }

  if (input.homeScore == null || input.awayScore == null) {
    return {
      status: "void",
      reason: "Final score unavailable from provider; cannot settle safely.",
      unitProfit: 0,
    };
  }

  const home = input.homeScore;
  const away = input.awayScore;
  const total = home + away;

  switch (input.marketKey) {
    case "over15":
      return total >= 2
        ? won("Over 1.5: total goals ≥ 2.", originalOdds)
        : lost("Over 1.5: total goals < 2.", originalOdds);
    case "over25":
      return total >= 3
        ? won("Over 2.5: total goals ≥ 3.", originalOdds)
        : lost("Over 2.5: total goals < 3.", originalOdds);
    case "btts":
      return home > 0 && away > 0
        ? won("BTTS: both teams scored.", originalOdds)
        : lost("BTTS: at least one team failed to score.", originalOdds);
    case "fh": {
      if (input.htHome == null || input.htAway == null) {
        return {
          status: "void",
          reason: "Half-time score unavailable; cannot settle FH market.",
          unitProfit: 0,
        };
      }
      const ht = input.htHome + input.htAway;
      return ht >= 1
        ? won("First-half over 0.5 hit.", originalOdds)
        : lost("First-half over 0.5 missed.", originalOdds);
    }
    case "sh": {
      if (input.htHome == null || input.htAway == null) {
        return {
          status: "void",
          reason: "Half-time score unavailable; cannot isolate second-half goals.",
          unitProfit: 0,
        };
      }
      const sh = Math.max(0, home - input.htHome) + Math.max(0, away - input.htAway);
      return sh >= 1
        ? won("Second-half over 0.5 hit.", originalOdds)
        : lost("Second-half over 0.5 missed.", originalOdds);
    }
    case "match_winner": {
      const sel = input.selection;
      if (sel !== "home" && sel !== "draw" && sel !== "away") {
        return {
          status: "void",
          reason: "Match-winner selection missing.",
          unitProfit: 0,
        };
      }
      const result = home > away ? "home" : home < away ? "away" : "draw";
      return result === sel
        ? won(`Match winner (${sel}) correct.`, originalOdds)
        : lost(`Match winner (${sel}) incorrect; result ${result}.`, originalOdds);
    }
    case "double_chance": {
      const sel = input.selection;
      if (sel !== "1X" && sel !== "12" && sel !== "X2") {
        return {
          status: "void",
          reason: "Double-chance selection missing.",
          unitProfit: 0,
        };
      }
      const result = home > away ? "home" : home < away ? "away" : "draw";
      const ok =
        (sel === "1X" && (result === "home" || result === "draw")) ||
        (sel === "12" && (result === "home" || result === "away")) ||
        (sel === "X2" && (result === "draw" || result === "away"));
      return ok
        ? won(`Double chance ${sel} hit.`, originalOdds)
        : lost(`Double chance ${sel} missed.`, originalOdds);
    }
    case "draw_no_bet": {
      const sel = input.selection;
      if (sel !== "home" && sel !== "away") {
        return {
          status: "void",
          reason: "Draw-no-bet selection missing.",
          unitProfit: 0,
        };
      }
      if (home === away) {
        return {
          status: "push",
          reason: "Draw no bet: match drawn; stake returned.",
          unitProfit: 0,
        };
      }
      const result = home > away ? "home" : "away";
      return result === sel
        ? won(`Draw no bet (${sel}) won.`, originalOdds)
        : lost(`Draw no bet (${sel}) lost.`, originalOdds);
    }
    default:
      return {
        status: "void",
        reason: "Unsupported market for settlement.",
        unitProfit: 0,
      };
  }
}

export function settlementInputFromRow(
  row: FootyMatchRow,
  marketKey: SettledMarketKey,
  selection?: SettlementInput["selection"]
): SettlementInput {
  const halves = resolveHalfScores(row);
  return {
    marketKey,
    selection,
    homeScore: row.isFinished || row.isLive ? row.homeScore : null,
    awayScore: row.isFinished || row.isLive ? row.awayScore : null,
    htHome: halves.htKnown ? halves.htHome : row.htHome ?? null,
    htAway: halves.htKnown ? halves.htAway : row.htAway ?? null,
    status: row.status,
    isFinished: row.isFinished,
    kickoffUnix: row.kickoffTime,
  };
}

function won(reason: string, odds: number | null): SettlementResult {
  return {
    status: "won",
    reason,
    unitProfit: odds != null && odds > 1 ? Number((odds - 1).toFixed(3)) : null,
  };
}

function lost(reason: string, _odds: number | null): SettlementResult {
  // Signature mirrors won(reason, odds) for symmetry at all nine call sites; a loss is always -1
  // unit regardless of price, so the odds are deliberately unused.
  void _odds;
  return {
    status: "lost",
    reason,
    unitProfit: -1,
  };
}

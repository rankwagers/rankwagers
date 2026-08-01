import { describeConflict, findAddConflict } from "./conflicts";
import { buildSlipId, newClientSlipId, selectionId } from "./ids";
import { getAccaMarket, isAccaMarketKey, resolveAccaMarketKey } from "./markets";
import {
  ACCA_DEFAULT_STAKE,
  ACCA_MAX_SELECTIONS,
  type AccaAddResult,
  type AccaMarketKey,
  type AccaSelection,
  type AccaSelectionSource,
  type AccaSelectionStatus,
  type AccaSlip,
} from "./types";

export type AccaSelectionDraft = {
  matchId: number;
  homeTeam: string;
  awayTeam: string;
  competition: string;
  competitionSlug?: string | null;
  countryCode?: string | null;
  kickoffAt?: string | null;
  marketKey: string;
  selectionKey?: string;
  selectionLabel?: string;
  odds?: number | null;
  confidence?: number | null;
  evidenceSummary?: string[];
  publishedAt?: string | null;
  status?: AccaSelectionStatus;
  matchHref: string;
  source: AccaSelectionSource;
};

export function emptySlip(locale: string, now = new Date().toISOString()): AccaSlip {
  const id = newClientSlipId();
  return {
    id,
    name: null,
    selections: [],
    stake: ACCA_DEFAULT_STAKE,
    locale,
    createdAt: now,
    updatedAt: now,
  };
}

export function buildSelection(draft: AccaSelectionDraft, now = new Date().toISOString()): AccaSelection | null {
  const marketKey = resolveAccaMarketKey(draft.marketKey);
  if (!marketKey || !isAccaMarketKey(marketKey)) return null;
  if (!Number.isSafeInteger(draft.matchId) || draft.matchId <= 0) return null;

  const def = getAccaMarket(marketKey);
  const selectionKey = (draft.selectionKey ?? def.defaultSelectionKey).trim();
  if (!selectionKey) return null;

  const odds =
    draft.odds != null && Number.isFinite(draft.odds) && draft.odds > 1
      ? Math.round(draft.odds * 1000) / 1000
      : null;

  return {
    id: selectionId(draft.matchId, marketKey, selectionKey),
    matchId: draft.matchId,
    homeTeam: draft.homeTeam.trim() || "Home",
    awayTeam: draft.awayTeam.trim() || "Away",
    competition: draft.competition.trim() || "Competition",
    competitionSlug: draft.competitionSlug ?? null,
    countryCode: draft.countryCode ?? null,
    kickoffAt: draft.kickoffAt ?? null,
    marketKey,
    marketLabel: def.label,
    selectionLabel: draft.selectionLabel?.trim() || def.defaultSelectionLabel,
    selectionKey: selectionKey.toLowerCase(),
    odds,
    confidence:
      draft.confidence != null && Number.isFinite(draft.confidence)
        ? Math.round(draft.confidence)
        : null,
    evidenceSummary: (draft.evidenceSummary ?? []).slice(0, 6),
    publishedAt: draft.publishedAt ?? null,
    status: draft.status ?? "pending",
    matchHref: draft.matchHref,
    source: draft.source,
    addedAt: now,
  };
}

function touch(slip: AccaSlip, selections: AccaSelection[], now: string): AccaSlip {
  const id =
    selections.length > 0
      ? buildSlipId(
          selections.map((s) => s.id),
          slip.createdAt
        )
      : slip.id;
  return {
    ...slip,
    id,
    selections,
    updatedAt: now,
  };
}

export function addSelection(
  slip: AccaSlip,
  draft: AccaSelectionDraft,
  options?: { replaceFixture?: boolean }
): AccaAddResult {
  const now = new Date().toISOString();
  const selection = buildSelection(draft, now);
  if (!selection) {
    return {
      ok: false,
      code: "unsupported_market",
      message: "This market is not supported in Acca Studio.",
      slip,
    };
  }

  const conflict = findAddConflict(slip.selections, selection);
  if (conflict?.code === "duplicate_selection") {
    return { ok: true, slip, action: "already_present" };
  }
  if (conflict?.code === "duplicate_fixture") {
    if (options?.replaceFixture) {
      const without = slip.selections.filter((s) => s.matchId !== selection.matchId);
      if (without.length >= ACCA_MAX_SELECTIONS) {
        return {
          ok: false,
          code: "max_selections",
          message: `Acca is limited to ${ACCA_MAX_SELECTIONS} selections.`,
          slip,
        };
      }
      return {
        ok: true,
        slip: touch(slip, [...without, selection], now),
        action: "replaced",
      };
    }
    return {
      ok: false,
      code: "duplicate_fixture",
      message: describeConflict(conflict),
      slip,
    };
  }

  if (slip.selections.length >= ACCA_MAX_SELECTIONS) {
    return {
      ok: false,
      code: "max_selections",
      message: `Acca is limited to ${ACCA_MAX_SELECTIONS} selections.`,
      slip,
    };
  }

  return {
    ok: true,
    slip: touch(slip, [...slip.selections, selection], now),
    action: "added",
  };
}

export function removeSelection(slip: AccaSlip, selectionIdValue: string): AccaSlip {
  const now = new Date().toISOString();
  return touch(
    slip,
    slip.selections.filter((s) => s.id !== selectionIdValue),
    now
  );
}

export function toggleSelection(
  slip: AccaSlip,
  draft: AccaSelectionDraft
): AccaAddResult {
  const selection = buildSelection(draft);
  if (!selection) {
    return {
      ok: false,
      code: "unsupported_market",
      message: "This market is not supported in Acca Studio.",
      slip,
    };
  }
  if (slip.selections.some((s) => s.id === selection.id)) {
    return {
      ok: true,
      slip: removeSelection(slip, selection.id),
      action: "already_present",
    };
  }
  return addSelection(slip, draft);
}

export function clearSlip(slip: AccaSlip): AccaSlip {
  const now = new Date().toISOString();
  return {
    ...emptySlip(slip.locale, now),
    stake: slip.stake,
  };
}

export function setStake(slip: AccaSlip, stake: number): AccaSlip {
  const safe = Number.isFinite(stake) ? Math.min(1_000_000, Math.max(0, stake)) : ACCA_DEFAULT_STAKE;
  return { ...slip, stake: Math.round(safe * 100) / 100, updatedAt: new Date().toISOString() };
}

export function renameSlip(slip: AccaSlip, name: string | null): AccaSlip {
  const trimmed = name?.trim() || null;
  return {
    ...slip,
    name: trimmed ? trimmed.slice(0, 80) : null,
    updatedAt: new Date().toISOString(),
  };
}

export function hasSelection(
  slip: AccaSlip,
  matchId: number,
  marketKey: AccaMarketKey,
  selectionKey?: string
): boolean {
  const key = selectionKey ?? getAccaMarket(marketKey).defaultSelectionKey;
  const id = selectionId(matchId, marketKey, key);
  return slip.selections.some((s) => s.id === id);
}

export type AccaBulkTransferResult = {
  ok: boolean;
  slip: AccaSlip;
  added: number;
  skipped: number;
  conflicts: string[];
  message?: string;
};

/** Replace the entire slip with builder drafts (preserves stake). */
export function replaceSelections(
  slip: AccaSlip,
  drafts: readonly AccaSelectionDraft[]
): AccaBulkTransferResult {
  let next = clearSlip(slip);
  const conflicts: string[] = [];
  let added = 0;
  let skipped = 0;
  for (const draft of drafts) {
    const result = addSelection(next, draft, { replaceFixture: true });
    if (!result.ok) {
      skipped += 1;
      conflicts.push(result.message);
      continue;
    }
    if (result.action === "already_present") {
      skipped += 1;
    } else {
      added += 1;
      next = result.slip;
    }
  }
  return {
    ok: added > 0 || drafts.length === 0,
    slip: next,
    added,
    skipped,
    conflicts,
    message:
      added === 0 && drafts.length > 0
        ? conflicts[0] ?? "Could not transfer selections."
        : undefined,
  };
}

/** Merge builder drafts into the current slip (one market per fixture). */
export function mergeSelections(
  slip: AccaSlip,
  drafts: readonly AccaSelectionDraft[],
  options?: { replaceFixture?: boolean }
): AccaBulkTransferResult {
  let next = slip;
  const conflicts: string[] = [];
  let added = 0;
  let skipped = 0;
  for (const draft of drafts) {
    const result = addSelection(next, draft, {
      replaceFixture: options?.replaceFixture ?? true,
    });
    if (!result.ok) {
      skipped += 1;
      conflicts.push(result.message);
      continue;
    }
    if (result.action === "already_present") {
      skipped += 1;
    } else {
      added += 1;
      next = result.slip;
    }
  }
  return {
    ok: added > 0 || drafts.length === 0,
    slip: next,
    added,
    skipped,
    conflicts,
    message:
      added === 0 && drafts.length > 0
        ? conflicts[0] ?? "Could not merge selections."
        : undefined,
  };
}

export function selectionForFixture(
  slip: AccaSlip,
  matchId: number
): AccaSelection | undefined {
  return slip.selections.find((s) => s.matchId === matchId);
}

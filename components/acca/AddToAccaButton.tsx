"use client";

import { useAccaOptional } from "./AccaProvider";
import type { AccaSelectionDraft } from "@/lib/acca/rules";
import { resolveAccaMarketKey } from "@/lib/acca/markets";
import { selectionId } from "@/lib/acca/ids";
import { getAccaMarket } from "@/lib/acca/markets";

export function AddToAccaButton({
  draft,
  className,
  labelAdd = "Add to accumulator",
  labelAdded = "In Acca",
  labelReplace = "Replace in Acca",
  compact = false,
}: {
  draft: AccaSelectionDraft;
  className?: string;
  labelAdd?: string;
  labelAdded?: string;
  labelReplace?: string;
  compact?: boolean;
}) {
  const acca = useAccaOptional();
  const marketKey = resolveAccaMarketKey(draft.marketKey);

  if (!acca || !marketKey) return null;

  const def = getAccaMarket(marketKey);
  const key = draft.selectionKey ?? def.defaultSelectionKey;
  const id = selectionId(draft.matchId, marketKey, key);
  const exact = acca.slip.selections.some((s) => s.id === id);
  const sameFixture = acca.slip.selections.some(
    (s) => s.matchId === draft.matchId && s.id !== id
  );

  const base =
    className ??
    (compact
      ? "inline-flex min-h-9 items-center rounded-md border border-brand/30 bg-[var(--green-surface)] px-2.5 text-xs font-semibold text-brand transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      : "inline-flex min-h-10 items-center rounded-md border border-brand/35 bg-[var(--green-surface)] px-3 text-sm font-semibold text-brand transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand");

  if (exact) {
    return (
      <button
        type="button"
        className={`${base} opacity-90`}
        aria-pressed="true"
        onClick={() => {
          acca.remove(id);
        }}
      >
        {labelAdded}
      </button>
    );
  }

  return (
    <button
      type="button"
      className={base}
      aria-pressed="false"
      onClick={() => {
        acca.add(draft, { replaceFixture: sameFixture, openPanel: true });
      }}
    >
      {sameFixture ? labelReplace : labelAdd}
    </button>
  );
}

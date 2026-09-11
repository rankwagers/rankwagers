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

  /* The add/transfer action is register-gated to GHOST (Bible V3 CTA tiers):
   * filled green is curated-commercial only, and this button is neither. The
   * `.rw3` scope's global :focus-visible ring carries keyboard focus. */
  const base = className ?? (compact ? "rw3-ghost min-h-9" : "rw3-ghost min-h-10");

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

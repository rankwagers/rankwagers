"use client";

import type { PublicEvidenceCombo, PublicOperatorMatch } from "@/lib/combo/apiTypes";
import type { ReplacementMode } from "@/lib/combo/types";
import { ComboAlternatives } from "./ComboAlternatives";
import { ComboOperatorSection } from "./ComboOperatorSection";
import { ComboSelectionCard } from "./ComboSelectionCard";
import { ComboSummary } from "./ComboSummary";

export function ComboResult({
  combo,
  alternatives,
  operators,
  locale,
  pendingAction,
  onReplace,
  onRemove,
  onExpand,
  onSelectAlternative,
  onCompare,
  onOperatorView,
  onOperatorClick,
  onCopy,
  onFindReplacement,
}: {
  combo: PublicEvidenceCombo;
  alternatives: PublicEvidenceCombo[];
  operators: PublicOperatorMatch[];
  locale: string;
  pendingAction: boolean;
  onReplace: (
    selection: { matchId: number; marketId: string },
    mode: ReplacementMode
  ) => void;
  onRemove: (selection: { matchId: number; marketId: string }) => void;
  onExpand: () => void;
  onSelectAlternative: (combo: PublicEvidenceCombo, index: number) => void;
  onCompare: () => void;
  onOperatorView: (op: PublicOperatorMatch) => void;
  onOperatorClick: (op: PublicOperatorMatch) => void;
  onCopy: () => void;
  onFindReplacement: () => void;
}) {
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.9fr)]">
      <div className="space-y-6">
        <ComboSummary combo={combo} />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onCopy}
            className="min-h-12 rounded-md border border-border px-4 py-2 text-sm font-semibold"
          >
            Copy Combo
          </button>
          <button
            type="button"
            onClick={onFindReplacement}
            className="min-h-12 rounded-md border border-border px-4 py-2 text-sm font-semibold"
          >
            Find Replacement
          </button>
        </div>
        <section aria-labelledby="combo-selections-heading" className="space-y-3">
          <h2 id="combo-selections-heading" className="font-display text-xl font-semibold">
            Selections
          </h2>
          {combo.selections.map((selection) => (
            <ComboSelectionCard
              key={`${selection.matchId}:${selection.marketId}`}
              selection={selection}
              pending={pendingAction}
              onExpand={onExpand}
              onReplace={(mode) =>
                onReplace(
                  { matchId: selection.matchId, marketId: selection.marketId },
                  mode
                )
              }
              onRemove={() =>
                onRemove({
                  matchId: selection.matchId,
                  marketId: selection.marketId,
                })
              }
            />
          ))}
        </section>
        <ComboAlternatives
          primary={combo}
          alternatives={alternatives}
          onSelect={onSelectAlternative}
        />
      </div>
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <ComboOperatorSection
          operators={operators}
          locale={locale}
          onCompare={onCompare}
          onOperatorView={onOperatorView}
          onOperatorClick={onOperatorClick}
        />
      </aside>
    </div>
  );
}

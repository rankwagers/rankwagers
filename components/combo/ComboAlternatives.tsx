"use client";

import { EvidenceStrengthBadge } from "@/components/evidence-ui/EvidenceStrengthBadge";
import type { PublicEvidenceCombo } from "@/lib/combo/apiTypes";
import type { EvidenceStrength } from "@/lib/evidence-ui";

const LABELS = ["Stronger Evidence", "Closest Target", "Higher Target Odds"];

export function ComboAlternatives({
  primary,
  alternatives,
  onSelect,
}: {
  primary: PublicEvidenceCombo;
  alternatives: PublicEvidenceCombo[];
  onSelect: (combo: PublicEvidenceCombo, index: number) => void;
}) {
  if (!alternatives.length) return null;

  const primaryKeys = new Set(
    primary.selections.map((s) => `${s.matchId}:${s.marketId}`)
  );

  return (
    <section aria-labelledby="combo-alternatives-heading" className="space-y-3">
      <h2 id="combo-alternatives-heading" className="font-display text-xl font-semibold">
        Alternative combos
      </h2>
      <div className="grid gap-3 lg:grid-cols-3">
        {alternatives.slice(0, 3).map((combo, index) => {
          const changed = combo.selections.filter(
            (s) => !primaryKeys.has(`${s.matchId}:${s.marketId}`)
          ).length;
          return (
            <article
              key={combo.id}
              className="rounded-md border border-border bg-[var(--canvas-secondary)] px-4 py-4"
            >
              <p className="text-metadata uppercase tracking-label text-muted-foreground">
                {LABELS[index] ?? `Alternative ${index + 1}`}
              </p>
              <p className="mt-2 font-mono text-2xl font-semibold text-brand">
                {combo.combinedOdds.toFixed(2)}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                <EvidenceStrengthBadge
                  strength={combo.aggregateEvidenceStrength as EvidenceStrength}
                />
                <span>{combo.selections.length} selections</span>
                <span>{changed} different</span>
              </div>
              <button
                type="button"
                onClick={() => onSelect(combo, index)}
                className="mt-4 min-h-12 w-full rounded-md border border-brand px-3 py-2 text-sm font-semibold text-brand"
              >
                Use this combo
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

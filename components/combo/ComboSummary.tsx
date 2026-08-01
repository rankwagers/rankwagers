import { EvidenceStrengthBadge } from "@/components/evidence-ui/EvidenceStrengthBadge";
import type { PublicEvidenceCombo } from "@/lib/combo/apiTypes";
import type { EvidenceStrength } from "@/lib/evidence-ui";

export function ComboSummary({ combo }: { combo: PublicEvidenceCombo }) {
  const strength = combo.aggregateEvidenceStrength as EvidenceStrength;
  return (
    <section
      className="rounded-md border border-border bg-[var(--canvas-secondary)] px-4 py-5"
      aria-labelledby="combo-summary-heading"
    >
      <h2 id="combo-summary-heading" className="font-display text-xl font-semibold">
        Your Evidence Combo
      </h2>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
        <div>
          <dt className="text-metadata uppercase tracking-label text-muted-foreground">
            Target range
          </dt>
          <dd className="mt-1 font-mono font-semibold">
            {combo.request.targetOddsMin.toFixed(2)}–{combo.request.targetOddsMax.toFixed(2)}
          </dd>
        </div>
        <div>
          <dt className="text-metadata uppercase tracking-label text-muted-foreground">
            Combined odds
          </dt>
          <dd className="mt-1 font-mono text-2xl font-semibold text-brand">
            {combo.combinedOdds.toFixed(2)}
          </dd>
        </div>
        <div>
          <dt className="text-metadata uppercase tracking-label text-muted-foreground">
            Target status
          </dt>
          <dd className="mt-1 font-medium">
            {combo.inTargetRange ? "Inside requested range" : "Outside requested range"}
          </dd>
        </div>
        <div>
          <dt className="text-metadata uppercase tracking-label text-muted-foreground">
            Evidence strength
          </dt>
          <dd className="mt-1">
            <EvidenceStrengthBadge strength={strength} />
          </dd>
        </div>
        <div>
          <dt className="text-metadata uppercase tracking-label text-muted-foreground">
            Average coverage
          </dt>
          <dd className="mt-1 font-mono font-semibold">{combo.averageCoverage}%</dd>
        </div>
        <div>
          <dt className="text-metadata uppercase tracking-label text-muted-foreground">
            Qualified sample
          </dt>
          <dd className="mt-1 font-mono font-semibold">
            {combo.totalQualifiedSample}
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              (list admission proxy where fixture research is not attached)
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-metadata uppercase tracking-label text-muted-foreground">
            Selections
          </dt>
          <dd className="mt-1 font-mono font-semibold">{combo.selections.length}</dd>
        </div>
        <div>
          <dt className="text-metadata uppercase tracking-label text-muted-foreground">
            Generated
          </dt>
          <dd className="mt-1 font-mono text-xs">{combo.generatedAt}</dd>
        </div>
        <div>
          <dt className="text-metadata uppercase tracking-label text-muted-foreground">
            Odds freshness
          </dt>
          <dd className="mt-1 capitalize">{combo.oddsFreshness.replace(/_/g, " ")}</dd>
        </div>
      </dl>
      <p className="mt-4 text-xs text-muted-foreground">
        Odds may change. Terms apply. 18+ only. This is research support, not a tip or
        guarantee.
      </p>
    </section>
  );
}

"use client";

import type { PublicOperatorMatch } from "@/lib/combo/apiTypes";
import { ComboOperatorCard } from "./ComboOperatorCard";

export function ComboOperatorSection({
  operators,
  locale,
  onCompare,
  onOperatorView,
  onOperatorClick,
}: {
  operators: PublicOperatorMatch[];
  locale: string;
  onCompare: () => void;
  onOperatorView: (op: PublicOperatorMatch) => void;
  onOperatorClick: (op: PublicOperatorMatch) => void;
}) {
  const eligible = operators.filter((op) => op.countryEligible);
  const full = eligible.filter((op) => op.availability === "full");
  const unknown = eligible.filter((op) => op.availability === "unknown");
  const partial = eligible.filter((op) => op.availability === "partial");

  return (
    <section aria-labelledby="combo-operators-heading" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="combo-operators-heading" className="font-display text-xl font-semibold">
            Available Operators
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Ranked by the API. Full availability outranks unknown. Unknown never means the
            full combo is ready.
          </p>
        </div>
        <button
          type="button"
          onClick={onCompare}
          className="min-h-12 rounded-md border border-border px-4 py-2 text-sm font-semibold"
        >
          Compare operators
        </button>
      </div>

      {!eligible.length ? (
        <p className="text-sm text-muted-foreground">
          No fully compatible operator is available for your country. You can still review
          and copy the selections.
        </p>
      ) : null}

      {full.length ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Full combo available</h3>
          {full.map((op) => (
            <ComboOperatorCard
              key={op.slug}
              operator={op}
              locale={locale}
              onView={() => onOperatorView(op)}
              onCta={() => onOperatorClick(op)}
            />
          ))}
        </div>
      ) : null}

      {unknown.length ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Availability unverified</h3>
          {unknown.map((op) => (
            <ComboOperatorCard
              key={op.slug}
              operator={op}
              locale={locale}
              onView={() => onOperatorView(op)}
              onCta={() => onOperatorClick(op)}
            />
          ))}
        </div>
      ) : null}

      {partial.length ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Other available operators</h3>
          {partial.map((op) => (
            <ComboOperatorCard
              key={op.slug}
              operator={op}
              locale={locale}
              onView={() => onOperatorView(op)}
              onCta={() => onOperatorClick(op)}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

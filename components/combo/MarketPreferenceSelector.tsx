"use client";

import { ENABLED_MARKETS } from "@/lib/combo/config";
import type { ComboMarketPreference } from "@/lib/combo/types";

export function MarketPreferenceSelector({
  value,
  onChange,
}: {
  value: ComboMarketPreference[];
  onChange: (value: ComboMarketPreference[]) => void;
}) {
  const mixed = value.includes("mixed") || value.length === 0;

  function toggle(pref: ComboMarketPreference) {
    if (pref === "mixed") {
      onChange(["mixed"]);
      return;
    }
    const withoutMixed = value.filter((v) => v !== "mixed");
    if (withoutMixed.includes(pref)) {
      const next = withoutMixed.filter((v) => v !== pref);
      onChange(next.length ? next : ["mixed"]);
    } else {
      onChange([...withoutMixed, pref]);
    }
  }

  return (
    <fieldset className="space-y-3">
      <legend className="text-metadata font-semibold uppercase tracking-label text-muted-foreground">
        Supported markets
      </legend>
      <p className="text-xs text-muted-foreground">
        Only markets with qualification lists and odds mapping are available.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          aria-pressed={mixed}
          onClick={() => toggle("mixed")}
          className={`min-h-12 rounded-md border px-3 py-2 text-sm font-medium ${
            mixed
              ? "border-brand bg-brand/10 text-brand"
              : "border-border bg-[var(--canvas-secondary)]"
          }`}
        >
          Mixed
        </button>
        {ENABLED_MARKETS.map((market) => {
          const active = !mixed && value.includes(market.preference);
          return (
            <button
              key={market.preference}
              type="button"
              aria-pressed={active}
              onClick={() => toggle(market.preference)}
              className={`min-h-12 rounded-md border px-3 py-2 text-sm font-medium ${
                active
                  ? "border-brand bg-brand/10 text-brand"
                  : "border-border bg-[var(--canvas-secondary)]"
              }`}
            >
              {market.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

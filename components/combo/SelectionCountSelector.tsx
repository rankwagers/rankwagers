"use client";

import { ABSOLUTE_MAX_SELECTIONS, ABSOLUTE_MIN_SELECTIONS } from "@/lib/combo/config";

export function SelectionCountSelector({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const options = Array.from(
    { length: ABSOLUTE_MAX_SELECTIONS - ABSOLUTE_MIN_SELECTIONS + 1 },
    (_, i) => ABSOLUTE_MIN_SELECTIONS + i
  );

  return (
    <fieldset className="space-y-3">
      <legend className="text-metadata font-semibold uppercase tracking-label text-muted-foreground">
        Maximum selections
      </legend>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Selection count">
        {options.map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={value === n}
            onClick={() => onChange(n)}
            className={`min-h-12 min-w-12 rounded-md border px-3 py-2 font-mono text-sm font-semibold ${
              value === n
                ? "border-brand bg-brand/10 text-brand"
                : "border-border bg-[var(--canvas-secondary)]"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <label className="block text-sm text-muted-foreground">
        Or enter a number
        <input
          type="number"
          min={ABSOLUTE_MIN_SELECTIONS}
          max={ABSOLUTE_MAX_SELECTIONS}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="mt-1 block w-24 min-h-12 rounded-md border border-border bg-background px-3 font-mono"
        />
      </label>
    </fieldset>
  );
}

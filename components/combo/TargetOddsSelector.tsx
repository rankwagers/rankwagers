"use client";

import { TARGET_PRESETS } from "@/lib/combo/config";

const PRESETS = [
  ...TARGET_PRESETS.map((p) => ({ id: p.id, min: p.min, max: p.max, label: p.label })),
  { id: "custom", min: 0, max: 0, label: "Custom" },
] as const;

export function TargetOddsSelector({
  min,
  max,
  onChange,
}: {
  min: number;
  max: number;
  onChange: (min: number, max: number, presetId: string) => void;
}) {
  const active =
    PRESETS.find((p) => p.id !== "custom" && p.min === min && p.max === max)?.id ??
    "custom";

  return (
    <fieldset className="space-y-3">
      <legend className="text-metadata font-semibold uppercase tracking-label text-muted-foreground">
        Target combined odds
      </legend>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Odds presets">
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => {
              if (preset.id === "custom") {
                onChange(min, max, "custom");
                return;
              }
              onChange(preset.min, preset.max, preset.id);
            }}
            className={`min-h-12 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
              active === preset.id
                ? "border-brand bg-brand/10 text-brand"
                : "border-border bg-[var(--canvas-secondary)] text-foreground hover:border-brand/40"
            }`}
            aria-pressed={active === preset.id}
          >
            {preset.label}
          </button>
        ))}
      </div>
      {active === "custom" && (
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">
            <span className="text-muted-foreground">Minimum</span>
            <input
              type="number"
              min={1.01}
              step={0.1}
              value={min}
              onChange={(e) => onChange(Number(e.target.value), max, "custom")}
              className="mt-1 w-full min-h-12 rounded-md border border-border bg-background px-3 font-mono"
            />
          </label>
          <label className="text-sm">
            <span className="text-muted-foreground">Maximum</span>
            <input
              type="number"
              min={1.01}
              step={0.1}
              value={max}
              onChange={(e) => onChange(min, Number(e.target.value), "custom")}
              className="mt-1 w-full min-h-12 rounded-md border border-border bg-background px-3 font-mono"
            />
          </label>
        </div>
      )}
    </fieldset>
  );
}

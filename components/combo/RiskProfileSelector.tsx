"use client";

import type { ComboRiskProfile } from "@/lib/combo/types";

const PROFILES: Array<{ id: ComboRiskProfile; label: string; hint: string }> = [
  {
    id: "conservative",
    label: "Conservative",
    hint: "Stronger evidence, higher coverage, fewer selections",
  },
  {
    id: "balanced",
    label: "Balanced",
    hint: "Evidence quality with target-odds fit",
  },
  {
    id: "value",
    label: "Higher Target Odds",
    hint: "Wider range while keeping qualification gates",
  },
];

export function RiskProfileSelector({
  value,
  onChange,
}: {
  value: ComboRiskProfile;
  onChange: (value: ComboRiskProfile) => void;
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-metadata font-semibold uppercase tracking-label text-muted-foreground">
        Risk profile
      </legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {PROFILES.map((profile) => (
          <button
            key={profile.id}
            type="button"
            onClick={() => onChange(profile.id)}
            aria-pressed={value === profile.id}
            className={`min-h-12 rounded-md border px-3 py-3 text-left transition-colors ${
              value === profile.id
                ? "border-brand bg-brand/10"
                : "border-border bg-[var(--canvas-secondary)] hover:border-brand/40"
            }`}
          >
            <span className="block text-sm font-semibold text-foreground">{profile.label}</span>
            <span className="mt-1 block text-xs text-muted-foreground">{profile.hint}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}

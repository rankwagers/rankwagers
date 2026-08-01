"use client";

import Link from "next/link";
import { TARGET_PRESETS } from "@/lib/combo/config";
import { trackComboEvent } from "@/lib/combo/analytics";

export function ComboHomepageLauncher({
  locale,
  fixtureCount,
}: {
  locale: string;
  fixtureCount: number;
}) {
  return (
    <section
      data-analytics-section="evidence_combo_studio"
      aria-labelledby="homepage-combo-heading"
      className="border-t border-[var(--border-subtle)] py-8"
    >
      <p className="text-metadata font-medium uppercase tracking-label text-brand">
        Evidence Combo Studio
      </p>
      <h2
        id="homepage-combo-heading"
        className="mt-2 font-display text-2xl font-semibold text-foreground md:text-3xl"
      >
        Build an evidence-supported combination
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-[var(--ink-secondary)]">
        Set a target odds range, keep qualification gates on, and review transparent
        selection reasoning before opening an operator.{" "}
        {fixtureCount
          ? `${fixtureCount} qualified fixtures are in today's research queue.`
          : "Open the studio when qualified fixtures are available."}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {TARGET_PRESETS.map((preset) => (
          <Link
            key={preset.id}
            href={`/${locale}/combo?target=${preset.id}`}
            onClick={() =>
              trackComboEvent("combo_target_select", {
                locale,
                targetOddsMin: preset.min,
                targetOddsMax: preset.max,
                placement: "homepage",
              })
            }
            className="min-h-12 rounded-md border border-border bg-[var(--canvas-secondary)] px-3 py-2 text-sm font-medium hover:border-brand/40"
          >
            {preset.label}
          </Link>
        ))}
      </div>
      <Link
        href={`/${locale}/combo`}
        onClick={() =>
          trackComboEvent("combo_builder_start", { locale, placement: "homepage" })
        }
        className="btn-primary mt-5 min-h-12"
      >
        Build My Combo
      </Link>
    </section>
  );
}

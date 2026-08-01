"use client";

import { useState } from "react";
import { trackMarketEvidenceExpansion } from "@/lib/analytics/marketPages";
import { trackAnalyticsEvent } from "@/lib/analytics/client";
import { evidenceEventProperties } from "@/lib/evidence-ui/analytics";
import { EvidenceSummaryChip } from "@/components/evidence-ui/EvidenceSummaryChip";
import type { MarketEvidenceIndicator } from "@/lib/markets/types";

export function MarketEvidenceSection({
  marketSlug,
  locale,
  indicators,
}: {
  marketSlug: string;
  locale: string;
  indicators: MarketEvidenceIndicator[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <section className="border-b border-[var(--border-subtle)] py-8" aria-labelledby="evidence">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="evidence" className="font-display text-xl font-semibold text-foreground">
          Evidence indicators
        </h2>
        <button
          type="button"
          onClick={() => {
            if (!open) {
              trackMarketEvidenceExpansion({ marketSlug, locale });
              trackAnalyticsEvent({
                event_name: "evidence_expand",
                fixture_id: null,
                market: marketSlug,
                operator_slug: null,
                locale,
                user_id: null,
                properties: evidenceEventProperties({
                  entity: `market:${marketSlug}`,
                  metric: "indicators",
                  locale,
                }),
              });
            }
            setOpen((value) => !value);
          }}
          className="min-h-11 text-xs font-medium text-brand hover:underline"
        >
          {open ? "Hide evidence detail" : "Expand evidence indicators"}
        </button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Metric definitions for this market — not live values. Live research uses the Evidence section above.
      </p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {indicators.map((indicator) => (
          <li
            key={indicator.id}
            className="rounded-md border border-border bg-[var(--canvas-secondary)] px-3 py-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">{indicator.label}</p>
              <EvidenceSummaryChip
                strength={indicator.available ? "moderate" : "insufficient"}
              />
            </div>
            {open && (
              <p className="mt-1 text-xs leading-relaxed text-[var(--ink-secondary)]">
                {indicator.description}
              </p>
            )}
            {!open && (
              <p className="mt-1 text-metadata text-muted-foreground">
                {indicator.available ? "Used in research views" : "Conceptual indicator"}
              </p>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">
        Indicators describe factual research inputs. They are not tips or confidence scores.
      </p>
    </section>
  );
}

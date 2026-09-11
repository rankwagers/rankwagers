"use client";

import { useState } from "react";
import { trackMarketEvidenceExpansion } from "@/lib/analytics/marketPages";
import { trackAnalyticsEvent } from "@/lib/analytics/client";
import { evidenceEventProperties } from "@/lib/evidence-ui/analytics";
import type { MarketEvidenceIndicator } from "@/lib/markets/types";
import type { PredictionStrings } from "@/lib/translations/predictionsEn";

/*
 * EVIDENCE INDICATORS — rw3 conversion. Definitions, not live values, and the copy says
 * so; state is carried monochrome (the 11px label register), never by a
 * strength chip a metric definition cannot earn (no fake precision). The expander is a real
 * button — keyboard-first, the shared rw3 ghost hover/pressed language.
 */
export function MarketEvidenceSection({
  marketSlug,
  locale,
  indicators,
  p,
}: {
  marketSlug: string;
  locale: string;
  indicators: MarketEvidenceIndicator[];
  p: PredictionStrings;
}) {
  const [open, setOpen] = useState(false);

  return (
    <section aria-labelledby="mkt-indicators-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h3 id="mkt-indicators-heading" className="rw3-label">
          {p.mktIndicatorsTitle}
        </h3>
        <button
          type="button"
          aria-expanded={open}
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
          className="rw3-ghost"
        >
          {open ? p.mktIndicatorsHide : p.mktIndicatorsShow}
        </button>
      </div>
      <p className="rw3-meta mt-1.5 max-w-[52ch]">{p.mktIndicatorsNote}</p>
      <ul className="mt-4 max-w-[38rem] border-t border-[var(--line)]">
        {indicators.map((indicator) => (
          <li key={indicator.id} className="border-b border-[var(--line)] py-2.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6">
              <p className="text-[14px] font-semibold">{indicator.label}</p>
              <p className="rw3-label">
                {indicator.available ? p.mktIndicatorUsed : p.mktIndicatorConceptual}
              </p>
            </div>
            {open ? (
              <p
                className="mt-1 max-w-[52ch] text-[13px] leading-relaxed"
                style={{ color: "var(--muted)" }}
              >
                {indicator.description}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

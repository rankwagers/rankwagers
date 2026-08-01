"use client";

import { useId, useState } from "react";
import type { EvidenceBundle } from "@/lib/evidence-ui";
import { evidenceUiTokens } from "@/lib/evidence-ui/tokens";
import { trackAnalyticsEvent } from "@/lib/analytics/client";
import { evidenceEventProperties } from "@/lib/evidence-ui/analytics";
import { EvidenceCard } from "./EvidenceCard";
import { EvidenceStrengthBadge } from "./EvidenceStrengthBadge";
import { QualificationPanel } from "./QualificationPanel";
import { EvidenceTimeline } from "./EvidenceTimeline";
import { ProvenanceBlock } from "./ProvenanceBlock";
import { SplitCard } from "./SplitCard";
import { BaselineComparison } from "./BaselineComparison";

export function EvidenceSection({
  bundle,
  locale,
  country,
  defaultOpen = true,
}: {
  bundle: EvidenceBundle;
  locale?: string;
  country?: string | null;
  defaultOpen?: boolean;
}) {
  const baseId = useId();
  const [open, setOpen] = useState(defaultOpen);
  const splitMetric = bundle.metrics.find((metric) => metric.split);
  const baselineMetric = bundle.metrics.find((metric) => metric.baseline);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      trackAnalyticsEvent({
        event_name: "evidence_expand",
        fixture_id: null,
        market: null,
        operator_slug: null,
        locale: locale ?? null,
        user_id: null,
        properties: evidenceEventProperties({
          entity: bundle.entityKey,
          sample_size: bundle.metrics[0]?.sample.sampleSize,
          coverage: bundle.metrics[0]?.sample.coveragePercent,
          locale,
          country,
        }),
      });
    }
  }

  return (
    <section className={evidenceUiTokens.section} aria-labelledby={`${baseId}-title`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id={`${baseId}-title`} className="font-display text-xl font-semibold text-foreground">
            {bundle.title}
          </h2>
          <p className={`mt-1 ${evidenceUiTokens.note}`}>
            Shared research language — sample size, coverage, and evidence strength on every metric.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <EvidenceStrengthBadge strength={bundle.summaryStrength} />
          <button
            type="button"
            className={`${evidenceUiTokens.touchTarget} rounded-md border border-border px-3 py-2 text-sm text-foreground hover:bg-muted`}
            aria-expanded={open}
            aria-controls={`${baseId}-body`}
            onClick={toggle}
          >
            {open ? "Collapse" : "Expand"}
          </button>
        </div>
      </div>

      {open ? (
        <div id={`${baseId}-body`} className="mt-6 space-y-6">
          <nav className={evidenceUiTokens.stickyNav} aria-label="Evidence sections">
            {[
              ["metrics", "Metrics"],
              ["qualification", "Qualification"],
              ["split", "Home / Away"],
              ["baseline", "Baseline"],
              ["timeline", "Timeline"],
              ["source", "Source"],
            ].map(([id, label]) => (
              <a
                key={id}
                href={`#${baseId}-${id}`}
                className={`${evidenceUiTokens.touchTarget} inline-flex items-center rounded-md border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground`}
              >
                {label}
              </a>
            ))}
          </nav>

          <div id={`${baseId}-metrics`} className="grid gap-3 md:grid-cols-2">
            {bundle.metrics.map((metric) => (
              <EvidenceCard key={metric.id} metric={metric} />
            ))}
          </div>

          {bundle.qualification ? (
            <div id={`${baseId}-qualification`}>
              <QualificationPanel
                qualification={bundle.qualification}
                entity={bundle.entityKey}
                locale={locale}
                country={country}
              />
            </div>
          ) : null}

          {splitMetric?.split ? (
            <div id={`${baseId}-split`}>
              <h3 className="font-display text-lg font-semibold text-foreground">Home / Away</h3>
              <div className="mt-3">
                <SplitCard
                  split={splitMetric.split}
                  entity={bundle.entityKey}
                  locale={locale}
                  country={country}
                />
              </div>
            </div>
          ) : null}

          {baselineMetric?.baseline ? (
            <div id={`${baseId}-baseline`}>
              <h3 className="font-display text-lg font-semibold text-foreground">Baseline</h3>
              <div className="mt-3">
                <BaselineComparison baseline={baselineMetric.baseline} />
              </div>
            </div>
          ) : null}

          <div id={`${baseId}-timeline`}>
            <EvidenceTimeline events={bundle.timeline} />
          </div>

          {bundle.provenance ? (
            <div id={`${baseId}-source`} className={evidenceUiTokens.card}>
              <ProvenanceBlock
                provenance={bundle.provenance}
                entity={bundle.entityKey}
                locale={locale}
                country={country}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

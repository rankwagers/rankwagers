"use client";

import { useState } from "react";
import type { ProvenanceView } from "@/lib/evidence-ui";
import { evidenceUiTokens } from "@/lib/evidence-ui/tokens";
import { trackAnalyticsEvent } from "@/lib/analytics/client";
import { evidenceEventProperties } from "@/lib/evidence-ui/analytics";

export function ProvenanceBlock({
  provenance,
  compact = false,
  entity,
  locale,
  country,
}: {
  provenance: ProvenanceView;
  compact?: boolean;
  entity?: string;
  locale?: string;
  country?: string | null;
}) {
  const [open, setOpen] = useState(!compact);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      trackAnalyticsEvent({
        event_name: "source_view",
        fixture_id: null,
        market: null,
        operator_slug: null,
        locale: locale ?? null,
        user_id: null,
        properties: evidenceEventProperties({ entity, locale, country }),
      });
    }
  }

  return (
    <div aria-label="Evidence provenance">
      {compact ? (
        <button
          type="button"
          className={`${evidenceUiTokens.touchTarget} text-body-sm font-medium text-brand underline-offset-2 hover:underline`}
          onClick={toggle}
          aria-expanded={open}
        >
          {open ? "Hide source" : "View source"}
        </button>
      ) : (
        <h3 className={evidenceUiTokens.label}>Source</h3>
      )}
      {open ? (
        <dl className="mt-2 grid gap-2 text-body-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Provider</dt>
            <dd className="font-medium text-foreground">{provenance.provider}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Calculation</dt>
            <dd className="font-medium text-foreground">{provenance.calculationSource}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Qualification engine</dt>
            <dd className="font-medium text-foreground">{provenance.qualificationEngine}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Last verified</dt>
            <dd className="font-medium text-foreground">{provenance.lastVerifiedLabel}</dd>
          </div>
        </dl>
      ) : null}
    </div>
  );
}

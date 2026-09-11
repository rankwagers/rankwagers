"use client";

import { useState } from "react";
import type { SplitView } from "@/lib/evidence-ui";
import { evidenceUiTokens } from "@/lib/evidence-ui/tokens";
import { trackAnalyticsEvent } from "@/lib/analytics/client";
import { evidenceEventProperties } from "@/lib/evidence-ui/analytics";

export function SplitCard({
  split,
  entity,
  locale,
  country,
}: {
  split: SplitView;
  entity?: string;
  locale?: string;
  country?: string | null;
}) {
  const [mode, setMode] = useState<"overall" | "home" | "away">("overall");

  function select(next: "overall" | "home" | "away") {
    setMode(next);
    trackAnalyticsEvent({
      event_name: "split_toggle",
      fixture_id: null,
      market: null,
      operator_slug: null,
      locale: locale ?? null,
      user_id: null,
      properties: evidenceEventProperties({
        entity,
        metric: next,
        sample_size: split[next].sampleSize,
        coverage: split.coveragePercent,
        locale,
        country,
      }),
    });
  }

  const active = split[mode];

  return (
    <div className={evidenceUiTokens.card} aria-label="Home and away split">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Split views">
        {(["overall", "home", "away"] as const).map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={mode === key}
            className={`${evidenceUiTokens.touchTarget} border px-3 py-2 text-[13px] capitalize ${
              mode === key
                ? "border-[var(--accent)] bg-[var(--pctbg)] font-medium text-[var(--accent)]"
                : "rw3-hoverable border-[var(--line)] text-[var(--muted)]"
            }`}
            style={{ borderRadius: 6 }}
            onClick={() => select(key)}
          >
            {key}
          </button>
        ))}
      </div>
      <dl className="mt-3 grid gap-2 sm:grid-cols-3">
        <div>
          <dt className={evidenceUiTokens.label}>Value</dt>
          <dd className={evidenceUiTokens.value}>{active.displayValue}</dd>
        </div>
        <div>
          <dt className={evidenceUiTokens.label}>Sample</dt>
          <dd className="text-[13px] font-semibold tabular-nums">{active.sampleSize}</dd>
        </div>
        <div>
          <dt className={evidenceUiTokens.label}>Difference</dt>
          <dd className="text-[13px] font-semibold tabular-nums">{split.differenceDisplay}</dd>
        </div>
      </dl>
      {split.coveragePercent != null ? (
        <p className={`mt-2 ${evidenceUiTokens.note}`}>Coverage {split.coveragePercent}%</p>
      ) : null}
      {split.cautionNote ? (
        <p className="mt-2 text-[12px]" style={{ color: "var(--loss)" }} role="note">
          {split.cautionNote}
        </p>
      ) : null}
    </div>
  );
}

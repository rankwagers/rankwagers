"use client";

import { useEffect, useRef } from "react";
import type { QualificationView } from "@/lib/evidence-ui";
import { evidenceUiTokens } from "@/lib/evidence-ui/tokens";
import { trackAnalyticsEvent } from "@/lib/analytics/client";
import { evidenceEventProperties } from "@/lib/evidence-ui/analytics";

function ListBlock({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <h3 className={evidenceUiTokens.label}>{title}</h3>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export function QualificationPanel({
  qualification,
  entity,
  locale,
  country,
}: {
  qualification: QualificationView;
  entity?: string;
  locale?: string;
  country?: string | null;
}) {
  const viewed = useRef(false);
  useEffect(() => {
    if (viewed.current) return;
    viewed.current = true;
    trackAnalyticsEvent({
      event_name: "qualification_view",
      fixture_id: null,
      market: null,
      operator_slug: null,
      locale: locale ?? null,
      user_id: null,
      properties: evidenceEventProperties({ entity, locale, country }),
    });
  }, [country, entity, locale]);

  return (
    <section className={evidenceUiTokens.card} aria-labelledby="qualification-panel">
      <h2 id="qualification-panel" className="font-display text-lg font-semibold text-foreground">
        Qualification
      </h2>
      {(qualification.threshold != null || qualification.difference != null) && (
        <dl className="mt-3 grid gap-2 sm:grid-cols-2">
          {qualification.threshold != null ? (
            <div className={evidenceUiTokens.cardMuted}>
              <dt className={evidenceUiTokens.label}>Threshold</dt>
              <dd className="font-mono font-semibold">{qualification.threshold}%</dd>
            </div>
          ) : null}
          {qualification.difference != null ? (
            <div className={evidenceUiTokens.cardMuted}>
              <dt className={evidenceUiTokens.label}>Difference</dt>
              <dd className="font-mono font-semibold">
                {qualification.difference >= 0 ? "+" : ""}
                {Math.round(qualification.difference)} pp
              </dd>
            </div>
          ) : null}
        </dl>
      )}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <ListBlock title="Included because" items={qualification.included} />
        <ListBlock title="Excluded because" items={qualification.excluded} />
        <ListBlock title="Qualification rules" items={qualification.rules} />
        <ListBlock title="Evidence filters" items={qualification.filters} />
      </div>
    </section>
  );
}

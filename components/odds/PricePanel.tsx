"use client";

import { useId, useState } from "react";
import type { PricePanelRow } from "@/lib/operators/pricePanel.server";
import type { PredictionStrings } from "@/lib/translations/predictionsEn";
import { LocalTime } from "@/components/fixtures/LocalTime";
import { formatDict } from "@/lib/formatDict";
import { trackOperatorAffiliateCtaClick } from "@/lib/analytics/operatorPages";

/*
 * THE PRICE PANEL — data as a door, opened deliberately.
 *
 * The affordance is a quiet chip at row end: the best observed decimal and an
 * arrow. Clicking it opens an INLINE panel — it never navigates, and it never
 * exists when nothing was observed (the caller simply doesn't render this
 * component; there is no empty-panel state in here by construction, rows.length
 * is asserted > 0). Routing to an operator happens only via the visible
 * Continue on a row — server-signed, rel=sponsored, placement `price_panel`.
 * The chip and each Continue are rw3 ghost buttons (they fill green on
 * hover); the tap target is a real button everywhere.
 */
export function PricePanel({
  rows,
  locale,
  p,
}: {
  rows: PricePanelRow[];
  locale: string;
  p: PredictionStrings;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  if (!rows.length) return null;
  const best = rows.reduce((a, b) => (b.decimal > a.decimal ? b : a), rows[0]);

  return (
    <div className="mt-1.5">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={p.ppAria}
        onClick={() => setOpen((v) => !v)}
        className="rw3-ghost min-h-8"
      >
        <span>{best.decimal.toFixed(2)}</span>
        <span aria-hidden>{open ? "×" : "→"}</span>
      </button>
      {open ? (
        <div id={panelId} className="mt-2" style={{ borderTop: "1px solid var(--line)" }}>
          <p className="rw3-label mt-2">{p.ppTitle}</p>
          <ul className="mt-1.5">
            {rows.map((row) => (
              <li
                key={`${row.operatorSlug}:${row.observedAt}`}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2"
                style={{ borderBottom: "1px solid var(--line)" }}
              >
                <span className="min-w-0" style={{ fontSize: 13, fontWeight: 500 }}>
                  {row.operatorName}
                  {row.verified ? (
                    <span className="ml-1.5" style={{ fontSize: 11, color: "var(--muted)" }}>
                      {p.opVerified}
                    </span>
                  ) : null}
                </span>
                <span className="flex shrink-0 items-baseline gap-3">
                  <span className="rw3-meta">
                    <LocalTime iso={row.observedAt} locale={locale} />
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>
                    {row.decimal.toFixed(2)}
                  </span>
                  {row.continueHref ? (
                    <a
                      href={row.continueHref}
                      rel="nofollow sponsored noopener"
                      onClick={() =>
                        trackOperatorAffiliateCtaClick({
                          operatorSlug: row.operatorSlug,
                          locale,
                        })
                      }
                      className="rw3-ghost min-h-8"
                    >
                      {formatDict(p.opContinueCta, { operator: row.operatorName })}
                    </a>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
          <p className="rw3-meta mt-2">
            {p.mktOddsWindowNote} {p.fxOperatorsNote}
          </p>
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { useId, useState } from "react";
import type { PricePanelRow } from "@/lib/operators/pricePanel.server";
import type { PredictionStrings } from "@/lib/translations/predictionsEn";
import { LocalTime } from "@/components/fixtures/LocalTime";
import { formatDict } from "@/lib/dictionaryExtras";
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
 * Hover affects the chip only where hover exists (the hover gate); the tap
 * target is a real button everywhere.
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
        className="rw-m inline-flex min-h-8 items-center gap-1.5 border border-[var(--hero-line)] px-2.5 text-[var(--hero-ink-2)] transition-colors [@media(hover:hover)]:hover:border-[var(--hero-ink)] [@media(hover:hover)]:hover:text-[var(--hero-ink)] active:border-[var(--hero-ink)]"
      >
        <span className="rw-tnum font-bold text-[var(--hero-ink)]">
          {best.decimal.toFixed(2)}
        </span>
        <span aria-hidden>{open ? "×" : "→"}</span>
      </button>
      {open ? (
        <div id={panelId} className="mt-2 border-t border-[var(--hero-line)]">
          <p className="rw-m mt-2 text-[var(--hero-ink-2)]">{p.ppTitle}</p>
          <ul className="mt-1.5">
            {rows.map((row) => (
              <li
                key={`${row.operatorSlug}:${row.observedAt}`}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-[var(--hero-line)] py-2"
              >
                <span className="min-w-0 text-sm text-[var(--hero-ink)]">
                  {row.operatorName}
                  {row.verified ? (
                    <span className="rw-m ml-1.5 text-[var(--hero-ink-2)]">{p.opVerified}</span>
                  ) : null}
                </span>
                <span className="flex shrink-0 items-baseline gap-3">
                  <span className="rw-m text-[var(--hero-ink-2)]">
                    <LocalTime iso={row.observedAt} locale={locale} />
                  </span>
                  <span className="rw-tnum text-[15px] font-bold text-[var(--hero-ink)]">
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
                      className="rw-m inline-flex min-h-8 items-center border border-[var(--hero-ink)] px-2.5 text-[var(--hero-ink)] transition-colors [@media(hover:hover)]:hover:bg-[var(--hero-ink)] [@media(hover:hover)]:hover:text-[var(--hero-canvas)] active:bg-[var(--hero-ink)] active:text-[var(--hero-canvas)]"
                    >
                      {formatDict(p.opContinueCta, { operator: row.operatorName })}
                    </a>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
          <p className="rw-m mt-2 normal-case tracking-[0.04em] text-[var(--hero-ink-2)]">
            {p.mktOddsWindowNote} {p.fxOperatorsNote}
          </p>
        </div>
      ) : null}
    </div>
  );
}

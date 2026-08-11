"use client";

import { useEffect, useState } from "react";
import { useAcca } from "./AccaProvider";
import { trackAccaEvent } from "@/lib/acca/analytics";
import type { AccaOperatorOffer } from "@/lib/acca/types";
import type { PredictionStrings } from "@/lib/translations/predictionsEn";
import { formatDict } from "@/lib/dictionaryExtras";

/*
 * THE SLIP-COMPLETE OPERATOR CHOICE — the hottest intent moment, kept calm.
 * Availability-first, verified-first rows (the server orders; the client only
 * renders). Observed publication odds appear per operator where the stored
 * history holds them — no observation, no figures (never a dash). One
 * Continue per operator, visibly commercial; the detail link goes to the
 * canonical operator page.
 */
export function AccaOperators({ locale, p }: { locale: string; p: PredictionStrings }) {
  const { slip } = useAcca();
  const [offers, setOffers] = useState<AccaOperatorOffer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!slip.selections.length) {
      setOffers([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetch("/api/acca/operators", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        locale,
        slipId: slip.id,
        stake: slip.stake,
        selections: slip.selections.map((s) => ({
          matchId: s.matchId,
          marketKey: s.marketKey,
          odds: s.odds,
          kickoffAt: s.kickoffAt,
        })),
      }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("operators_failed");
        return (await res.json()) as { operators: AccaOperatorOffer[] };
      })
      .then((data) => {
        if (!cancelled) setOffers(data.operators ?? []);
      })
      .catch(() => {
        if (!cancelled) setError("failed");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [locale, slip.id, slip.stake, slip.selections]);

  if (!slip.selections.length) return null;

  return (
    <section
      aria-labelledby="acca-operators-heading"
      className="mt-5 border-t border-[var(--hero-line)] pt-4"
    >
      <h3 id="acca-operators-heading" className="rw-m text-[var(--hero-ink-2)]">
        {p.acOperatorsTitle}
      </h3>
      <p className="mt-1 text-xs leading-relaxed text-[var(--hero-ink-2)]">
        {p.acOperatorsNote}
      </p>
      {loading ? (
        <p className="rw-m mt-3 text-[var(--hero-ink-2)]" role="status">
          {p.acOperatorsLoading}
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 text-xs text-[var(--hero-ink-2)]" role="alert">
          {p.acOperatorsError}
        </p>
      ) : null}
      <ul className="mt-3 border-t border-[var(--hero-line)]">
        {offers.map((op) => (
          <li
            key={op.slug}
            className="border-b border-[var(--hero-line)] py-3 pl-1"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <div className="min-w-0">
                <p className="text-sm font-semibold tracking-[-0.01em] text-[var(--hero-ink)]">
                  {op.name}
                </p>
                <p className="rw-m mt-0.5 text-[var(--hero-ink-2)]">
                  {op.available ? p.acAvailable : p.acUnavailable}
                  {op.verified ? ` · ${p.opVerified}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <a
                  href={op.detailHref}
                  className="rw-m inline-flex min-h-9 items-center border border-[var(--hero-line)] px-2.5 text-[var(--hero-ink-2)] transition-colors hover:border-[var(--hero-ink)] hover:text-[var(--hero-ink)]"
                >
                  {p.acDetailLink}
                </a>
                {op.available && op.signedHref ? (
                  <a
                    href={op.signedHref}
                    rel="nofollow sponsored noopener"
                    className="rw-m inline-flex min-h-9 items-center border border-[var(--hero-ink)] px-3 text-[var(--hero-ink)] transition-colors hover:bg-[var(--hero-ink)] hover:text-[var(--hero-canvas)]"
                    onClick={() => {
                      trackAccaEvent("acca_operator_selected", {
                        locale,
                        slip,
                        operator_slug: op.slug,
                      });
                      trackAccaEvent("acca_affiliate_handoff", {
                        locale,
                        slip,
                        operator_slug: op.slug,
                      });
                    }}
                  >
                    {formatDict(p.opContinueCta, { operator: op.name })}
                  </a>
                ) : null}
              </div>
            </div>
            {op.observedOdds.length > 0 ? (
              <ul className="mt-2 space-y-0.5">
                {op.observedOdds.map((row, i) => (
                  <li
                    key={`${row.market}:${i}`}
                    className="rw-m flex items-baseline justify-between gap-x-3 text-[var(--hero-ink-2)]"
                  >
                    <span>{row.market}</span>
                    <span className="rw-tnum font-bold text-[var(--hero-ink)]">
                      {row.decimal.toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
      <p className="rw-m mt-3 normal-case tracking-[0.04em] text-[var(--hero-ink-2)]">
        {p.fxOperatorsNote}
      </p>
    </section>
  );
}

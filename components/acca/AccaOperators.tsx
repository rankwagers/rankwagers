"use client";

import { useEffect, useState } from "react";
import { useAcca } from "./AccaProvider";
import { trackAccaEvent } from "@/lib/acca/analytics";
import type { AccaOperatorOffer } from "@/lib/acca/types";

export function AccaOperators({ locale }: { locale: string }) {
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
        if (!cancelled) setError("Operator offers unavailable right now.");
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
    <section aria-labelledby="acca-operators-heading" className="mt-5 border-t border-border pt-4">
      <h3 id="acca-operators-heading" className="text-sm font-semibold text-foreground">
        Choose an operator
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        RankWagers does not place bets. CTAs open a partner site via a secure server redirect.
      </p>
      {loading ? (
        <p className="mt-3 text-xs text-muted-foreground" role="status">
          Loading operators…
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 text-xs text-[var(--red-primary)]" role="alert">
          {error}
        </p>
      ) : null}
      <ul className="mt-3 space-y-2">
        {offers.map((op) => (
          <li
            key={op.slug}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-[var(--canvas-secondary)] px-3 py-2"
          >
            <div>
              <p className="text-sm font-semibold text-foreground">{op.name}</p>
              <p className="text-metadata text-muted-foreground">{op.availabilityNote}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href={op.reviewHref}
                className="inline-flex min-h-9 items-center rounded-md border border-border px-2.5 text-xs font-medium"
              >
                Review
              </a>
              {op.signedHref ? (
                <a
                  href={op.signedHref}
                  rel="nofollow sponsored noopener"
                  className="btn-primary btn-sm min-h-9"
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
                  Continue
                </a>
              ) : (
                <span className="text-xs text-muted-foreground">Unavailable</span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

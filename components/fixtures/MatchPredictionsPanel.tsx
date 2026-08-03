"use client";

import { useState } from "react";
import Link from "next/link";
import type { MatchPredictionView } from "@/lib/fixtures/types";
import {
  trackMatchEvidenceViewed,
  trackMatchPredictionExpanded,
} from "@/lib/fixtures/analytics";
import { AddToAccaButton } from "@/components/acca/AddToAccaButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { fixturePath } from "@/lib/fixtures/paths";
import { resolveAccaMarketKey } from "@/lib/acca/markets";

function statusTone(status: MatchPredictionView["status"]): string {
  switch (status) {
    case "won":
      return "bg-[var(--status-won-bg)] text-[var(--status-won-fg)]";
    case "lost":
      return "bg-[var(--status-lost-bg)] text-[var(--status-lost-fg)]";
    case "void":
    case "push":
    case "cancelled":
      return "bg-[var(--status-void-bg)] text-[var(--status-void-fg)]";
    default:
      return "bg-[var(--status-pending-bg)] text-[var(--status-pending-fg)]";
  }
}

export function MatchPredictionsPanel({
  matchId,
  locale,
  predictions,
  focusMarket,
  homeTeam,
  awayTeam,
  competition,
  competitionSlug,
  country,
  kickoffAt,
}: {
  matchId: number;
  locale: string;
  predictions: MatchPredictionView[];
  focusMarket: string | null;
  homeTeam: string;
  awayTeam: string;
  competition: string;
  competitionSlug: string | null;
  country: string;
  kickoffAt: string | null;
}) {
  const [openId, setOpenId] = useState<string | null>(
    predictions.find((p) => p.marketKey === focusMarket)?.id ?? predictions[0]?.id ?? null
  );

  if (!predictions.length) {
    return (
      <EmptyState
        title="No predictions yet"
        description="No publishable predictions are available for supported markets on this fixture."
      />
    );
  }

  return (
    <div className="space-y-3">
      {predictions.map((prediction) => {
        const open = openId === prediction.id;
        return (
          <article
            key={prediction.id}
            className="rounded-lg border border-border bg-[var(--canvas-secondary)]"
          >
            <button
              type="button"
              className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left"
              aria-expanded={open}
              onClick={() => {
                const next = open ? null : prediction.id;
                setOpenId(next);
                if (next) {
                  trackMatchPredictionExpanded({
                    matchId,
                    locale,
                    market: prediction.marketKey,
                  });
                  trackMatchEvidenceViewed({
                    matchId,
                    locale,
                    market: prediction.marketKey,
                  });
                }
              }}
            >
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {prediction.marketLabel}
                </p>
                <p className="mt-0.5 text-xs text-[var(--hero-ink-3)]">
                  Selection: {prediction.selection}
                </p>
                {/*
                  This figure is FootyStats' market potential, archived as published (§3.11 — it
                  is not removed). It was labelled "Confidence", which it is not: it is a provider
                  potential, it is not our model's output, and the archived record holds no
                  denominator for it. Saying so in one line is honest; implying a sample it never
                  had is not.
                */}
                {prediction.confidence != null ? (
                  <p className="mt-1.5 text-xs text-[var(--hero-ink-3)]">
                    <span className="rw-mono rw-tnum">
                      Provider potential {prediction.confidence}%
                    </span>{" "}
                    — FootyStats&apos; figure as published. Not a confidence, and the archived
                    record carries no sample for it.
                  </p>
                ) : null}
              </div>
              <span
                className={`shrink-0 rounded-md px-2 py-1 text-metadata font-semibold uppercase tracking-label ${statusTone(prediction.status)}`}
              >
                {prediction.status}
              </span>
            </button>
            {open ? (
              <div className="border-t border-[var(--border-subtle)] px-4 py-4 text-sm">
                <dl className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <dt className="text-metadata uppercase tracking-label text-muted-foreground">
                      Published
                    </dt>
                    <dd className="font-mono text-xs">
                      {prediction.publishedAt
                        ? new Date(prediction.publishedAt).toLocaleString()
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-metadata uppercase tracking-label text-muted-foreground">
                      Odds at publication
                    </dt>
                    <dd className="font-mono text-xs">
                      {prediction.originalOdds != null
                        ? prediction.originalOdds.toFixed(2)
                        : "Unavailable"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-metadata uppercase tracking-label text-muted-foreground">
                      Unit P/L
                    </dt>
                    <dd className="font-mono text-xs">
                      {prediction.unitProfit == null
                        ? "—"
                        : prediction.unitProfit > 0
                          ? `+${prediction.unitProfit.toFixed(2)}u`
                          : `${prediction.unitProfit.toFixed(2)}u`}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-metadata uppercase tracking-label text-muted-foreground">
                      Settlement
                    </dt>
                    <dd className="text-xs text-[var(--ink-secondary)]">
                      {prediction.settlementReason}
                    </dd>
                  </div>
                </dl>

                {prediction.evidenceSummary.length ? (
                  <div className="mt-4">
                    <h3 className="text-metadata font-semibold uppercase tracking-label text-muted-foreground">
                      Evidence at publication
                    </h3>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-[var(--ink-secondary)]">
                      {prediction.evidenceSummary.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {resolveAccaMarketKey(prediction.marketKey) ? (
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <AddToAccaButton
                      draft={{
                        matchId,
                        homeTeam,
                        awayTeam,
                        competition,
                        competitionSlug,
                        countryCode: country || null,
                        kickoffAt,
                        marketKey: prediction.marketKey,
                        selectionKey: prediction.selection
                          .toLowerCase()
                          .replace(/\s+/g, "_")
                          .slice(0, 40),
                        selectionLabel: prediction.selection,
                        odds: prediction.currentOdds ?? prediction.originalOdds,
                        confidence: prediction.confidence,
                        evidenceSummary: prediction.evidenceSummary,
                        publishedAt: prediction.publishedAt,
                        status: prediction.status,
                        matchHref: fixturePath(
                          locale,
                          matchId,
                          prediction.marketKey,
                          "match_detail"
                        ),
                        source: "match_detail",
                      }}
                    />
                    <Link
                      href={`/${locale}/acca/builder`}
                      className="text-xs font-semibold text-brand hover:underline"
                    >
                      Build Acca automatically
                    </Link>
                  </div>
                ) : null}

                <div className="mt-4">
                  <h3 className="text-metadata font-semibold uppercase tracking-label text-muted-foreground">
                    Prediction timeline
                  </h3>
                  <ol className="mt-2 space-y-2 border-l border-border pl-4">
                    {prediction.timeline.map((item) => (
                      <li key={item.id} className="text-xs">
                        <p className="font-medium text-foreground">{item.label}</p>
                        {item.at ? (
                          <time
                            dateTime={item.at}
                            className="font-mono text-metadata text-muted-foreground"
                          >
                            {new Date(item.at).toLocaleString()}
                          </time>
                        ) : (
                          <p className="text-metadata text-muted-foreground">Time unavailable</p>
                        )}
                        {item.detail ? (
                          <p className="mt-0.5 text-[var(--ink-secondary)]">{item.detail}</p>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

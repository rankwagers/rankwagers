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

/* Settlement coloring in the rw3 grammar: won/lost carry --win/--loss, the
   unscored states are muted, pending is plain text. */
function statusTone(status: MatchPredictionView["status"]): string {
  switch (status) {
    case "won":
      return "var(--win)";
    case "lost":
      return "var(--loss)";
    case "void":
    case "push":
    case "cancelled":
      return "var(--muted)";
    default:
      return "var(--text)";
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
            style={{
              border: "1px solid var(--line)",
              borderRadius: 6,
              background: "var(--surface)",
            }}
          >
            <button
              type="button"
              className="rw3-hoverable flex w-full items-start justify-between gap-3 px-4 py-3 text-left"
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
                <p style={{ fontSize: 14, fontWeight: 600 }}>
                  {prediction.marketLabel}
                </p>
                <p className="rw3-meta mt-0.5">
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
                  <p className="rw3-meta mt-1.5">
                    <span style={{ color: "var(--text)", fontWeight: 600 }}>
                      Provider potential {prediction.confidence}%
                    </span>{" "}
                    — FootyStats&apos; figure as published. Not a confidence, and the archived
                    record carries no sample for it.
                  </p>
                ) : null}
              </div>
              <span
                className="rw3-pill shrink-0"
                style={{
                  color: statusTone(prediction.status),
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                {prediction.status}
              </span>
            </button>
            {open ? (
              <div
                className="px-4 py-4"
                style={{ borderTop: "1px solid var(--line)", fontSize: 13 }}
              >
                <dl className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <dt className="rw3-label">
                      Published
                    </dt>
                    <dd style={{ fontSize: 12 }}>
                      {prediction.publishedAt
                        ? new Date(prediction.publishedAt).toLocaleString()
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="rw3-label">
                      Odds at publication
                    </dt>
                    <dd style={{ fontSize: 12 }}>
                      {prediction.originalOdds != null
                        ? prediction.originalOdds.toFixed(2)
                        : "Unavailable"}
                    </dd>
                  </div>
                  <div>
                    <dt className="rw3-label">
                      Unit P/L
                    </dt>
                    <dd style={{ fontSize: 12 }}>
                      {prediction.unitProfit == null
                        ? "—"
                        : prediction.unitProfit > 0
                          ? `+${prediction.unitProfit.toFixed(2)}u`
                          : `${prediction.unitProfit.toFixed(2)}u`}
                    </dd>
                  </div>
                  <div>
                    <dt className="rw3-label">
                      Settlement
                    </dt>
                    <dd className="rw3-meta">
                      {prediction.settlementReason}
                    </dd>
                  </div>
                </dl>

                {prediction.evidenceSummary.length ? (
                  <div className="mt-4">
                    <h3 className="rw3-label">
                      Evidence at publication
                    </h3>
                    <ul className="rw3-meta mt-2 list-disc space-y-1 pl-5">
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
                      className="hover:underline"
                      style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)" }}
                    >
                      Build Acca automatically
                    </Link>
                  </div>
                ) : null}

                <div className="mt-4">
                  <h3 className="rw3-label">
                    Prediction timeline
                  </h3>
                  <ol
                    className="mt-2 space-y-2 pl-4"
                    style={{ borderLeft: "1px solid var(--line)" }}
                  >
                    {prediction.timeline.map((item) => (
                      <li key={item.id} style={{ fontSize: 12 }}>
                        <p className="font-medium">{item.label}</p>
                        {item.at ? (
                          <time dateTime={item.at} className="rw3-meta">
                            {new Date(item.at).toLocaleString()}
                          </time>
                        ) : (
                          <p className="rw3-meta">Time unavailable</p>
                        )}
                        {item.detail ? (
                          <p className="rw3-meta mt-0.5">{item.detail}</p>
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

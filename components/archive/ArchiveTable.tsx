"use client";

import Link from "next/link";
import type { ArchivePredictionRecord } from "@/lib/archive/types";
import { StatusBadge } from "@/components/homepage/sectionChrome";
import { trackArchiveEvent } from "@/lib/archive/analytics";

export function ArchiveTable({
  records,
  locale,
  emptyText = "No archived predictions match these filters.",
}: {
  records: ArchivePredictionRecord[];
  locale: string;
  emptyText?: string;
}) {
  if (!records.length) {
    return (
      <p
        className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground"
        role="status"
      >
        {emptyText}
      </p>
    );
  }

  return (
    <div className="table-shell">
      <table className="table-base">
        <caption className="sr-only">
          Archived qualified-list predictions with publication time, kickoff,
          market, confidence, evidence, and settlement outcome
        </caption>
        <thead>
          <tr>
            <th scope="col">
              Match
            </th>
            <th scope="col">
              Market
            </th>
            <th scope="col">
              Model %
            </th>
            <th scope="col">
              Result
            </th>
            <th scope="col">
              Score
            </th>
            <th scope="col">
              Timing
            </th>
          </tr>
        </thead>
        <tbody>
          {records.map((row) => (
            <tr
              key={row.id}
              className="align-top"
            >
              <td className="py-3">
                <Link
                  href={row.matchHref}
                  className="font-medium text-brand hover:underline"
                  onClick={() =>
                    trackArchiveEvent("archive_prediction_opened", {
                      locale,
                      properties: {
                        match_id: row.matchId,
                        market: row.marketKey,
                        date: row.date,
                      },
                    })
                  }
                >
                  {row.homeTeam} vs {row.awayTeam}
                </Link>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {row.competition}
                  {row.country ? ` · ${row.country}` : ""}
                </p>
                <details className="mt-2 text-xs text-[var(--ink-secondary)]">
                  <summary className="cursor-pointer font-medium text-foreground">
                    Settlement &amp; evidence
                  </summary>
                  <p className="mt-1">{row.settlementReason}</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4">
                    {row.evidenceSummary.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                  <p className="mt-1 text-muted-foreground">
                    Original odds: unavailable · Unit P/L: unavailable
                  </p>
                </details>
              </td>
              <td className="py-3">
                <p>{row.marketLabel}</p>
                <p className="text-xs text-muted-foreground">{row.selectionLabel}</p>
              </td>
              <td className="table-num py-3">
                {row.confidence != null ? `${row.confidence}%` : "—"}
              </td>
              <td className="py-3">
                <StatusBadge status={row.status} label={row.status} />
              </td>
              <td className="py-3 font-mono text-xs">{row.scoreLabel}</td>
              <td className="py-3 text-xs text-muted-foreground">
                <p>
                  <span className="font-medium text-foreground">Archive </span>
                  {row.date}
                </p>
                <p className="mt-1">
                  Kickoff{" "}
                  {row.kickoffAt
                    ? new Date(row.kickoffAt).toLocaleString()
                    : "—"}
                </p>
                <p className="mt-1">
                  Published{" "}
                  {row.publishedAt
                    ? new Date(row.publishedAt).toLocaleString()
                    : "—"}
                </p>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

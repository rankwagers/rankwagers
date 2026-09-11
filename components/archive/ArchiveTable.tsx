"use client";

import Link from "next/link";
import type { ArchivePredictionRecord } from "@/lib/archive/types";
import type { PredictionStrings } from "@/lib/translations/predictionsEn";
import { StatusBadge } from "@/components/homepage/sectionChrome";
import { LocalTime } from "@/components/fixtures/LocalTime";
import { trackArchiveEvent } from "@/lib/archive/analytics";

/*
 * THE ARCHIVE TABLE — rw3 conversion. Ruled rows on the v3 line, 11px column
 * labels, the pct chip for the provider potential. Truth laws: a null figure
 * omits its line rather than printing a dash; times render through LocalTime
 * (viewer-local, SSR UTC — one clock); the potential column carries the
 * provider label, never a confidence; the absent odds/P&L are stated in
 * words, not dashed cells.
 */
export function ArchiveTable({
  records,
  locale,
  p,
  emptyText,
}: {
  records: ArchivePredictionRecord[];
  locale: string;
  p: PredictionStrings;
  emptyText?: string;
}) {
  if (!records.length) {
    return (
      <p
        className="max-w-[52ch] py-1 pl-5 text-[13px]"
        style={{ borderLeft: "2px solid var(--line)", color: "var(--muted)" }}
        role="status"
      >
        {emptyText ?? p.arcTableEmpty}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-[13px]" style={{ borderTop: "1px solid var(--line)" }}>
        <caption className="sr-only">
          {p.arcIndexTitle}: {p.arcTableMatch}, {p.arcTableMarket}, {p.heroTablePotential},{" "}
          {p.arcTableResult}, {p.arcTableScore}, {p.arcTableTiming}
        </caption>
        <thead>
          <tr className="rw3-label text-left" style={{ borderBottom: "1px solid var(--line)" }}>
            <th scope="col" className="py-2.5 pl-3.5 pr-3">
              {p.arcTableMatch}
            </th>
            <th scope="col" className="py-2.5 pr-3">
              {p.arcTableMarket}
            </th>
            <th scope="col" className="py-2.5 pr-3">
              {p.heroTablePotential}
            </th>
            <th scope="col" className="py-2.5 pr-3">
              {p.arcTableResult}
            </th>
            <th scope="col" className="py-2.5 pr-3">
              {p.arcTableScore}
            </th>
            <th scope="col" className="py-2.5">
              {p.arcTableTiming}
            </th>
          </tr>
        </thead>
        <tbody>
          {records.map((row) => (
            <tr
              key={row.id}
              className="rw3-hoverable align-top"
              style={{ borderBottom: "1px solid var(--line)" }}
            >
              <td className="py-3 pl-3.5 pr-3">
                <Link
                  href={row.matchHref}
                  className="text-[14px] font-semibold underline-offset-4 hover:underline"
                  style={{ color: "var(--text)" }}
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
                <p className="rw3-meta mt-1">
                  {row.competition}
                  {row.country ? ` · ${row.country}` : ""}
                </p>
                <details className="mt-2 text-[12px]" style={{ color: "var(--muted)" }}>
                  <summary
                    className="cursor-pointer font-medium"
                    style={{ color: "var(--text)" }}
                  >
                    {p.arcSettlementSummary}
                  </summary>
                  <p className="mt-1">{row.settlementReason}</p>
                  <ul
                    className="mt-1 space-y-0.5 pl-3"
                    style={{ borderLeft: "1px solid var(--line)" }}
                  >
                    {row.evidenceSummary.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                  <p className="mt-1">{p.arcOddsRowUnavailable}</p>
                </details>
              </td>
              <td className="py-3 pr-3">
                <p style={{ color: "var(--text)" }}>{row.marketLabel}</p>
                <p className="rw3-meta mt-0.5">{row.selectionLabel}</p>
              </td>
              <td className="py-3 pr-3">
                {row.confidence != null ? (
                  <>
                    <span className="rw3-pct">{row.confidence}%</span>
                    <span className="rw3-meta mt-1 block">{p.rankedPotentialLabel}</span>
                  </>
                ) : null}
              </td>
              <td className="py-3 pr-3">
                <StatusBadge status={row.status} label={row.status} />
              </td>
              <td className="py-3 pr-3 text-[12px]" style={{ color: "var(--text)" }}>
                {row.scoreLabel}
              </td>
              <td className="py-3 text-[12px]" style={{ color: "var(--muted)" }}>
                <p>
                  <span className="rw3-label" style={{ color: "var(--text)" }}>
                    {p.arcArchiveLabel}
                  </span>{" "}
                  {row.date}
                </p>
                {row.kickoffAt ? (
                  <p className="mt-1">
                    <span className="rw3-label">{p.arcKickoffLabel}</span>{" "}
                    <LocalTime iso={row.kickoffAt} locale={locale} />
                  </p>
                ) : null}
                {row.publishedAt ? (
                  <p className="mt-1">
                    <span className="rw3-label">{p.arcPublishedLabel}</span>{" "}
                    <LocalTime iso={row.publishedAt} locale={locale} />
                  </p>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

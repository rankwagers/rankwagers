"use client";

import Link from "next/link";
import type { ArchivePredictionRecord } from "@/lib/archive/types";
import type { PredictionStrings } from "@/lib/translations/predictionsEn";
import { StatusBadge } from "@/components/homepage/sectionChrome";
import { LocalTime } from "@/components/fixtures/LocalTime";
import { trackArchiveEvent } from "@/lib/archive/analytics";

/*
 * THE ARCHIVE TABLE — form-guide conversion. Ruled rows, mono labels, the
 * monochrome StatusBadge. Truth laws: a null figure omits its line rather
 * than printing a dash; times render through LocalTime (viewer-local, SSR
 * UTC — one clock); the potential column carries the provider label, never a
 * confidence; the absent odds/P&L are stated in words, not dashed cells.
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
        className="max-w-[52ch] border-l-2 border-[var(--hero-line)] py-1 pl-5 text-[15px] text-[var(--hero-ink-2)]"
        role="status"
      >
        {emptyText ?? p.arcTableEmpty}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-t-[1.5px] border-[var(--hero-ink)] text-sm">
        <caption className="sr-only">
          {p.arcIndexTitle}: {p.arcTableMatch}, {p.arcTableMarket}, {p.heroTablePotential},{" "}
          {p.arcTableResult}, {p.arcTableScore}, {p.arcTableTiming}
        </caption>
        <thead>
          <tr className="rw-label border-b border-[var(--hero-line)] text-left text-[var(--hero-ink-2)]">
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
            <tr key={row.id} className="rw-row border-b border-[var(--hero-line)] align-top">
              <td className="py-3 pl-3.5 pr-3">
                <Link
                  href={row.matchHref}
                  className="font-semibold tracking-[-0.01em] text-[var(--hero-ink)] underline decoration-[var(--hero-line)] underline-offset-4 hover:decoration-[var(--hero-ink)]"
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
                <p className="rw-m mt-1 text-[var(--hero-ink-2)]">
                  {row.competition}
                  {row.country ? ` · ${row.country}` : ""}
                </p>
                <details className="mt-2 text-xs text-[var(--hero-ink-2)]">
                  <summary className="cursor-pointer font-medium text-[var(--hero-ink)]">
                    {p.arcSettlementSummary}
                  </summary>
                  <p className="mt-1">{row.settlementReason}</p>
                  <ul className="mt-1 space-y-0.5 border-l border-[var(--hero-line)] pl-3">
                    {row.evidenceSummary.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                  <p className="mt-1">{p.arcOddsRowUnavailable}</p>
                </details>
              </td>
              <td className="py-3 pr-3">
                <p className="text-[var(--hero-ink)]">{row.marketLabel}</p>
                <p className="rw-m mt-0.5 text-[var(--hero-ink-2)]">{row.selectionLabel}</p>
              </td>
              <td className="py-3 pr-3">
                {row.confidence != null ? (
                  <>
                    <span className="rw-tnum font-bold text-[var(--hero-ink)]">
                      {row.confidence}%
                    </span>
                    <span className="rw-m block text-[var(--hero-ink-2)]">
                      {p.rankedPotentialLabel}
                    </span>
                  </>
                ) : null}
              </td>
              <td className="py-3 pr-3">
                <StatusBadge status={row.status} label={row.status} />
              </td>
              <td className="rw-tnum py-3 pr-3 font-mono text-xs text-[var(--hero-ink)]">
                {row.scoreLabel}
              </td>
              <td className="py-3 text-xs text-[var(--hero-ink-2)]">
                <p>
                  <span className="rw-m text-[var(--hero-ink)]">{p.arcArchiveLabel}</span>{" "}
                  {row.date}
                </p>
                {row.kickoffAt ? (
                  <p className="mt-1">
                    <span className="rw-m">{p.arcKickoffLabel}</span>{" "}
                    <LocalTime iso={row.kickoffAt} locale={locale} />
                  </p>
                ) : null}
                {row.publishedAt ? (
                  <p className="mt-1">
                    <span className="rw-m">{p.arcPublishedLabel}</span>{" "}
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

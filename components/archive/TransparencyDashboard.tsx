import type { TransparencyMetrics } from "@/lib/archive/types";
import Link from "next/link";
import { methodologyPath } from "@/lib/archive/links";
import type { PredictionStrings } from "@/lib/translations/predictionsEn";
import { formatDict } from "@/lib/dictionaryExtras";
import { LocalTime } from "@/components/fixtures/LocalTime";

/*
 * THE VERIFIED RECORD — rw3 conversion of the transparency dashboard.
 * Truth laws: the hit rate renders paired with its own fraction and the
 * percentage is COMPUTED from the printed fraction (pairing by construction);
 * count rows with a zero omit themselves; the absent odds/ROI figures are a
 * stated sentence, never an "Unavailable" metric cell dressed as data; the
 * update stamp renders through LocalTime (one clock).
 */
export function TransparencyDashboard({
  metrics,
  locale,
  p,
  headingId = "transparency-heading",
}: {
  metrics: TransparencyMetrics;
  locale: string;
  p: PredictionStrings;
  headingId?: string;
}) {
  const settled = metrics.settledPredictions;
  /* Pairing by construction: the printed pct is computed from the printed fraction. */
  const pairedPct = settled > 0 ? Math.round((metrics.won / settled) * 100) : null;

  return (
    <section
      aria-labelledby={headingId}
      data-analytics-section="transparency"
      className="pt-6"
      style={{ borderTop: "1px solid var(--line)" }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 id={headingId} className="rw3-label">
            {p.arcRecordTitle}
          </h2>
          <p className="rw3-meta mt-1">{metrics.windowLabel}</p>
        </div>
        <Link
          href={methodologyPath(locale)}
          className="rw3-meta underline underline-offset-4 hover:text-[var(--text)]"
        >
          {p.cmpMethodologyLink}
        </Link>
      </div>

      {metrics.availability === "unavailable" ? (
        <p
          className="mt-4 max-w-[52ch] py-1 pl-5 text-[13px]"
          style={{ borderLeft: "2px solid var(--line)", color: "var(--muted)" }}
          role="status"
        >
          {metrics.sampleNote}
        </p>
      ) : (
        <>
          {settled > 0 && pairedPct !== null ? (
            <p className="mt-5 max-w-[52ch] text-[14px] font-semibold">
              {formatDict(p.arcLeadLine, {
                settled: String(settled),
                won: String(metrics.won),
                lost: String(metrics.lost),
                pct: String(pairedPct),
              })}
            </p>
          ) : null}
          <ul className="mt-5" style={{ borderTop: "1px solid var(--line)" }}>
            <li
              className="py-2.5 pl-3.5 text-[13px]"
              style={{ borderBottom: "1px solid var(--line)" }}
            >
              {formatDict(p.arcTotalLine, { n: String(metrics.totalPredictions) })}
            </li>
            {settled > 0 ? (
              <li
                className="py-2.5 pl-3.5 text-[13px]"
                style={{ borderBottom: "1px solid var(--line)" }}
              >
                {formatDict(p.arcSettledLine, { n: String(settled) })}
              </li>
            ) : null}
            {metrics.pendingPredictions > 0 ? (
              <li
                className="py-2.5 pl-3.5 text-[13px]"
                style={{ borderBottom: "1px solid var(--line)" }}
              >
                {formatDict(p.arcPendingLine, { n: String(metrics.pendingPredictions) })}
              </li>
            ) : null}
            {metrics.voidPredictions > 0 ? (
              <li
                className="py-2.5 pl-3.5 text-[13px]"
                style={{ borderBottom: "1px solid var(--line)" }}
              >
                {formatDict(p.arcVoidLine, { n: String(metrics.voidPredictions) })}
              </li>
            ) : null}
          </ul>
          <p className="rw3-meta mt-3">{p.arcOddsUnavailable}</p>
          {metrics.lastUpdatedAt ? (
            <p className="rw3-meta mt-1.5">
              {p.arcLastUpdateLabel}: <LocalTime iso={metrics.lastUpdatedAt} locale={locale} />
            </p>
          ) : null}
          <p
            className="mt-3 max-w-[52ch] text-[13px] leading-relaxed"
            style={{ color: "var(--muted)" }}
          >
            {metrics.sampleNote}
          </p>

          {metrics.byMarket.length ? (
            <div className="mt-7">
              <h3 className="rw3-label">{p.arcByMarketTitle}</h3>
              <ul className="mt-2.5" style={{ borderTop: "1px solid var(--line)" }}>
                {metrics.byMarket.map((row) => (
                  <li
                    key={row.marketKey}
                    className="rw3-hoverable flex flex-wrap items-baseline justify-between gap-x-4 py-2.5 pl-3.5 text-[13px]"
                    style={{ borderBottom: "1px solid var(--line)" }}
                  >
                    <span style={{ color: "var(--text)" }}>{row.marketLabel}</span>
                    <span className="rw3-meta">
                      {formatDict(p.arcByMarketRow, {
                        won: String(row.won),
                        lost: String(row.lost),
                        pending: String(row.pending),
                        void: String(row.voided),
                      })}
                      {row.won + row.lost > 0
                        ? ` · ${formatDict(p.arcPairedRate, {
                            won: String(row.won),
                            settled: String(row.won + row.lost),
                            pct: String(Math.round((row.won / (row.won + row.lost)) * 100)),
                          })}`
                        : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {metrics.byCompetition.length ? (
            <div className="mt-7">
              <h3 className="rw3-label">{p.arcByCompetitionTitle}</h3>
              <ul className="mt-2.5" style={{ borderTop: "1px solid var(--line)" }}>
                {metrics.byCompetition.slice(0, 8).map((row) => (
                  <li
                    key={row.competition}
                    className="rw3-hoverable flex flex-wrap items-baseline justify-between gap-x-4 py-2.5 pl-3.5 text-[13px]"
                    style={{ borderBottom: "1px solid var(--line)" }}
                  >
                    <span style={{ color: "var(--text)" }}>{row.competition}</span>
                    <span className="rw3-meta">
                      {formatDict(p.arcRowsN, { n: String(row.total) })}
                      {row.won + row.lost > 0
                        ? ` · ${formatDict(p.arcPairedRate, {
                            won: String(row.won),
                            settled: String(row.won + row.lost),
                            pct: String(Math.round((row.won / (row.won + row.lost)) * 100)),
                          })}`
                        : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

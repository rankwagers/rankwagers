import type { TransparencyMetrics } from "@/lib/archive/types";
import Link from "next/link";
import { methodologyPath } from "@/lib/archive/links";
import type { PredictionStrings } from "@/lib/translations/predictionsEn";
import { formatDict } from "@/lib/dictionaryExtras";
import { LocalTime } from "@/components/fixtures/LocalTime";

/*
 * THE VERIFIED RECORD — form-guide conversion of the transparency dashboard.
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
      className="border-t border-[var(--hero-line)] pt-8"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 id={headingId} className="rw-m text-[var(--hero-ink-2)]">
            {p.arcRecordTitle}
          </h2>
          <p className="rw-m mt-1 normal-case tracking-[0.04em] text-[var(--hero-ink-2)]">
            {metrics.windowLabel}
          </p>
        </div>
        <Link
          href={methodologyPath(locale)}
          className="rw-m text-[var(--hero-ink-2)] underline decoration-[var(--hero-line)] underline-offset-4 hover:text-[var(--hero-ink)]"
        >
          {p.cmpMethodologyLink}
        </Link>
      </div>

      {metrics.availability === "unavailable" ? (
        <p
          className="mt-4 max-w-[52ch] border-l-2 border-[var(--hero-line)] py-1 pl-5 text-[15px] text-[var(--hero-ink-2)]"
          role="status"
        >
          {metrics.sampleNote}
        </p>
      ) : (
        <>
          {settled > 0 && pairedPct !== null ? (
            <p className="rw-h mt-5 max-w-[30ch] text-[clamp(1.35rem,3vw,1.9rem)] text-[var(--hero-ink)]">
              {formatDict(p.arcLeadLine, {
                settled: String(settled),
                won: String(metrics.won),
                lost: String(metrics.lost),
                pct: String(pairedPct),
              })}
            </p>
          ) : null}
          <ul className="mt-5 border-t-[1.5px] border-[var(--hero-ink)]">
            <li className="rw-row border-b border-[var(--hero-line)] py-2.5 pl-3.5 text-[15px] text-[var(--hero-ink)]">
              {formatDict(p.arcTotalLine, { n: String(metrics.totalPredictions) })}
            </li>
            {settled > 0 ? (
              <li className="rw-row border-b border-[var(--hero-line)] py-2.5 pl-3.5 text-[15px] text-[var(--hero-ink)]">
                {formatDict(p.arcSettledLine, { n: String(settled) })}
              </li>
            ) : null}
            {metrics.pendingPredictions > 0 ? (
              <li className="rw-row border-b border-[var(--hero-line)] py-2.5 pl-3.5 text-[15px] text-[var(--hero-ink)]">
                {formatDict(p.arcPendingLine, { n: String(metrics.pendingPredictions) })}
              </li>
            ) : null}
            {metrics.voidPredictions > 0 ? (
              <li className="rw-row border-b border-[var(--hero-line)] py-2.5 pl-3.5 text-[15px] text-[var(--hero-ink)]">
                {formatDict(p.arcVoidLine, { n: String(metrics.voidPredictions) })}
              </li>
            ) : null}
          </ul>
          <p className="rw-m mt-3 normal-case tracking-[0.04em] text-[var(--hero-ink-2)]">
            {p.arcOddsUnavailable}
          </p>
          {metrics.lastUpdatedAt ? (
            <p className="rw-m mt-1.5 normal-case tracking-[0.04em] text-[var(--hero-ink-2)]">
              {p.arcLastUpdateLabel}: <LocalTime iso={metrics.lastUpdatedAt} locale={locale} />
            </p>
          ) : null}
          <p className="mt-3 max-w-[52ch] text-[13px] leading-relaxed text-[var(--hero-ink-2)]">
            {metrics.sampleNote}
          </p>

          {metrics.byMarket.length ? (
            <div className="mt-7">
              <h3 className="rw-label text-[var(--hero-ink-2)]">{p.arcByMarketTitle}</h3>
              <ul className="mt-2.5 border-t border-[var(--hero-line)]">
                {metrics.byMarket.map((row) => (
                  <li
                    key={row.marketKey}
                    className="rw-row flex flex-wrap items-baseline justify-between gap-x-4 border-b border-[var(--hero-line)] py-2.5 pl-3.5 text-sm"
                  >
                    <span className="text-[var(--hero-ink)]">{row.marketLabel}</span>
                    <span className="rw-m text-[var(--hero-ink-2)]">
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
              <h3 className="rw-label text-[var(--hero-ink-2)]">{p.arcByCompetitionTitle}</h3>
              <ul className="mt-2.5 border-t border-[var(--hero-line)]">
                {metrics.byCompetition.slice(0, 8).map((row) => (
                  <li
                    key={row.competition}
                    className="rw-row flex flex-wrap items-baseline justify-between gap-x-4 border-b border-[var(--hero-line)] py-2.5 pl-3.5 text-sm"
                  >
                    <span className="text-[var(--hero-ink)]">{row.competition}</span>
                    <span className="rw-m text-[var(--hero-ink-2)]">
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

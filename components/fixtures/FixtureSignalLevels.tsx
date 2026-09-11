import type { FixtureSignalReport } from "@/lib/fixtureSignals";
import type { PredictionStrings } from "@/lib/translations/predictionsEn";
import {
  signalSentence,
  type SignalTeams,
} from "@/lib/fixtures/signalPresentation";
import { FixtureSignalsExplainer } from "./FixtureSignalsExplainer";
import { PricePanel } from "@/components/odds/PricePanel";
import type { PricePanelData } from "@/lib/operators/pricePanel.server";
import { PRICE_PANEL_MARKET_BY_SIGNAL } from "@/lib/operators/pricePanel.server";

/* ============================================================================
   L1 + L2 — THE LEAD FINDING AND ITS SUPPORTS
   ----------------------------------------------------------------------------
   L1 is one sentence in the lead register: the single strongest signal, its
   numbers inline. A reader with five seconds leaves with it. When nothing
   clears the lead bar the LEVEL IS OMITTED — the empty-state law; a filler
   headline would teach readers to skip the loudest thing on the page.

   L2 is three-to-five rows in one grammar — finding, count, scope, rate,
   baseline — ranked by `lib/fixtureSignals` and explained honestly by the ⓘ.
   Signals are computed once and split by level; nothing prints twice.
   ========================================================================== */

export function FixtureSignalLevels({
  report,
  teams,
  p,
  prices,
  locale,
}: {
  report: FixtureSignalReport;
  teams: SignalTeams;
  p: PredictionStrings;
  /** Observed publication prices by odds-history market — absent market, no affordance. */
  prices?: PricePanelData;
  locale?: string;
}) {
  const { lead, supports } = report;
  if (!lead && supports.length === 0) return null;
  const rowsFor = (market: string) => {
    const key = PRICE_PANEL_MARKET_BY_SIGNAL[market];
    const rows = key && prices ? prices[key] : undefined;
    return rows && rows.length ? rows : null;
  };

  return (
    <section aria-labelledby="fx-signals-heading" className="scroll-mt-24">
      {lead ? (
        <>
          <p className="rw3-label">{p.fxLeadEyebrow}</p>
          <h2
            id="fx-signals-heading"
            className="rw3-title mt-2.5 max-w-[52ch]"
          >
            {signalSentence(lead, teams, p)}
          </h2>
        </>
      ) : (
        <h2 id="fx-signals-heading" className="sr-only">
          {p.fxSupportsTitle}
        </h2>
      )}

      {supports.length > 0 ? (
        <div className={lead ? "mt-8" : ""}>
          <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-3">
            <div>
              <h3 className="rw3-label">{p.fxSupportsTitle}</h3>
              <p
                className="mt-1.5 max-w-[52ch] text-[12px] leading-relaxed"
                style={{ color: "var(--muted)" }}
              >
                {p.fxSupportsDescription}
              </p>
            </div>
            <FixtureSignalsExplainer label={p.fxExplainerLabel} body={p.fxExplainerBody} />
          </div>
          <ul className="mt-4" style={{ borderTop: "1px solid var(--line)" }}>
            {supports.map((signal) => (
              <li
                key={`${signal.scope}-${signal.market}-${signal.window}`}
                className="py-2.5 pl-3.5"
                style={{ borderBottom: "1px solid var(--line)" }}
              >
                <p className="text-[13px] leading-relaxed">
                  {signalSentence(signal, teams, p)}
                </p>
                {rowsFor(signal.market) && locale ? (
                  <PricePanel rows={rowsFor(signal.market)!} locale={locale} p={p} />
                ) : null}
              </li>
            ))}
          </ul>
          {/* THE POST-L2 BRIDGE — one quiet rule-line to L5, an anchor, never a redirect. */}
          <p className="mt-4 pt-3" style={{ borderTop: "1px solid var(--line)" }}>
            <a
              href="#fx-operators-heading"
              className="rw3-ghost"
              data-placement="post_l2_bridge"
            >
              {p.fxBridgeOperators} →
            </a>
          </p>
        </div>
      ) : null}
    </section>
  );
}

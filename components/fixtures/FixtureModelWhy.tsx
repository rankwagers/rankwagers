import { Reveal } from "@/components/motion/Reveal";
import type { FixtureEvidenceView } from "@/lib/fixtures/evidenceView";
import type { FixtureSignal } from "@/lib/fixtureSignals";
import type { PredictionStrings } from "@/lib/translations/predictionsEn";
import type { EvidenceSnapshotView } from "@/types/evidence";
import { formatDict } from "@/lib/dictionaryExtras";
import { signalFinding, type SignalTeams } from "@/lib/fixtures/signalPresentation";

/* ============================================================================
   L3 — THE MODEL'S VIEW, AND WHY
   ----------------------------------------------------------------------------
   The provider potential for the page's market, then Why: the model's own
   scored signals, and one honest sentence about how they meet the ranked
   signals above — including when they DISAGREE. The archive line states what
   was actually captured (snapshot sequence, model version, evidence score,
   signal counts); when no snapshot exists the section says the reading is
   derived live from the same inputs, and claims nothing beyond them.
   Validation language is absent on purpose: settlement has not opened, and
   zero is not a record to narrate.
   ========================================================================== */

export function FixtureModelWhy({
  view,
  potential,
  lead,
  latest,
  teams,
  p,
}: {
  view: FixtureEvidenceView;
  /** The page market's provider potential, already resolved by the loader. */
  potential: { pct: number; marketLabel: string } | null;
  lead: FixtureSignal | null;
  latest: EvidenceSnapshotView | null;
  teams: SignalTeams;
  p: PredictionStrings;
}) {
  const model = view.state === "no_data" ? null : view.model;
  const supporting = model
    ? model.signals.filter((s) => s.direction === "supporting").length
    : 0;
  const opposing = model
    ? model.signals.filter((s) => s.direction === "opposing").length
    : 0;
  const total = model ? model.signals.length : 0;

  /*
   * The reconciliation sentence exists only when there is a lead to reconcile. Agreement is
   * claimed only when the model's scored evidence actually leans with it; anything else states
   * the caution plainly — the disagreement is information, not a blemish to smooth over.
   */
  const reconcile =
    lead && model && total > 0
      ? supporting > opposing && model.qualification === "qualified"
        ? formatDict(p.fxWhyAgrees, {
            supporting: String(supporting),
            total: String(total),
          })
        : lead.direction === "above_baseline"
          ? formatDict(p.fxWhyCaution, {
              finding: signalFinding(lead, p),
              opposing: String(opposing),
              total: String(total),
            })
          : formatDict(p.fxWhyModelCounts, {
              total: String(total),
              supporting: String(supporting),
              opposing: String(opposing),
            })
      : null;

  return (
    <section aria-labelledby="fx-model-heading" className="scroll-mt-24">
      <Reveal index={0}>
        <h2 id="fx-model-heading" className="rw-m text-[var(--hero-ink-2)]">
          {p.fxModelTitle}
        </h2>
        {potential ? (
          <p className="mt-4 flex flex-wrap items-baseline gap-x-3">
            <span className="rw-h rw-tnum text-[clamp(2.125rem,4.4vw,2.875rem)] text-[var(--hero-ink)]">
              {potential.pct}%
            </span>
            <span className="rw-m text-[var(--hero-ink-2)]">{potential.marketLabel}</span>
          </p>
        ) : null}
        {potential ? (
          <p className="mt-2.5 max-w-[52ch] text-[13px] leading-relaxed text-[var(--hero-ink-2)]">
            {formatDict(p.fxModelPotentialLine, {
              pct: String(potential.pct),
              market: potential.marketLabel,
            })}
          </p>
        ) : null}
      </Reveal>

      <div className="mt-10">
        <h3 className="rw-h text-[20px] text-[var(--hero-ink)]">{p.fxWhyTitle}</h3>
        <p className="mt-2 max-w-[52ch] text-[13px] leading-relaxed text-[var(--hero-ink-2)]">
          {p.fxWhyIntro}
        </p>

        {reconcile ? (
          <p className="mt-5 max-w-[62ch] border-l-2 border-[var(--hero-ink)] pl-4 text-[15px] leading-relaxed text-[var(--hero-ink)]">
            {reconcile}
          </p>
        ) : null}

        {model && view.state !== "no_data" ? (
          <ul className="mt-6 border-t border-[var(--hero-line)]">
            {view.signals.map((signal) => (
              <li
                key={signal.key}
                className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-[var(--hero-line)] py-2.5"
              >
                <span className="min-w-0 text-[13px] text-[var(--hero-ink-2)]">{signal.label}</span>
                <span className="rw-m rw-tnum shrink-0 text-[var(--hero-ink)]">
                  {signal.display}
                  {signal.leagueBaseline ? (
                    <span className="text-[var(--hero-ink-2)]">
                      {" "}
                      · {signal.leagueBaseline.display}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        {/* The archive line: what was actually captured, or the honest absence of a capture. */}
        <p className="rw-m mt-6 normal-case tracking-[0.04em] text-[var(--hero-ink-2)]">
          {latest
            ? formatDict(p.fxWhyArchiveLine, {
                seq: String(latest.sequence),
                time: latest.capturedAtLabel,
                version: latest.modelVersion,
                score: String(latest.evidenceScore),
                signals: String(latest.signalCount),
                supporting: String(latest.supportingSignalCount),
                opposing: String(latest.opposingSignalCount),
              })
            : p.fxWhyArchiveNone}
        </p>
      </div>
    </section>
  );
}

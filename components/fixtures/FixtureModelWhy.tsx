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
  /*
   * ONE COUNT, ONE LAYER. When the archive holds a snapshot for this fixture, every counting
   * sentence in this section — agreement, caution, the counts line — draws from THAT snapshot's
   * signal counts, the same numbers the archive line and the evidence-history footer print. The
   * live derivation's counts are a different layer (candidates scored at this page build), and
   * quoting both produced "8 scored signals" and "2 signals" on one page. Live counts are the
   * fallback only when no snapshot exists — and then the archive line says exactly that.
   */
  const supporting = latest
    ? latest.supportingSignalCount
    : model
      ? model.signals.filter((s) => s.direction === "supporting").length
      : 0;
  const opposing = latest
    ? latest.opposingSignalCount
    : model
      ? model.signals.filter((s) => s.direction === "opposing").length
      : 0;
  const total = latest ? latest.signalCount : model ? model.signals.length : 0;

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
      {/*
        THE PROVIDER FIGURE, DEMOTED. This number is FootyStats' market potential — a provider
        figure, not a model probability — so it must not wear the display register and must not
        sit under "The model's view". It renders at text size under its own provider label, with
        the honest caveat. The display register and the model heading are reserved for a genuine
        model probability from the evidence pipeline, if and when one exists — today it does not,
        so no page renders that state.
      */}
      {potential ? (
        <Reveal index={0}>
          <h2 id="fx-provider-heading" className="rw-m text-[var(--hero-ink-2)]">
            {p.fxProviderFigureTitle}
          </h2>
          <p className="mt-2 text-[15px] text-[var(--hero-ink)]">
            <span className="rw-tnum font-semibold">{potential.pct}%</span>{" "}
            <span className="text-[var(--hero-ink-2)]">{potential.marketLabel}</span>
          </p>
          <p className="mt-2 max-w-[52ch] text-[13px] leading-relaxed text-[var(--hero-ink-2)]">
            {formatDict(p.fxModelPotentialLine, {
              pct: String(potential.pct),
              market: potential.marketLabel,
            })}
          </p>
        </Reveal>
      ) : null}

      <div className={potential ? "mt-10" : ""}>
        <h2 id="fx-model-heading" className="rw-m text-[var(--hero-ink-2)]">
          {p.fxModelTitle}
        </h2>
        <h3 className="rw-h mt-3 text-[20px] text-[var(--hero-ink)]">{p.fxWhyTitle}</h3>
        <p className="mt-2 max-w-[52ch] text-[13px] leading-relaxed text-[var(--hero-ink-2)]">
          {p.fxWhyIntro}
        </p>

        {reconcile ? (
          <p className="mt-5 max-w-[62ch] border-l-2 border-[var(--hero-ink)] pl-4 text-[15px] leading-relaxed text-[var(--hero-ink)]">
            {reconcile}
          </p>
        ) : null}

        {model && view.state !== "no_data" ? (
          <>
            {/* THE WINDOW, NAMED. Every rate below is a season venue rate — a different window
                from the "last N" recent-form sentences above, and the copy says so, so the two
                can no longer read as one contradictory clock. */}
            <p className="rw-m mt-6 normal-case tracking-[0.04em] text-[var(--hero-ink-2)]">
              {p.fxWhyWindowNote}
            </p>
            <ul className="mt-2 border-t border-[var(--hero-line)]">
              {view.signals.map((signal) => (
                <li
                  key={signal.key}
                  className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-[var(--hero-line)] py-2.5"
                >
                  <span className="min-w-0 text-[13px] text-[var(--hero-ink-2)]">
                    {signal.label}
                  </span>
                  <span className="rw-m rw-tnum shrink-0 text-[var(--hero-ink)]">
                    {signal.display}
                    {/* A display without its sample is a provider figure, and says so. */}
                    {signal.display.includes("(") ? null : (
                      <span className="text-[var(--hero-ink-2)]"> · {p.fxProviderOnlyRate}</span>
                    )}
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
          </>
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

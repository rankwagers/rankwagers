import type { FixtureEvidenceView } from "@/lib/fixtures/evidenceView";
import type { FixtureSignal } from "@/lib/fixtureSignals";
import type { PredictionStrings } from "@/lib/translations/predictionsEn";
import type { EvidenceSnapshotView } from "@/types/evidence";
import { EmptyStateV3, IllustrationNoSnapshot } from "@/components/v3/illustrations";
import { DEFAULT_CAPTURE_LEAD_MINUTES } from "@/lib/evidence-capture/config";
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
  kickoffAt,
}: {
  view: FixtureEvidenceView;
  /** The page market's provider potential, already resolved by the loader. */
  potential: { pct: number; marketLabel: string } | null;
  lead: FixtureSignal | null;
  latest: EvidenceSnapshotView | null;
  teams: SignalTeams;
  p: PredictionStrings;
  /** The fixture's kickoff — the honest source for when a snapshot CAN exist. */
  kickoffAt?: string | null;
}) {
  /*
   * THE NO-SNAPSHOT EMPTY STATE (Bible V3, illustration 3). When the archive
   * holds nothing AND the live derivation has nothing to stand on AND no
   * provider potential resolved, this section has nothing to say — so it
   * says so, with the illustration and ONE line. The line's time is real:
   * capture opens at kickoff − DEFAULT_CAPTURE_LEAD_MINUTES (the systemd
   * timer's own constant). A fixture whose window already opened (or whose
   * kickoff is unknown) gets the honest archive-absence sentence instead —
   * never a promised run time that cannot come true.
   */
  if (view.state === "no_data" && !latest && !potential) {
    const kickoff = kickoffAt ? new Date(kickoffAt) : null;
    const windowOpens =
      kickoff && !Number.isNaN(kickoff.getTime())
        ? new Date(kickoff.getTime() - DEFAULT_CAPTURE_LEAD_MINUTES * 60_000)
        : null;
    const line =
      windowOpens && windowOpens.getTime() > Date.now()
        ? formatDict(p.v3EmptySnapshotLine, {
            time: `${new Intl.DateTimeFormat("en-GB", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
              timeZone: "UTC",
            }).format(windowOpens)} UTC`,
          })
        : p.fxWhyArchiveNone;
    return (
      <section aria-labelledby="fx-model-heading" className="scroll-mt-24">
        <h2 id="fx-model-heading" className="rw3-label">
          {p.fxModelTitle}
        </h2>
        <EmptyStateV3
          illustration={<IllustrationNoSnapshot />}
          title={p.v3EmptySnapshotTitle}
          line={line}
        />
      </section>
    );
  }

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
        <>
          <h2 id="fx-provider-heading" className="rw3-label">
            {p.fxProviderFigureTitle}
          </h2>
          <p className="mt-2 flex flex-wrap items-baseline gap-x-2 text-[13px]">
            <span className="rw3-pct">{potential.pct}%</span>{" "}
            <span style={{ color: "var(--muted)" }}>{potential.marketLabel}</span>
          </p>
          <p
            className="mt-2 max-w-[52ch] text-[12px] leading-relaxed"
            style={{ color: "var(--muted)" }}
          >
            {formatDict(p.fxModelPotentialLine, {
              pct: String(potential.pct),
              market: potential.marketLabel,
            })}
          </p>
        </>
      ) : null}

      <div className={potential ? "mt-8" : ""}>
        <h2 id="fx-model-heading" className="rw3-label">
          {p.fxModelTitle}
        </h2>
        <h3 className="mt-3 text-[14px] font-semibold">{p.fxWhyTitle}</h3>
        <p
          className="mt-2 max-w-[52ch] text-[12px] leading-relaxed"
          style={{ color: "var(--muted)" }}
        >
          {p.fxWhyIntro}
        </p>

        {reconcile ? (
          <p
            className="mt-4 max-w-[62ch] pl-4 text-[13px] leading-relaxed"
            style={{ borderLeft: "2px solid var(--line)" }}
          >
            {reconcile}
          </p>
        ) : null}

        {model && view.state !== "no_data" ? (
          <>
            {/* THE WINDOW, NAMED. Every rate below is a season venue rate — a different window
                from the "last N" recent-form sentences above, and the copy says so, so the two
                can no longer read as one contradictory clock. */}
            <p className="rw3-meta mt-5">
              {p.fxWhyWindowNote}
            </p>
            <ul className="mt-2" style={{ borderTop: "1px solid var(--line)" }}>
              {view.signals.map((signal) => (
                <li
                  key={signal.key}
                  className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-2"
                  style={{ borderBottom: "1px solid var(--line)" }}
                >
                  <span className="min-w-0 text-[13px]" style={{ color: "var(--muted)" }}>
                    {signal.label}
                  </span>
                  <span className="shrink-0 text-[12px] font-semibold">
                    {signal.display}
                    {/* A display without its sample is a provider figure, and says so. */}
                    {signal.display.includes("(") ? null : (
                      <span style={{ color: "var(--muted)", fontWeight: 400 }}>
                        {" "}
                        · {p.fxProviderOnlyRate}
                      </span>
                    )}
                    {signal.leagueBaseline ? (
                      <span style={{ color: "var(--muted)", fontWeight: 400 }}>
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
        <p className="rw3-meta mt-5">
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

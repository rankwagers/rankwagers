import { Icon } from "@/components/v3/Icon";
import { OperatorLogo } from "@/components/v3/OperatorLogo";
import type { FixtureSignal } from "@/lib/fixtureSignals";
import type { PredictionStrings } from "@/lib/translations/predictionsEn";
import type { EvidenceSnapshotView } from "@/types/evidence";
import type { PricePanelRow } from "@/lib/operators/pricePanel.server";
import {
  presentedNumbers,
  signalScopeText,
  signalSentence,
  type SignalTeams,
} from "@/lib/fixtures/signalPresentation";
import { deviationFor, sampleStrengthTier } from "@/lib/fixtures/v31";
import { formatDict } from "@/lib/formatDict";
import type { Rw3IconName } from "@/lib/v3/icons";

/* ============================================================================
   FIXTURE v3.1 — LAYER 1's VERDICT (design/v3/match-v31.pdf).

   THE ONE DISPLAY NUMBER. The lead market's presented rate renders at 34px
   — the single sanctioned exception to Bible V3's 18px cap, probe-pinned
   as the only >18px text on the route. Beside it: the market pill with its
   icon, the scope, the sample N/M; under it the ±pp-vs-league chip (green
   ONLY when the deviation favors the claim as phrased) and the 5-segment
   SAMPLE STRENGTH bar — a statement about the evidence's SIZE, never
   "confidence" (vocabulary probe-pinned). The provenance line names the
   snapshot, model and validation count, or says plainly that the reading
   is derived live. No lead signal → no verdict block at all (empty-state
   law); the page then opens with the evidence rows.

   PLAY THIS MARKET. Availability-first, verified-first rows straight from
   the price panel's own ordering; ONE Best badge on the top price; ghost
   odds buttons with observed prices only; the sponsored no-number ghost
   when nothing was observed; the odds-as-of line closes the box.
   ========================================================================== */

const SIGNAL_ICON: Record<string, Rw3IconName> = {
  over15: "over",
  over25: "over",
  over35: "over",
  fh05: "h1",
  sh05: "h2",
  btts: "btts",
  bttsNo: "bttsNo",
  corners: "corner",
};

export type VerdictFallback = {
  name: string;
  logo: string | null;
  continueHref: string;
} | null;

export function VerdictBlock({
  lead,
  teams,
  p,
  latest,
  editorNote,
  playRows,
  playFallback,
  marketLabel,
}: {
  lead: FixtureSignal;
  teams: SignalTeams;
  p: PredictionStrings;
  latest: EvidenceSnapshotView | null;
  editorNote?: string | null;
  /** The lead market's observed prices, panel-ordered; empty → fallback. */
  playRows: PricePanelRow[];
  playFallback: VerdictFallback;
  /** The lead market's short label for the pill and the play box. */
  marketLabel: string;
}) {
  const presented = presentedNumbers(lead);
  const pct = Math.round(presented.rate * 100);
  const deviation = deviationFor(lead);
  const tier = sampleStrengthTier(lead.sample);
  const latestObserved = playRows.length
    ? playRows.reduce((max, row) => (row.observedAt > max ? row.observedAt : max), playRows[0].observedAt)
    : null;

  return (
    <section
      aria-labelledby="fx31-verdict-heading"
      className="grid gap-5 py-4"
      style={{ gridTemplateColumns: "minmax(0,1fr) 300px", borderBottom: "1px solid var(--line)" }}
    >
      <div>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 id="fx31-verdict-heading" className="rw3-label">
            1 · {p.v3FxVerdict}
          </h2>
          <span className="rw3-meta" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Icon name="snapshot" size={12} />
            {latest
              ? formatDict(p.v3SnapshotLine, {
                  time: latest.capturedAtLabel,
                  version: latest.modelVersion,
                  n: String(latest.validations.length),
                })
              : p.v3DerivedLive}
          </span>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
          {/* THE ONE >18px NUMBER ON THE ROUTE (probe-pinned). */}
          <span
            data-fx31-verdict-number=""
            style={{ fontSize: 34, lineHeight: 1, fontWeight: 600, color: "var(--win)" }}
          >
            {pct}%
          </span>
          <span className="rw3-pill">
            <span style={{ color: "var(--muted)", display: "inline-flex" }}>
              <Icon name={SIGNAL_ICON[lead.market] ?? "over"} size={20} strokePx={1.75} />
            </span>
            {marketLabel}
          </span>
          <span className="text-[13px] font-medium">
            {signalScopeText(lead, teams, p)} · {presented.count}/{lead.sample}
          </span>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="rw3-meta">{p.v3SampleStrength}</span>
            <span className="flex items-center gap-0.5" aria-label={`${p.v3SampleStrength} ${tier}/5`}>
              {[1, 2, 3, 4, 5].map((segment) => (
                <span
                  key={segment}
                  style={{
                    width: 10,
                    height: 4,
                    borderRadius: 2,
                    background: segment <= tier ? "var(--win)" : "var(--line)",
                  }}
                />
              ))}
            </span>
            <span className="rw3-meta">{tier}/5</span>
          </span>
          {deviation ? (
            <span
              className="rw3-pill"
              style={{
                fontSize: 11,
                ...(deviation.favors
                  ? { color: "var(--win)", borderColor: "var(--win)" }
                  : { color: "var(--muted)" }),
              }}
            >
              {formatDict(p.v3PpVsLeague, {
                pp: `${deviation.pp > 0 ? "+" : ""}${deviation.pp}`,
              })}
            </span>
          ) : null}
        </div>

        <p className="mt-3 max-w-[62ch] text-[13px] leading-relaxed">
          {signalSentence(lead, teams, p)}
        </p>

        {editorNote?.trim() ? (
          <div
            className="mt-3 max-w-[62ch]"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 3,
              padding: "10px 12px",
              background: "var(--surface)",
              borderRadius: 6,
            }}
          >
            <span className="rw3-label" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Icon name="editor" size={20} strokePx={1.75} />
              {p.v3EditorNote}
            </span>
            <span className="text-[13px]" style={{ lineHeight: 1.45 }}>
              {editorNote}
            </span>
          </div>
        ) : null}
      </div>

      {/* ── PLAY THIS MARKET ─────────────────────────────────────────── */}
      <aside
        aria-label={p.v3PlayThisMarket}
        style={{
          border: "1px solid var(--line)",
          borderRadius: 6,
          padding: 12,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          alignSelf: "start",
        }}
      >
        <div className="flex items-baseline justify-between gap-2">
          <span className="rw3-label">{p.v3PlayThisMarket}</span>
          <span className="rw3-meta" style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
            <Icon name="sponsored" size={12} />
            {p.v3Sponsored18}
          </span>
        </div>
        {playRows.length ? (
          <>
            {playRows.slice(0, 4).map((row, index) => (
              <div
                key={`${row.operatorSlug}-${row.observedAt}`}
                className="flex items-center gap-8px"
                style={{ display: "flex", alignItems: "center", gap: 8 }}
              >
                <OperatorLogo logo={null} name={row.operatorName} variant="row" />
                <span style={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
                  <span className="text-[12px] font-semibold">{row.operatorName}</span>
                  <span className="rw3-meta">
                    {index === 0 ? `${p.v3Best} · ${p.v3TopPrice}` : row.verified ? p.opVerified : ""}
                  </span>
                </span>
                {row.continueHref ? (
                  <a
                    href={row.continueHref}
                    rel="nofollow sponsored noopener"
                    className="rw3-ghost"
                    style={{ marginLeft: "auto", fontSize: 12, padding: "3px 10px" }}
                  >
                    {row.decimal.toFixed(2)} <Icon name="arrow" size={11} />
                  </a>
                ) : (
                  <span
                    className="text-[12px] font-semibold"
                    style={{ marginLeft: "auto", color: "var(--muted)" }}
                  >
                    {row.decimal.toFixed(2)}
                  </span>
                )}
              </div>
            ))}
            {latestObserved ? (
              <span className="rw3-meta">
                {formatDict(p.v3OddsAsOf, { time: latestObserved.slice(11, 16) })} ·{" "}
                {p.v3Sponsored18}
              </span>
            ) : null}
          </>
        ) : playFallback ? (
          /* No observed price → the sponsored no-number ghost (group 4's law). */
          <a
            href={playFallback.continueHref}
            rel="nofollow sponsored noopener"
            className="rw3-ghost"
            title={p.v3Sponsored18}
            style={{
              fontSize: 12,
              padding: "4px 11px",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              alignSelf: "flex-start",
            }}
          >
            <OperatorLogo logo={playFallback.logo} name={playFallback.name} variant="row" />{" "}
            {playFallback.name} <Icon name="arrow" size={11} />
          </a>
        ) : null}
      </aside>
    </section>
  );
}

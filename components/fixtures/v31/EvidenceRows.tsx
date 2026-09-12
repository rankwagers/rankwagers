import { Icon } from "@/components/v3/Icon";
import { FixtureSignalsExplainer } from "@/components/fixtures/FixtureSignalsExplainer";
import type { FixtureSignal } from "@/lib/fixtureSignals";
import type { HistoricalMatch } from "@/lib/footystats/matchDetail";
import type { PredictionStrings } from "@/lib/translations/predictionsEn";
import {
  presentedNumbers,
  signalScopeText,
  signalSentence,
  type SignalTeams,
} from "@/lib/fixtures/signalPresentation";
import { deviationFor, scopeFormDots, signalMarketLabel } from "@/lib/fixtures/v31";
import { FormDots } from "@/components/v3/motion";
import { formatDict } from "@/lib/formatDict";
import type { Rw3IconName } from "@/lib/v3/icons";

/* ============================================================================
   FIXTURE v3.1 — LAYER 2: THE EVIDENCE ROWS.

   Rank · finding sentence · market icon + scope · the presented rate at
   14px · the DEVIATION BAR (gray track = 0–100%, filled = the rate, a thin
   light marker = the league average — the marker IS the baseline,
   probe-pinned) · the ±pp chip · form dots where FULL-TIME scores can
   answer for the market. Order is the engine's weighted score — the same
   ranking the scorer emitted, untouched here. Unmeasured and n<5 signals
   never reach this layer by the engine's own bars.

   Rows beyond three collapse under "N more signals ▾" as market·pct·±pp
   chips, expanding INLINE via <details> — no navigation, no JavaScript.
   ========================================================================== */

const SIGNAL_ICON: Record<string, Rw3IconName> = {
  over15: "over",
  over25: "over",
  over35: "over",
  fh05: "h1",
  sh05: "h2",
  btts: "btts",
  cleanSheets: "bttsNo",
  failedToScore: "bttsNo",
};

function scopeMatches(
  signal: FixtureSignal,
  history: { homeAtHome: HistoricalMatch[]; awayAtAway: HistoricalMatch[]; headToHead: HistoricalMatch[] } | undefined
): HistoricalMatch[] {
  if (!history) return [];
  switch (signal.scope) {
    case "home_venue":
    case "recent_home":
      return history.homeAtHome;
    case "away_venue":
    case "recent_away":
      return history.awayAtAway;
    case "h2h":
      return history.headToHead;
    default:
      return [];
  }
}

function DeviationBar({
  ratePct,
  baselinePct,
  caption,
}: {
  ratePct: number;
  baselinePct: number;
  caption: string;
}) {
  return (
    <span style={{ display: "flex", flexDirection: "column", gap: 3, width: 190 }}>
      <span
        aria-hidden
        style={{
          position: "relative",
          height: 6,
          borderRadius: 3,
          background: "var(--line)",
          overflow: "hidden",
        }}
      >
        <span
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: `${Math.min(100, Math.max(0, ratePct))}%`,
            background: "var(--win)",
            borderRadius: 3,
          }}
        />
        {/* The thin light marker IS the league average (probe-pinned). */}
        <span
          data-fx31-baseline-marker={baselinePct}
          style={{
            position: "absolute",
            left: `${Math.min(100, Math.max(0, baselinePct))}%`,
            top: -1,
            bottom: -1,
            width: 2,
            background: "var(--text)",
          }}
        />
      </span>
      <span className="rw3-meta">{caption}</span>
    </span>
  );
}

function Row({
  signal,
  rank,
  teams,
  p,
  history,
}: {
  signal: FixtureSignal;
  rank: number;
  teams: SignalTeams;
  p: PredictionStrings;
  history: Parameters<typeof scopeMatches>[1];
}) {
  const presented = presentedNumbers(signal);
  const pct = Math.round(presented.rate * 100);
  const deviation = deviationFor(signal);
  const dots = scopeFormDots(signal.market, scopeMatches(signal, history));
  return (
    <li
      className="fx31-evidence-row"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "10px 0",
        borderBottom: "1px solid var(--line)",
        listStyle: "none",
      }}
    >
      <span className="rw3-meta" style={{ width: 14, flex: "none" }}>
        {rank}
      </span>
      <span style={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
        <span className="text-[13px] font-medium" style={{ lineHeight: 1.35 }}>
          {signalSentence(signal, teams, p)}
        </span>
        <span className="rw3-meta" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <Icon name={SIGNAL_ICON[signal.market] ?? "over"} size={20} strokePx={1.75} />
          {signalMarketLabel(signal, p as unknown as Record<string, string>)} ·{" "}
          {signalScopeText(signal, teams, p)}
        </span>
      </span>
      <span className="text-[14px] font-semibold" style={{ flex: "none" }}>
        {pct}%
      </span>
      {deviation ? (
        <DeviationBar
          ratePct={pct}
          baselinePct={deviation.baselinePct}
          caption={`${presented.count}/${signal.sample} · ${formatDict(p.v3LeagueAvgIs, {
            pct: String(deviation.baselinePct),
          })}`}
        />
      ) : null}
      {deviation ? (
        <span
          className="rw3-pill"
          style={{
            fontSize: 11,
            flex: "none",
            ...(deviation.favors
              ? { color: "var(--win)", borderColor: "var(--win)" }
              : { color: "var(--muted)" }),
          }}
        >
          {deviation.pp > 0 ? "+" : ""}
          {deviation.pp} pp
        </span>
      ) : null}
      {dots.length ? (
        <span style={{ flex: "none" }}>
          <FormDots results={dots} />
        </span>
      ) : null}
    </li>
  );
}

export function EvidenceRows({
  supports,
  teams,
  p,
  history,
}: {
  /** Engine-ranked (weighted score) — the order is the scorer's, untouched. */
  supports: FixtureSignal[];
  teams: SignalTeams;
  p: PredictionStrings;
  history?: { homeAtHome: HistoricalMatch[]; awayAtAway: HistoricalMatch[]; headToHead: HistoricalMatch[] };
}) {
  if (!supports.length) return null;
  const visible = supports.slice(0, 3);
  const folded = supports.slice(3);
  return (
    <section aria-labelledby="fx31-evidence-heading" className="mt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 id="fx31-evidence-heading" className="rw3-label">
          2 · {p.v3FxEvidence}
        </h2>
        <span className="flex items-center gap-3">
          <span className="rw3-meta">{p.v3SortedByDeviation}</span>
          <FixtureSignalsExplainer label={p.fxExplainerLabel} body={p.fxExplainerBody} />
        </span>
      </div>
      <ul className="mt-2" style={{ margin: 0, padding: 0, borderTop: "1px solid var(--line)" }}>
        {visible.map((signal, index) => (
          <Row
            key={`${signal.scope}-${signal.market}-${signal.window}`}
            signal={signal}
            rank={index + 1}
            teams={teams}
            p={p}
            history={history}
          />
        ))}
      </ul>
      {folded.length ? (
        /* INLINE expansion, no navigation: <details> carries the fold. */
        <details className="fx31-more-signals">
          <summary
            className="rw3-hoverable"
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 8,
              padding: "8px 0",
              cursor: "pointer",
              listStyle: "none",
            }}
          >
            <span className="text-[12px] font-medium">
              {formatDict(p.v3NMoreSignals, { n: String(folded.length) })} ▾
            </span>
            {folded.map((signal) => {
              const presented = presentedNumbers(signal);
              const deviation = deviationFor(signal);
              return (
                <span
                  key={`chip-${signal.scope}-${signal.market}-${signal.window}`}
                  className="rw3-pill"
                  style={{ fontSize: 11 }}
                >
                  {signalMarketLabel(signal, p as unknown as Record<string, string>)}{" "}
                  <strong>{Math.round(presented.rate * 100)}%</strong>
                  {deviation ? (
                    <span style={{ color: deviation.favors ? "var(--win)" : "var(--muted)" }}>
                      {deviation.pp > 0 ? "+" : ""}
                      {deviation.pp} pp
                    </span>
                  ) : null}
                </span>
              );
            })}
          </summary>
          <ul style={{ margin: 0, padding: 0 }}>
            {folded.map((signal, index) => (
              <Row
                key={`${signal.scope}-${signal.market}-${signal.window}`}
                signal={signal}
                rank={index + 4}
                teams={teams}
                p={p}
                history={history}
              />
            ))}
          </ul>
        </details>
      ) : null}
      {/* THE POST-L2 BRIDGE — one quiet rule-line to L5, an anchor, never a redirect. */}
      <p className="mt-3 pt-3" style={{ borderTop: "1px solid var(--line)" }}>
        <a href="#fx-operators-heading" className="rw3-ghost" data-placement="post_l2_bridge">
          {p.fxBridgeOperators} →
        </a>
      </p>
    </section>
  );
}

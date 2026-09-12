import Link from "next/link";
import type { PredictionStrings } from "@/lib/translations/predictionsEn";
import type { H2hAnalysis } from "@/lib/fixtures/v31";
import { modelSentences, type ModelViewInputs } from "@/lib/fixtures/v31Model";
import { formatDict } from "@/lib/formatDict";

/* ============================================================================
   FIXTURE v3.1 — LAYER 3: HISTORY AND THE MODEL'S VIEW.

   H2H exists only at ≥3 meetings (h2hAnalysis returns null below the gate —
   an anecdote is not a record). The W/D/L share bar is DATA-SEMANTIC
   green/gray/red — the one sanctioned use of red on this page family; every
   market rate carries the window as its sample; the label states the window
   plainly ("Last N meetings · years"); under five meetings the whole panel
   wears the small-sample word. Last-5 cards scroll sideways, never wrap.

   THE MODEL VIEW speaks only through the template registry
   (lib/fixtures/v31Model.ts): 2–4 sentences whose computed inputs all
   exist; fewer than two and the section is omitted whole. It closes with
   the lock line and the record's door — accountability, not persuasion.
   ========================================================================== */

const RATE_LABEL_KEY: Record<string, keyof PredictionStrings> = {
  over15: "v3MktOver15",
  over25: "v3MktOver25",
  over35: "v3MktOver35",
  btts: "v3MktBtts",
};

function ShareBar({ h2h }: { h2h: H2hAnalysis }) {
  const parts = [
    { pct: h2h.winsPct, color: "var(--win)" },
    { pct: h2h.drawsPct, color: "var(--muted)" },
    { pct: h2h.lossesPct, color: "var(--loss)" },
  ].filter((part) => part.pct > 0);
  return (
    <span
      aria-hidden
      style={{
        display: "flex",
        height: 8,
        borderRadius: 4,
        overflow: "hidden",
        gap: 2,
        maxWidth: 420,
      }}
    >
      {parts.map((part, index) => (
        <span key={index} style={{ width: `${part.pct}%`, background: part.color }} />
      ))}
    </span>
  );
}

export function H2hSection({
  h2h,
  homeTeam,
  awayTeam,
  p,
}: {
  h2h: H2hAnalysis;
  homeTeam: string;
  awayTeam: string;
  p: PredictionStrings;
}) {
  return (
    <section aria-labelledby="fx31-history-heading" className="mt-10 pt-6" style={{ borderTop: "1px solid var(--line)" }}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 id="fx31-history-heading" className="rw3-label">
          3 · {p.v3FxHistory}
        </h2>
        <span className="rw3-meta">
          {formatDict(p.v3LastNMeetings, {
            n: String(h2h.meetings),
            from: String(h2h.yearFrom),
            to: String(h2h.yearTo),
          })}
          {h2h.smallSample ? (
            <span className="rw3-pill" style={{ fontSize: 10, marginLeft: 8, color: "var(--muted)" }}>
              {p.v3SmallSample}
            </span>
          ) : null}
        </span>
      </div>

      <div className="mt-3" style={h2h.smallSample ? { color: "var(--muted)" } : undefined}>
        <ShareBar h2h={h2h} />
        <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
          <span style={{ color: "var(--win)" }}>
            {homeTeam} · {formatDict(p.v3NWinsPct, { n: String(h2h.wins), pct: String(h2h.winsPct) })}
          </span>
          <span style={{ color: "var(--muted)" }}>
            {formatDict(p.v3NDrawsPct, { n: String(h2h.draws), pct: String(h2h.drawsPct) })}
          </span>
          <span style={{ color: "var(--loss)" }}>
            {awayTeam} · {formatDict(p.v3NWinsPct, { n: String(h2h.losses), pct: String(h2h.lossesPct) })}
          </span>
        </p>

        {/* Market rates over the whole window — every pct beside its sample. */}
        <p className="mt-3 flex flex-wrap gap-2">
          {h2h.rates.map((rate) => (
            <span key={rate.key} className="rw3-pill" style={{ fontSize: 11 }}>
              {p[RATE_LABEL_KEY[rate.key]] as string} <strong>{rate.pct}%</strong>{" "}
              <span style={{ color: "var(--muted)" }}>
                {rate.hits}/{h2h.meetings}
              </span>
            </span>
          ))}
        </p>
        <p className="rw3-meta mt-2">
          {formatDict(p.v3CleanSheetFor, { team: homeTeam })}: {h2h.cleanSheets.home}/{h2h.meetings} ·{" "}
          {formatDict(p.v3CleanSheetFor, { team: awayTeam })}: {h2h.cleanSheets.away}/{h2h.meetings}
        </p>

        {/* Last five meetings — cards in one scrolling rank, never wrapped. */}
        <div className="mt-4 flex gap-2.5" style={{ overflowX: "auto", paddingBottom: 4 }}>
          {h2h.lastFive.map((match) => (
            <div
              key={match.id}
              style={{
                flex: "none",
                minWidth: 132,
                padding: "8px 10px",
                background: "var(--surface)",
                borderRadius: 6,
              }}
            >
              <p className="text-[14px] font-semibold">
                {match.home.score}–{match.away.score}
              </p>
              <p className="mt-1 text-[11px]" style={{ color: "var(--muted)", lineHeight: 1.4 }}>
                {match.home.name}
                <br />
                {match.away.name}
              </p>
              <p className="rw3-meta mt-1">{match.kickoffAt.slice(0, 4)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ModelViewV31({
  inputs,
  marketLabel,
  locale,
  p,
}: {
  inputs: ModelViewInputs;
  /** The lead market's short label — null drops the why-line, never fakes one. */
  marketLabel: string | null;
  locale: string;
  p: PredictionStrings;
}) {
  const sentences = modelSentences(inputs, p);
  if (!sentences.length) return null;
  return (
    <section aria-labelledby="fx31-model-heading" className="mt-8">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id="fx31-model-heading" className="rw3-label">
          {p.v3ModelView}
        </h2>
        {marketLabel ? (
          <span className="rw3-meta">{formatDict(p.v3WhyMarket, { market: marketLabel })}</span>
        ) : null}
      </div>
      <p className="mt-2 max-w-[64ch] text-[13px]" style={{ lineHeight: 1.6 }}>
        {sentences.map((sentence) => (
          <span key={sentence.key} data-fx31-template={sentence.key}>
            {sentence.text}{" "}
          </span>
        ))}
      </p>
      <p className="rw3-meta mt-3">
        {p.v3LockLine} ·{" "}
        <Link href={`/${locale}/archive`} style={{ color: "var(--text)" }}>
          {p.v3SeeRecord} →
        </Link>
      </p>
    </section>
  );
}

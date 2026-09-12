import type { PredictionStrings } from "@/lib/translations/predictionsEn";
import type { FormPack, StatRow } from "@/lib/fixtures/v31";
import { FormChips } from "./FixtureHeaderV31";

/* ============================================================================
   FIXTURE v3.1 — LAYER 4: THE TEAM COMPARISON.

   Two cards, one HONEST venue column per team — the provider carries the
   home side's HOME history and the away side's AWAY history, nothing else,
   so each card names its venue and the mock's general/other-venue columns
   are omitted, not invented. Form chips and points-per-match derive from
   the same real fixtures; every stat row carries its sample; a stat the
   provider did not measure yields NO row (empty-state law — never a 0).
   Below the cards: paired horizontal bars for the stats BOTH venues can
   answer — green marks the side ahead on that row's own terms (conceding
   less is being ahead). No standings fields anywhere (the DECIDED rule).
   ========================================================================== */

const STAT_LABEL_KEY: Record<string, keyof PredictionStrings> = {
  winPct: "v3WinPct",
  goalsAvg: "v3GoalsAvg",
  scoredAvg: "v3ScoredAvg",
  concededAvg: "v3ConcededAvg",
  bttsPct: "v3MktBtts",
  cleanSheetPct: "v3CleanSheetPct",
  failedToScorePct: "v3FailedToScorePct",
};

/** Rows where the SMALLER number is the better one. */
const LOWER_IS_BETTER = new Set(["concededAvg", "failedToScorePct"]);

/** The paired-bar shortlist — goal averages and rates both venues answer. */
const BAR_KEYS = [
  "winPct",
  "scoredAvg",
  "concededAvg",
  "bttsPct",
  "cleanSheetPct",
  "failedToScorePct",
] as const;

function statText(row: StatRow): string {
  return row.kind === "pct" ? `${row.value}%` : row.value.toFixed(2);
}

function TeamCard({
  team,
  venueLabel,
  form,
  rows,
  p,
}: {
  team: string;
  venueLabel: string;
  form: FormPack;
  rows: StatRow[];
  p: PredictionStrings;
}) {
  return (
    <div style={{ background: "var(--surface)", borderRadius: 6, padding: "14px 16px" }}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <p className="text-[14px] font-semibold">
          {team} <span className="rw3-meta">· {venueLabel}</span>
        </p>
        {form.chips.length ? <FormChips pack={form} /> : null}
      </div>
      {form.ptsPerMatch !== null ? (
        <p className="rw3-meta mt-1.5">
          {p.v3PtsPerMatch} <strong style={{ color: "var(--text)" }}>{form.ptsPerMatch.toFixed(2)}</strong> ·{" "}
          {form.sample}
        </p>
      ) : null}
      <ul className="mt-3" style={{ margin: 0, padding: 0 }}>
        {rows.map((row) => (
          <li
            key={row.key}
            className="flex items-baseline justify-between gap-4 py-1.5 text-[12px]"
            style={{ borderTop: "1px solid var(--line)", listStyle: "none" }}
          >
            <span style={{ color: "var(--muted)" }}>{p[STAT_LABEL_KEY[row.key]] as string}</span>
            <span className="font-medium">
              {statText(row)} <span className="rw3-meta">· {row.sample}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PairedBar({
  label,
  home,
  away,
  lowerBetter,
}: {
  label: string;
  home: StatRow;
  away: StatRow;
  lowerBetter: boolean;
}) {
  const scale = home.kind === "pct" ? 100 : Math.max(home.value, away.value, 0.01);
  const homeAhead = lowerBetter ? home.value < away.value : home.value > away.value;
  const awayAhead = lowerBetter ? away.value < home.value : away.value > home.value;
  const width = (value: number) => `${Math.min(100, Math.round((value / scale) * 100))}%`;
  return (
    <li
      className="grid items-center gap-x-3 py-1.5 text-[12px]"
      style={{ gridTemplateColumns: "minmax(0,1fr) 150px minmax(0,1fr)", listStyle: "none" }}
    >
      <span className="flex items-center justify-end gap-2">
        <span className="font-medium">{statText(home)}</span>
        <span
          aria-hidden
          style={{
            height: 6,
            borderRadius: 3,
            width: width(home.value),
            maxWidth: "60%",
            background: homeAhead ? "var(--win)" : "var(--line)",
          }}
        />
      </span>
      <span className="rw3-meta text-center">{label}</span>
      <span className="flex items-center gap-2">
        <span
          aria-hidden
          style={{
            height: 6,
            borderRadius: 3,
            width: width(away.value),
            maxWidth: "60%",
            background: awayAhead ? "var(--win)" : "var(--line)",
          }}
        />
        <span className="font-medium">{statText(away)}</span>
      </span>
    </li>
  );
}

export function ComparisonSection({
  homeTeam,
  awayTeam,
  homeForm,
  awayForm,
  homeRows,
  awayRows,
  p,
}: {
  homeTeam: string;
  awayTeam: string;
  homeForm: FormPack;
  awayForm: FormPack;
  homeRows: StatRow[];
  awayRows: StatRow[];
  p: PredictionStrings;
}) {
  if (!homeRows.length && !awayRows.length) return null;
  const awayByKey = new Map(awayRows.map((row) => [row.key, row]));
  const pairs: Array<{ key: string; home: StatRow; away: StatRow }> = [];
  for (const key of BAR_KEYS) {
    if (pairs.length >= 6) break;
    const home = homeRows.find((row) => row.key === key);
    const away = awayByKey.get(key);
    if (home && away) pairs.push({ key, home, away });
  }

  return (
    <section
      aria-labelledby="fx31-comparison-heading"
      className="mt-10 pt-6"
      style={{ borderTop: "1px solid var(--line)" }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 id="fx31-comparison-heading" className="rw3-label">
          4 · {p.v3FxComparison}
        </h2>
        {pairs.length ? <span className="rw3-meta">{p.v3LeadsRow}</span> : null}
      </div>
      <div className="fx31-comparison-cards mt-3 grid gap-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
        {homeRows.length ? (
          <TeamCard team={homeTeam} venueLabel={p.v3HomeShort} form={homeForm} rows={homeRows} p={p} />
        ) : null}
        {awayRows.length ? (
          <TeamCard team={awayTeam} venueLabel={p.v3AwayShort} form={awayForm} rows={awayRows} p={p} />
        ) : null}
      </div>
      {pairs.length ? (
        <ul className="mt-4" style={{ margin: 0, padding: 0 }}>
          {pairs.map((pair) => (
            <PairedBar
              key={pair.key}
              label={p[STAT_LABEL_KEY[pair.key]] as string}
              home={pair.home}
              away={pair.away}
              lowerBetter={LOWER_IS_BETTER.has(pair.key)}
            />
          ))}
        </ul>
      ) : null}
    </section>
  );
}

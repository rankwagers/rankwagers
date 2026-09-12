import Image from "next/image";
import type { PredictionStrings } from "@/lib/translations/predictionsEn";
import type { FormPack } from "@/lib/fixtures/v31";
import { LocalTime } from "@/components/fixtures/LocalTime";

/* ============================================================================
   FIXTURE v3.1 — LAYER 1's HEADER. Crests 32px, names, league · kickoff ·
   venue, and the last-5 form chips from REAL results — each strip labeled
   with the venue its history actually covers (the provider carries the
   home side's HOME history and the away side's AWAY history; an unlabeled
   "last 5" over venue-scoped matches would be a quiet lie). The DECIDED
   no-standings rule: no rank, no points, no round — those mock fields are
   omitted, not approximated.
   ========================================================================== */

export function FormChips({ pack }: { pack: FormPack }) {
  if (!pack.chips.length) return null;
  return (
    <span style={{ display: "inline-flex", gap: 3 }} aria-hidden>
      {pack.chips.map((chip, index) => (
        <span
          key={`${chip.score}-${index}`}
          title={`${chip.score} · ${chip.opponent}`}
          style={{
            width: 16,
            height: 16,
            display: "grid",
            placeItems: "center",
            fontSize: 9,
            fontWeight: 600,
            borderRadius: 4,
            background: "var(--pctbg)",
            color:
              chip.outcome === "won"
                ? "var(--win)"
                : chip.outcome === "lost"
                  ? "var(--loss)"
                  : "var(--muted)",
          }}
        >
          {chip.outcome === "won" ? "W" : chip.outcome === "lost" ? "L" : "D"}
        </span>
      ))}
    </span>
  );
}

function Crest({ src, name }: { src?: string; name: string }) {
  if (!src) {
    return (
      <span
        aria-hidden
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: "var(--pctbg)",
          border: "1px solid var(--line)",
          display: "grid",
          placeItems: "center",
          fontSize: 11,
          fontWeight: 600,
          flex: "none",
        }}
      >
        {name.slice(0, 1)}
      </span>
    );
  }
  return (
    <Image
      src={src}
      alt=""
      width={32}
      height={32}
      className="h-8 w-8 object-contain"
      style={{ borderRadius: "50%", flex: "none" }}
    />
  );
}

export function FixtureHeaderV31({
  homeTeam,
  awayTeam,
  homeLogo,
  awayLogo,
  competition,
  kickoffAt,
  venue,
  homeForm,
  awayForm,
  locale,
  p,
  score,
  statusLabel,
  minute,
  isLive,
  finished,
}: {
  homeTeam: string;
  awayTeam: string;
  homeLogo?: string;
  awayLogo?: string;
  competition: string | null;
  kickoffAt: string | null;
  venue: string | null;
  homeForm: FormPack;
  awayForm: FormPack;
  locale: string;
  p: PredictionStrings;
  /** Live state is load-bearing (the standing law): score/minute render
      the moment they exist; the mock's pre-match center is the null case. */
  score: { home: number | null; away: number | null };
  statusLabel: string;
  minute: number | null;
  isLive: boolean;
  finished: boolean;
}) {
  return (
    <header className="pb-4 pt-3.5" style={{ borderBottom: "1px solid var(--line)" }}>
      <h1 className="sr-only">
        {homeTeam} vs {awayTeam}
      </h1>
      <div
        className="grid items-start gap-5 py-3"
        style={{ gridTemplateColumns: "minmax(0,1fr) auto minmax(0,1fr)" }}
      >
        <div className="flex flex-col items-end gap-1.5 text-right">
          <span className="flex items-center gap-2.5">
            <span className="text-[16px] font-semibold">{homeTeam}</span>
            <Crest src={homeLogo} name={homeTeam} />
          </span>
          {homeForm.chips.length ? (
            <span className="flex items-center gap-2">
              <span className="rw3-meta">
                {p.v3LastFive} · {p.v3HomeShort}
              </span>
              <FormChips pack={homeForm} />
            </span>
          ) : null}
        </div>
        <div className="text-center" style={{ minWidth: 130 }}>
          {score.home !== null && score.away !== null ? (
            <>
              <p
                className="text-[16px] font-semibold"
                aria-label={`Score ${score.home}–${score.away}`}
              >
                {score.home}–{score.away}
              </p>
              <p className="rw3-label mt-0.5">
                <span
                  style={
                    isLive
                      ? { color: "var(--accent)" }
                      : finished
                        ? { color: "var(--win)" }
                        : undefined
                  }
                >
                  {statusLabel}
                </span>
                {minute !== null ? (
                  <span style={isLive ? { color: "var(--accent)" } : undefined}>
                    {" · "}
                    {minute}&apos;
                  </span>
                ) : null}
              </p>
            </>
          ) : (
            <p className="text-[16px] font-semibold">
              {kickoffAt ? <LocalTime iso={kickoffAt} locale={locale} /> : "–"}
            </p>
          )}
          <p className="mt-1 text-[11px]" style={{ color: "var(--muted)" }}>
            {[venue, competition].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex flex-col items-start gap-1.5">
          <span className="flex items-center gap-2.5">
            <Crest src={awayLogo} name={awayTeam} />
            <span className="text-[16px] font-semibold">{awayTeam}</span>
          </span>
          {awayForm.chips.length ? (
            <span className="flex items-center gap-2">
              <FormChips pack={awayForm} />
              <span className="rw3-meta">
                {p.v3LastFive} · {p.v3AwayShort}
              </span>
            </span>
          ) : null}
        </div>
      </div>
    </header>
  );
}

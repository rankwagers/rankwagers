import { Reveal } from "@/components/motion/Reveal";
import type {
  FixtureEvidenceMarketView,
  FixtureEvidenceSignalView,
  FixtureEvidenceView,
} from "@/lib/fixtures/evidenceView";

/* ============================================================================
   THE RESEARCH SECTION — what we found, and why
   ----------------------------------------------------------------------------
   §3.10: evidence is an explanation, not a number. So the signals lead and the
   verdict trails. The verdict is `unqualified` on every fixture on today's board;
   a constant carries no information, and printing it as a headline would teach a
   reader to ignore the loudest thing on the page.

   §3.2: no figure appears here that the provider did not produce. Every rate is
   rendered beside the observations behind it, without exception — the denominator
   is not decoration, it is the difference between "100%" and "100% (7/7)".
   ========================================================================== */

const DIRECTION_COPY: Record<
  FixtureEvidenceSignalView["direction"],
  { label: string; tone: string; meaning: string }
> = {
  supporting: {
    label: "Supports",
    tone: "text-[var(--hero-pos)]",
    meaning: "above the league rate",
  },
  opposing: {
    label: "Opposes",
    tone: "text-[var(--hero-ink)]",
    meaning: "below the league rate",
  },
  neutral: {
    label: "Tells us nothing",
    tone: "text-[var(--hero-ink-3)]",
    meaning: "level with the league rate",
  },
};

/** The product's framing. Mechanism only — never a figure, because none has been observed. */
function FramingNote() {
  return (
    <div className="rw-frame border-l-2 border-[var(--hero-line)] pl-5">
      <p className="max-w-[62ch] text-[16px] leading-8 text-[var(--hero-ink-2)]">
        RankWagers measures how often a goal market occurs, not what it is priced at. A
        high-probability market is priced low before kickoff. The same market prices differently in
        play, while the score is still goalless. Where and when to take that price is the
        reader&apos;s decision; this page does not make it. Every figure we publish is a rate, and
        the number of matches behind it sits beside it.
      </p>
    </div>
  );
}

/** A rate and its sample, bound together so neither can be rendered without the other. */
function Rate({ value, label }: { value: { display: string } | null; label: string }) {
  const rate = value ? splitRate(value.display) : null;
  return (
    <div>
      <p className="rw-label text-[var(--hero-ink-3)]">{label}</p>
      {rate ? (
        <p className="mt-2 flex flex-wrap items-baseline gap-x-2">
          <span className="rw-display rw-tnum rw-mono text-[22px] text-[var(--hero-ink)]">
            {rate.claim}
          </span>
          {rate.qualifier ? (
            <span className="rw-label rw-tnum text-[var(--hero-ink-3)]">{rate.qualifier}</span>
          ) : null}
        </p>
      ) : (
        <p className="mt-2 text-[15px] text-[var(--hero-ink-3)]">No history</p>
      )}
    </div>
  );
}

function MarketRow({ market, index }: { market: FixtureEvidenceMarketView; index: number }) {
  return (
    <Reveal
      as="li"
      index={index}
      className="border-t border-[var(--hero-line-2)] py-7 first:border-t-0 first:pt-0"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h3 className="text-[17px] font-semibold tracking-[-0.01em] text-[var(--hero-ink)]">
          {market.marketLabel}
        </h3>
        <p className="rw-label text-[var(--hero-ink-3)]">{market.selectionLabel}</p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
        <Rate value={market.homeRate} label="Home side, at home" />
        <Rate value={market.awayRate} label="Away side, away" />
        <Rate value={market.leagueBaseline} label="League" />
      </div>
      <p className="mt-4 text-[13px] leading-relaxed text-[var(--hero-ink-3)]">
        Occurrence rate — how often this market has happened, with the matches behind it. Not a
        price, and not a forecast.
      </p>
    </Reveal>
  );
}

/**
 * Split a model rate string into its claim and its qualifier.
 *
 * `82% (9/11)` is one string doing two jobs. The percentage is the claim; the denominator is what
 * licenses it. Rendering both at one weight made eight rows read as a spreadsheet — the prototype's
 * .display/.label relationship is the model, so the rate takes display weight and the sample drops
 * to label weight beside it. The string is SPLIT, never rebuilt: the model's own text is preserved
 * on both sides of the parenthesis.
 */
function splitRate(display: string): { claim: string; qualifier: string | null } {
  const m = /^(.*?)\s*\(([^)]*)\)\s*$/.exec(display);
  return m ? { claim: m[1], qualifier: m[2] } : { claim: display, qualifier: null };
}

function SignalRow({ signal, index }: { signal: FixtureEvidenceSignalView; index: number }) {
  const copy = DIRECTION_COPY[signal.direction];
  const rate = splitRate(signal.display);
  const league = signal.leagueBaseline ? splitRate(signal.leagueBaseline.display) : null;
  return (
    <Reveal
      as="li"
      index={index}
      className="grid gap-x-8 gap-y-3 border-t border-[var(--hero-line-2)] py-7 sm:grid-cols-[1fr_auto]"
    >
      <div className="min-w-0">
        <p className="text-[13px] text-[var(--hero-ink-2)]">{signal.label}</p>
        <p className="mt-2 flex flex-wrap items-baseline gap-x-2.5">
          <span className="rw-display rw-tnum rw-mono text-[26px] text-[var(--hero-ink)]">
            {rate.claim}
          </span>
          {rate.qualifier ? (
            <span className="rw-label rw-tnum text-[var(--hero-ink-3)]">{rate.qualifier}</span>
          ) : null}
          {league ? (
            <span className="rw-label rw-tnum text-[var(--hero-ink-3)]">
              league {league.claim}
            </span>
          ) : null}
        </p>
        <p className="rw-label mt-3 text-[var(--hero-ink-3)]">{signal.source}</p>
      </div>
      <div className="sm:text-right">
        <p className={`text-[13px] font-semibold ${copy.tone}`}>{copy.label}</p>
        <p className="mt-1 text-[13px] text-[var(--hero-ink-3)]">{copy.meaning}</p>
      </div>
    </Reveal>
  );
}

/** no_data — say which side is missing history, and say it plainly. */
function NoDataState({
  view,
  homeTeam,
  awayTeam,
}: {
  view: Extract<FixtureEvidenceView, { state: "no_data" }>;
  homeTeam: string;
  awayTeam: string;
}) {
  const sentence =
    view.reason === "no_venue_data"
      ? "We have no venue history for this fixture, so there is nothing to measure."
      : view.reason === "no_baseline"
        ? "This competition has not played enough matches this season for a league rate, so there is nothing to measure against."
        : "One side has played too few matches at this venue to measure anything from.";

  return (
    <div
      data-evidence-state="no_data"
      className="border-l-2 border-[var(--hero-line)] bg-[var(--hero-surface)] px-6 py-7"
    >
      <p className="rw-label text-[var(--hero-ink-3)]">No data</p>
      <p className="mt-3 max-w-[58ch] text-[15px] leading-[1.7] text-[var(--hero-ink-2)]">
        {sentence}
      </p>
      <dl className="mt-5 grid max-w-md grid-cols-2 gap-x-6 gap-y-3">
        <div>
          <dt className="rw-label text-[var(--hero-ink-3)]">{homeTeam}, at home</dt>
          <dd className="rw-mono rw-tnum mt-1 text-[15px]">
            {view.homePlayed != null ? `${view.homePlayed} matches` : "No record"}
          </dd>
        </div>
        <div>
          <dt className="rw-label text-[var(--hero-ink-3)]">{awayTeam}, away</dt>
          <dd className="rw-mono rw-tnum mt-1 text-[15px]">
            {view.awayPlayed != null ? `${view.awayPlayed} matches` : "No record"}
          </dd>
        </div>
      </dl>
      <p className="mt-5 max-w-[58ch] text-[13px] leading-relaxed text-[var(--hero-ink-3)]">
        We publish the board and state the sample behind each fixture. We do not lower the bar to
        fill the page.
      </p>
    </div>
  );
}

export function FixtureResearchSection({
  view,
  homeTeam,
  awayTeam,
}: {
  view: FixtureEvidenceView;
  homeTeam: string;
  awayTeam: string;
}) {
  if (view.state === "no_data") {
    return (
      <section aria-labelledby="research-heading" className="scroll-mt-24">
        <h2
          id="research-heading"
          className="rw-display text-[clamp(2.2rem,4.4vw,3.4rem)] text-[var(--hero-ink)]"
        >
          Research
        </h2>
        <div className="mt-6">
          <FramingNote />
        </div>
        <div className="mt-10">
          <NoDataState view={view} homeTeam={homeTeam} awayTeam={awayTeam} />
        </div>
      </section>
    );
  }

  const { model, markets, signals } = view;

  return (
    <section
      aria-labelledby="research-heading"
      data-evidence-state={view.state}
      className="scroll-mt-24"
    >
      <h2
        id="research-heading"
        className="rw-display text-[clamp(2.2rem,4.4vw,3.4rem)] text-[var(--hero-ink)]"
      >
        Research
      </h2>
      <div className="mt-6">
        <FramingNote />
      </div>

      {/* SECTION 2 — what we found */}
      <div className="mt-20">
        <h3 className="rw-label text-[var(--hero-ink-3)]">What we found</h3>
        {markets.length ? (
          <ul className="mt-6">
            {markets.map((m, i) => (
              <MarketRow key={m.marketKey} market={m} index={i} />
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-[15px] text-[var(--hero-ink-2)]">
            No market cleared the threshold on this fixture.
          </p>
        )}
      </div>

      {/* SECTION 3 — why. The centre of the page. */}
      {/*
        WHY is the centre. It gets the largest type inside Research and the most air above it;
        "What we found" above is a group marker at label weight, and the record further down is
        deliberately quieter. Three sections at one weight said all three mattered equally.
      */}
      <div className="mt-24">
        <h3 className="rw-display text-[clamp(1.9rem,3.4vw,2.8rem)] text-[var(--hero-ink)]">
          Why
        </h3>
        <p className="mt-5 max-w-[62ch] text-[16px] leading-8 text-[var(--hero-ink-2)]">
          Each rate is measured against the rate for this competition. A rate level with the league
          is not weak evidence — it is no evidence, and we say so.
        </p>
        <ul className="mt-10">
          {signals.map((s, i) => (
            <SignalRow key={s.key} signal={s} index={i} />
          ))}
        </ul>
      </div>

      {/*
        The verdict. Present because §3.5 Level 1 asks for the result, deliberately quiet because
        it is the same value on every fixture today.
      */}
      <p className="mt-14 border-t border-[var(--hero-line-2)] pt-6 text-[13px] text-[var(--hero-ink-3)]">
        Evidence: {model.qualification} · score {model.evidenceScore} · smallest sample behind a
        scored market {model.sampleSize} matches
      </p>
    </section>
  );
}

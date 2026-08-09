import { Reveal } from "@/components/motion/Reveal";
import type {
  FixtureEvidenceMarketView,
  FixtureEvidenceView,
} from "@/lib/fixtures/evidenceView";

/* ============================================================================
   THE MARKET/VENUE TABLE — level 4's research detail
   ----------------------------------------------------------------------------
   Demoted from the page's centre by the five-level conversion: the ranked
   findings (L1/L2) and the model's Why (L3) now sit above, and this section is
   the dense, per-market rate table behind them. The Why rows and the verdict
   line moved OUT with the restructure — one idea, one place — and what stays
   is what a deep reader came for.

   §3.2 still governs: no figure appears here that the provider did not
   produce, and every rate renders beside its observations — the denominator
   is the difference between "100%" and "100% (7/7)".
   ========================================================================== */

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
        <h3 id="research-heading" className="rw-display text-[22px] text-[var(--hero-ink)] sm:text-[26px]">
          Market rates
        </h3>
        <div className="mt-6">
          <FramingNote />
        </div>
        <div className="mt-10">
          <NoDataState view={view} homeTeam={homeTeam} awayTeam={awayTeam} />
        </div>
      </section>
    );
  }

  const { markets } = view;

  return (
    <section
      aria-labelledby="research-heading"
      data-evidence-state={view.state}
      className="scroll-mt-24"
    >
      <h3 id="research-heading" className="rw-display text-[22px] text-[var(--hero-ink)] sm:text-[26px]">
        Market rates
      </h3>
      <div className="mt-6">
        <FramingNote />
      </div>

      {markets.length ? (
        <ul className="mt-10">
          {markets.map((m, i) => (
            <MarketRow key={m.marketKey} market={m} index={i} />
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-[15px] text-[var(--hero-ink-2)]">
          No market cleared the threshold on this fixture.
        </p>
      )}
    </section>
  );
}

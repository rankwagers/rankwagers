import type { VenueRates } from "@/lib/fixtures/evidenceView";
import { splitRate } from "@/components/homepage/hero/heroModel";

/* ============================================================================
   THE RANKED CARD'S "WHY {pct}%?" — templated from the card's own venue facts
   ----------------------------------------------------------------------------
   The map's panel reads "Home side cleared this market in every rated home
   match; away side in every rated away match." — mock copy, true only of the
   mock fixture. Shipping that sentence verbatim would print "every rated
   match" over a 6/7, which is the fabricated observation §3.2 exists to
   forbid.

   So the sentence is BUILT, clause by clause, from the venue rates this card
   actually resolved:

     100% with a sample   →  "every rated home match (5/5)"  — true, and the
                             sample keeps it checkable
     below 100%           →  the real rate with its sample — "86% (6/7) of
                             rated home matches"
     no rate, or a rate   →  the clause is OMITTED. "Every" without a
     with no sample           denominator is a claim nobody can check.

   The bound — "a {pct}% line can still lose" — always prints: it is the whole
   reason the panel exists, and it is true at every percentage.
   ========================================================================== */

export type WhyCopy = {
  /** `Why {pct}%?` */
  title: string;
  /** `home side cleared this market in every rated home match {sample}` */
  homeAll: string;
  /** `home side cleared this market in {rate} of rated home matches` */
  homeRate: string;
  awayAll: string;
  awayRate: string;
  /** `A past rate, not a certainty — a {pct}% line can still lose.` */
  bound: string;
  /** `Full samples & reasoning:` */
  more: string;
};

const fill = (template: string, vars: Record<string, string>) =>
  Object.entries(vars).reduce((out, [k, v]) => out.replaceAll(`{${k}}`, v), template);

/** One venue clause, or `null` when this fixture's facts cannot honestly fill either template. */
function venueClause(
  display: string | undefined,
  allTemplate: string,
  rateTemplate: string
): string | null {
  if (!display) return null;
  const { rate, sample } = splitRate(display);
  const pct = Number.parseFloat(rate);
  if (!Number.isFinite(pct)) return null;
  // "Every" needs its denominator; a full rate with no sample falls through to omission.
  if (pct >= 100) return sample ? fill(allTemplate, { sample }) : null;
  return sample ? fill(rateTemplate, { rate: `${rate} ${sample}` }) : null;
}

export type RankedWhy = {
  title: string;
  /** The assembled venue sentence, or `null` when no clause survived — the panel omits the line. */
  venueSentence: string | null;
  bound: string;
  more: string;
};

export function buildRankedWhy(
  probability: number,
  rates: VenueRates | null | undefined,
  copy: WhyCopy
): RankedWhy {
  const pct = String(probability);
  const clauses = [
    venueClause(rates?.home?.display, copy.homeAll, copy.homeRate),
    venueClause(rates?.away?.display, copy.awayAll, copy.awayRate),
  ].filter((clause): clause is string => clause !== null);

  const venueSentence =
    clauses.length > 0
      ? `${clauses.join("; ")}.`.replace(/^./, (ch) => ch.toUpperCase())
      : null;

  return {
    title: fill(copy.title, { pct }),
    venueSentence,
    bound: fill(copy.bound, { pct }),
    more: copy.more,
  };
}

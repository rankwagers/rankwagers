import { OperatorEvidenceCardList } from "@/components/operators/OperatorEvidenceCard";
import { buildOperatorEvidenceCards, recommendableCards } from "@/lib/operators/evidenceCard";
import type { Locale } from "@/lib/i18n";
import type { OperatorCountryAvailability, Operator } from "@/lib/operators/types";
import type { PredictionStrings } from "@/lib/translations/predictionsEn";

/* ============================================================================
   L5 — OPERATORS. LAST, AS ALWAYS.
   ----------------------------------------------------------------------------
   The commercial block closes the page, below every content level including
   the evidence archive — the separation is a property of the layout, not a
   sentence. Ruled mono rows in the quietest register; no card ground, no
   colour, the one affordance the bordered-arrow grammar the rest of the site
   uses. Empty states omit rather than apologise.
   ========================================================================== */

export function FixtureOperatorsSection({
  locale,
  operators,
  visitorCountry,
  matchId,
  focusMarket,
  p,
}: {
  locale: Locale;
  operators: ReadonlyArray<{ operator: Operator; availability: OperatorCountryAvailability }>;
  visitorCountry: string;
  matchId: number;
  focusMarket: string | null;
  p: PredictionStrings;
}) {
  return (
    <section aria-labelledby="fx-operators-heading" className="mt-20">
      <div className="rw-m flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b-[0.5px] border-[var(--hero-ink-2)] pb-2 text-[var(--hero-ink-2)]">
        <h2 id="fx-operators-heading" className="uppercase tracking-[0.14em]">
          {p.fxOperatorsTitle}
        </h2>
      </div>
      <p className="rw-m mt-2 normal-case tracking-[0.04em] text-[var(--hero-ink-2)]">
        {p.fxOperatorsNote}
      </p>

      {/*
        ONE AFFILIATE BLOCK. The signed-offers list that rendered here duplicated the evidence
        cards below — two commercial blocks on one page, saying overlapping things with
        different chrome. The cards carry more (verification, availability, the derivation), so
        they are the block; the section's heading and separation note stay.
      */}

      <div className="mt-8">
        <OperatorEvidenceCardList
          cards={recommendableCards(
            buildOperatorEvidenceCards(
              operators.map(({ operator, availability }) => ({
                operator,
                availability,
                marketKey: null,
              })),
              { nowIso: new Date().toISOString(), limit: 3 }
            )
          )}
          locale={locale}
          country={visitorCountry}
          surface="fixture"
          headingId="operator-recommendations"
          heading="Recommended operators"
          fixtureId={matchId}
          market={focusMarket}
        />
      </div>
    </section>
  );
}

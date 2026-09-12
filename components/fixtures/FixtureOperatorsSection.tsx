import { OperatorEvidenceCardList } from "@/components/operators/OperatorEvidenceCard";
import { OperatorsMatrix } from "@/components/fixtures/v31/OperatorsMatrix";
import { buildOperatorEvidenceCards, recommendableCards } from "@/lib/operators/evidenceCard";
import type { Locale } from "@/lib/i18n";
import type { OperatorCountryAvailability, Operator } from "@/lib/operators/types";
import type { PricePanelData } from "@/lib/operators/pricePanel.server";
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
  prices,
}: {
  locale: Locale;
  operators: ReadonlyArray<{ operator: Operator; availability: OperatorCountryAvailability }>;
  visitorCountry: string;
  matchId: number;
  focusMarket: string | null;
  p: PredictionStrings;
  /** Fixture v3.1 — the observed panel data behind the operators × markets matrix. */
  prices?: PricePanelData;
}) {
  const operatorLogos: Record<string, string | null> = {};
  for (const { operator } of operators) {
    operatorLogos[operator.slug] = operator.logo ?? null;
  }
  return (
    <section aria-labelledby="fx-operators-heading" className="mt-20">
      <div
        className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 pb-2"
        style={{ borderBottom: "1px solid var(--line)" }}
      >
        <h2 id="fx-operators-heading" className="rw3-label">
          {p.fxOperatorsTitle}
        </h2>
      </div>
      <p className="rw3-meta mt-2">
        {p.fxOperatorsNote}
      </p>

      {/*
        FIXTURE v3.1 — the operators × markets matrix: observed ghost odds,
        the top price outlined, "—" for no observation, one Best badge, a
        ghost Continue per row. No observed market → no matrix.
      */}
      {prices ? <OperatorsMatrix prices={prices} operatorLogos={operatorLogos} p={p} /> : null}

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

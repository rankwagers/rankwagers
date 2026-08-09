import { OperatorEvidenceCardList } from "@/components/operators/OperatorEvidenceCard";
import { buildOperatorEvidenceCards, recommendableCards } from "@/lib/operators/evidenceCard";
import type { Locale } from "@/lib/i18n";
import type { OperatorCountryAvailability, Operator } from "@/lib/operators/types";
import type { PredictionStrings } from "@/lib/translations/predictionsEn";
import { V2ArrowLabel } from "@/components/homepage/v2Chrome";

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
  signedOffers,
  operators,
  visitorCountry,
  matchId,
  focusMarket,
  p,
}: {
  locale: Locale;
  signedOffers: ReadonlyArray<{ slug: string; displayName: string; outboundPath: string }>;
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

      {signedOffers.length ? (
        <ul className="mt-3">
          {signedOffers.slice(0, 4).map((offer) => (
            <li key={offer.slug}>
              <a
                href={offer.outboundPath}
                rel="noopener sponsored"
                className="rw-row grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3.5 border-b-[0.5px] border-[var(--hero-line)] py-2.5 pl-3.5"
              >
                <span className="rw-m truncate text-[var(--hero-ink)]">{offer.displayName}</span>
                <span className="rw-m text-[var(--hero-ink)]">
                  <V2ArrowLabel text="Continue" />
                </span>
              </a>
            </li>
          ))}
        </ul>
      ) : null}

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

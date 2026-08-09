import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import type { OperatorCardSurface } from "@/lib/analytics/operatorCard";
import { getOperator } from "@/lib/operators/registry";
import { operatorAffiliateHref, operatorPath } from "@/lib/operators/links";
import {
  OPERATOR_RANKING_BASIS,
  OPERATOR_RANKING_LIMITATIONS,
  type OperatorEvidenceCardModel,
} from "@/lib/operators/evidenceCard";
import { getFeatureFlags } from "@/lib/config/featureFlags";
import { OperatorEvidenceCardAnalytics } from "./OperatorEvidenceCardAnalytics";
import { Check, Minus } from "lucide-react";

/**
 * Evidence-aware operator recommendation card (Sprint 21).
 *
 * SERVER COMPONENT. The outbound href is produced here by `operatorAffiliateHref`, which keeps
 * `buildGoPath` on the server — the same boundary `BrandListSection` documents. A client component
 * must never construct a signed outbound path.
 *
 * The card never states a recommendation without its derivation. Rank, evidence score and every
 * contributing reason are rendered, including the reasons that were NOT met.
 */

export type OperatorEvidenceCardProps = {
  card: OperatorEvidenceCardModel;
  locale: Locale;
  country: string;
  surface: OperatorCardSurface;
  position: number;
  fixtureId?: number | null;
  market?: string | null;
};

function ScoreMeter({ score, max }: { score: number; max: number }) {
  const pct = max > 0 ? Math.round((score * 100) / max) : 0;
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-1.5 w-24 overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={`Ranking score ${score} out of ${max}`}
      >
        <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono text-xs text-muted-foreground">
        {score}/{max}
      </span>
    </div>
  );
}

export function OperatorEvidenceCard({
  card,
  locale,
  country,
  surface,
  position,
  fixtureId = null,
  market = null,
  showScore = true,
}: OperatorEvidenceCardProps & { showScore?: boolean }) {
  const operator = getOperator(card.slug);
  if (!operator) return null;

  // Falls back to the internal profile when the operator is not affiliate-enabled. That fallback
  // lives in operatorAffiliateHref, so a disabled operator can never produce an outbound link.
  const primaryHref = operatorAffiliateHref(operator, locale, country);
  const secondaryHref = operatorPath(locale, card.slug);
  const isOutbound = primaryHref !== secondaryHref;
  const detailsId = `operator-evidence-${card.slug}`;

  return (
    <OperatorEvidenceCardAnalytics
      context={{
        surface,
        operatorSlug: card.slug,
        locale,
        fixtureId,
        market,
        position,
        evidenceScore: card.evidenceScore,
        qualification: card.qualification,
      }}
    >
      <article
        className="rounded-lg border border-[var(--border-subtle)] bg-background p-4"
        aria-labelledby={`${detailsId}-name`}
        data-operator-slug={card.slug}
        data-evidence-score={card.evidenceScore}
        data-qualification={card.qualification}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            {card.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={card.logo}
                alt=""
                width={40}
                height={40}
                loading="lazy"
                className="h-10 w-10 shrink-0 rounded-md object-contain"
              />
            ) : (
              <span
                aria-hidden="true"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[var(--border-subtle)] font-display text-sm"
              >
                {card.name.slice(0, 2).toUpperCase()}
              </span>
            )}
            <div>
              <h3 id={`${detailsId}-name`} className="font-display text-base font-semibold">
                <span className="sr-only">{`Rank ${position}: `}</span>
                {card.name}
              </h3>
              <p className="text-xs text-muted-foreground">{card.availabilityLabel}</p>
            </div>
          </div>

          <div className="text-right">
            <span
              className="inline-block rounded-full border border-[var(--border-subtle)] px-2 py-0.5 text-xs"
              title={card.qualificationExplanation}
            >
              {card.qualificationLabel}
            </span>
          </div>
        </div>

        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          {/*
            THE SCORE METER NEEDS A PRICE TO MEAN ANYTHING. With no observed price at ANY
            operator in the set, every card scores identically on availability alone, and a row
            of identical 67/100 meters reads as fake precision. The meter is omitted whole in
            that state (empty-state law); verification and availability carry the card, and the
            order is the stated tie-break — evidence score, then slug — unchanged.
          */}
          {showScore ? (
            <div>
              {/* An operator ranking, not football evidence — §18.4 keeps the two words apart. */}
              <dt className="text-xs text-muted-foreground">Ranking score</dt>
              <dd className="mt-1">
                <ScoreMeter score={card.evidenceScore} max={card.maxEvidenceScore} />
              </dd>
            </div>
          ) : null}
          <div>
            <dt className="text-xs text-muted-foreground">Observed price</dt>
            <dd className="mt-1 font-mono">
              {card.observedPriceLabel ?? <span className="text-muted-foreground">Not observed</span>}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Markets</dt>
            <dd className="mt-1">{card.supportedMarkets.length}</dd>
          </div>
        </dl>

        {card.supportedMarkets.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Supported markets">
            {card.supportedMarkets.map((m) => (
              <li
                key={m.key}
                className="rounded border border-[var(--border-subtle)] px-1.5 py-0.5 text-xs text-muted-foreground"
              >
                {m.label}
              </li>
            ))}
          </ul>
        )}

        {/*
          Native disclosure: keyboard-operable, screen-reader-announced and functional with no
          JavaScript. The analytics wrapper only listens; it does not drive this.
        */}
        <details className="mt-3 group">
          <summary className="cursor-pointer list-none text-sm font-medium underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 hover:underline">
            Why this operator?
          </summary>
          <ul className="mt-2 space-y-1" aria-label={`Evidence for ${card.name}`}>
            {card.reasons.map((reason) => (
              <li key={reason.code} className="flex items-start gap-2 text-sm">
                <span aria-hidden="true" className={reason.satisfied ? "text-brand" : "text-muted-foreground"}>
                  {reason.satisfied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Minus className="h-3.5 w-3.5" aria-hidden />}
                </span>
                <span className={reason.satisfied ? "" : "text-muted-foreground"}>
                  <span className="sr-only">{reason.satisfied ? "Met: " : "Not met: "}</span>
                  {reason.label}
                </span>
              </li>
            ))}
          </ul>
          {card.freshnessLabel && (
            <p className="mt-2 text-xs text-muted-foreground">{card.freshnessLabel}</p>
          )}
        </details>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {isOutbound ? (
            <a
              href={primaryHref}
              data-operator-cta="primary"
              rel="sponsored nofollow noopener"
              target="_blank"
              className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-background outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
            >
              View odds
              <span className="sr-only">{` at ${card.name} (opens in a new tab)`}</span>
            </a>
          ) : (
            <Link
              href={secondaryHref}
              data-operator-cta="primary"
              className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-background outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
            >
              View odds
              <span className="sr-only">{` at ${card.name}`}</span>
            </Link>
          )}

          <Link
            href={secondaryHref}
            data-operator-cta="secondary"
            className="rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          >
            Operator details
            <span className="sr-only">{` for ${card.name}`}</span>
          </Link>
        </div>
      </article>
    </OperatorEvidenceCardAnalytics>
  );
}

/**
 * The ranked list plus its disclosed basis.
 *
 * The basis is not optional chrome. `hasUnqualifiedRanking` treats an ordered operator list with no
 * stated grounds as an unqualified claim, so omitting it would fail the trust guard — which is the
 * guard working as intended.
 */
export function OperatorEvidenceCardList({
  cards,
  locale,
  country,
  surface,
  headingId = "operators",
  heading = "Operators for this market",
  fixtureId = null,
  market = null,
}: {
  cards: readonly OperatorEvidenceCardModel[];
  locale: Locale;
  country: string;
  surface: OperatorCardSurface;
  headingId?: string;
  heading?: string;
  fixtureId?: number | null;
  market?: string | null;
}) {
  const anyPriceObserved = cards.some((card) => card.observedPriceLabel != null);
  /*
   * One gate, in the one place every surface passes through.
   *
   * Gating at each call site would work until someone added a fourth surface and forgot. The flag
   * defaults false in every environment, so the entire outbound layer is dark until it is turned
   * on deliberately — the same posture operatorApprovalEnabled uses.
   */
  if (!getFeatureFlags().affiliateOperatorsVisible) return null;
  if (!cards.length) return null;

  return (
    <section
      className="border-b border-[var(--border-subtle)] py-8"
      aria-labelledby={headingId}
      data-analytics-section="operator_evidence_cards"
    >
      <h2 id={headingId} className="font-display text-xl font-semibold text-foreground">
        {heading}
      </h2>

      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{OPERATOR_RANKING_BASIS}</p>

      <div className="mt-4 grid gap-3">
        {cards.map((card, index) => (
          <OperatorEvidenceCard
            key={card.slug}
            card={card}
            locale={locale}
            country={country}
            surface={surface}
            position={index + 1}
            fixtureId={fixtureId}
            market={market}
            showScore={anyPriceObserved}
          />
        ))}
      </div>

      <ul className="mt-4 space-y-1 text-xs text-muted-foreground">
        {OPERATOR_RANKING_LIMITATIONS.map((limitation) => (
          <li key={limitation}>{limitation}</li>
        ))}
      </ul>
    </section>
  );
}

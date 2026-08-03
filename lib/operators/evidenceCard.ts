/**
 * Evidence-aware operator recommendation model (Sprint 21).
 *
 * WHY THIS EXISTS
 *
 * Before this sprint the only outbound affiliate surface in the product was the operator detail
 * page, so every other template had to send a visitor on a detour to convert. The obvious fix —
 * drop a "Bet now" button on fixture pages — is the one the manifesto forbids: it recommends an
 * operator without saying why, which is marketing wearing the clothes of a finding.
 *
 * This module is the answer to that. It turns a recommendation into a DERIVATION: every card
 * carries the reasons that produced it, and the ranking is reproducible from its inputs. If a
 * reason cannot be evidenced, the operator does not earn the position.
 *
 * PURITY
 *
 * No I/O, no `process.env`, no clock. `nowIso` is injected so a card rendered from the same inputs
 * is byte-identical on every machine and in every test — the same discipline `lib/trust/` follows.
 * A ranking that changes when nothing changed is not evidence.
 */

import type {
  Operator,
  OperatorCountryAvailability,
  OperatorMarketKey,
} from "./types";
import { OPERATOR_MARKET_META } from "./types";

/* ------------------------------------------------------------------ *
 * Reasons
 * ------------------------------------------------------------------ */

export type EvidenceReasonCode =
  | "AVAILABLE_IN_COUNTRY"
  | "SUPPORTS_MARKET"
  | "SUPPORTS_ACCUMULATOR"
  | "HIGHEST_OBSERVED_PRICE"
  | "PRICE_RECENTLY_OBSERVED"
  | "VERIFICATION_CONFIRMED";

/**
 * A single line of the "Why this operator?" block.
 *
 * `satisfied: false` entries are RENDERED, not hidden. A card that silently drops the reasons it
 * failed is back to being an advert: the reader cannot tell the difference between "we checked and
 * it holds" and "we never checked". Showing the unmet condition is the cheaper, more honest signal.
 */
export type EvidenceReason = {
  code: EvidenceReasonCode;
  label: string;
  satisfied: boolean;
  /** Points this reason contributed to the evidence score. Zero when unsatisfied. */
  weight: number;
};

/**
 * Deterministic weights. Integers, so the score is exact and never drifts through float addition.
 *
 * The ordering encodes the product's priorities: an operator a visitor cannot legally use is worth
 * nothing regardless of price, so availability dominates; price is a tie-breaker, never the lead.
 */
export const EVIDENCE_WEIGHTS: Readonly<Record<EvidenceReasonCode, number>> = {
  AVAILABLE_IN_COUNTRY: 40,
  VERIFICATION_CONFIRMED: 25,
  SUPPORTS_MARKET: 15,
  PRICE_RECENTLY_OBSERVED: 10,
  HIGHEST_OBSERVED_PRICE: 8,
  SUPPORTS_ACCUMULATOR: 2,
};

export const MAX_EVIDENCE_SCORE = Object.values(EVIDENCE_WEIGHTS).reduce((a, b) => a + b, 0);

/** How recently a price must have been observed to count as fresh. */
export const PRICE_FRESHNESS_WINDOW_MS = 15 * 60 * 1000;

/* ------------------------------------------------------------------ *
 * Qualification
 * ------------------------------------------------------------------ */

export type OperatorQualification = "QUALIFIED" | "PROVISIONAL" | "NOT_QUALIFIED";

/*
 * §18.4 — one idea, one word. "Qualified" is the evidence model's verdict on a FIXTURE; reusing
 * it for an operator made one word carry two unrelated meanings on the same page. An operator
 * that passed our checks is "Verified".
 */
export const QUALIFICATION_LABEL: Readonly<Record<OperatorQualification, string>> = {
  QUALIFIED: "Verified",
  PROVISIONAL: "Provisional",
  NOT_QUALIFIED: "Not qualified",
};

export const QUALIFICATION_EXPLANATION: Readonly<Record<OperatorQualification, string>> = {
  QUALIFIED: "Available for your country and independently verified.",
  PROVISIONAL: "Available for your country, but verification is still outstanding.",
  NOT_QUALIFIED: "Not currently available for your country.",
};

/* ------------------------------------------------------------------ *
 * Inputs and outputs
 * ------------------------------------------------------------------ */

export type OperatorEvidenceInput = {
  operator: Operator;
  availability: OperatorCountryAvailability;
  /** The market this page is about, when the page has one. Null on competition pages. */
  marketKey?: OperatorMarketKey | null;
  /** Highest price observed at this operator for `marketKey`. Never fabricated. */
  observedPrice?: number | null;
  /** When `observedPrice` was observed, ISO 8601. */
  observedAtIso?: string | null;
};

export type OperatorEvidenceCardModel = {
  slug: string;
  name: string;
  logo: string | null;
  available: boolean;
  availabilityLabel: string;
  visitorCountry: string;
  supportedMarkets: ReadonlyArray<{ key: OperatorMarketKey; label: string }>;
  observedPrice: number | null;
  observedPriceLabel: string | null;
  observedAtIso: string | null;
  freshnessLabel: string | null;
  evidenceScore: number;
  maxEvidenceScore: number;
  qualification: OperatorQualification;
  qualificationLabel: string;
  qualificationExplanation: string;
  reasons: readonly EvidenceReason[];
  /** True when this operator holds the highest observed price in the evaluated set. */
  holdsHighestPrice: boolean;
};

/* ------------------------------------------------------------------ *
 * Formatting helpers
 * ------------------------------------------------------------------ */

/**
 * Decimal odds to a stable 2dp string.
 *
 * `toFixed` is used deliberately rather than `Intl.NumberFormat`: number formatting is
 * locale-dependent, and a price that renders as "2.10" on one server and "2,10" on another is a
 * server/client hydration mismatch waiting to happen on a server-rendered card.
 */
export function formatObservedPrice(price: number | null | undefined): string | null {
  if (price == null || !Number.isFinite(price) || price <= 1) return null;
  return price.toFixed(2);
}

/**
 * A coarse, honest freshness label.
 *
 * Buckets rather than exact minutes, because the precision of "2 minutes ago" implies a guarantee
 * about propagation delay the pipeline does not make.
 */
export function formatFreshness(
  observedAtIso: string | null | undefined,
  nowIso: string,
): string | null {
  if (!observedAtIso) return null;
  const observed = Date.parse(observedAtIso);
  const now = Date.parse(nowIso);
  if (!Number.isFinite(observed) || !Number.isFinite(now)) return null;

  const deltaMs = now - observed;
  // A price stamped in the future is a clock or pipeline fault. Report it as unknown rather than
  // rendering a negative age or silently clamping it to "just now".
  if (deltaMs < 0) return null;

  const minutes = Math.floor(deltaMs / 60000);
  if (minutes < 1) return "Updated less than a minute ago";
  if (minutes === 1) return "Updated 1 minute ago";
  if (minutes < 60) return `Updated ${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours === 1) return "Updated 1 hour ago";
  if (hours < 24) return `Updated ${hours} hours ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "Updated 1 day ago" : `Updated ${days} days ago`;
}

function isPriceFresh(
  observedAtIso: string | null | undefined,
  nowIso: string,
): boolean {
  if (!observedAtIso) return false;
  const observed = Date.parse(observedAtIso);
  const now = Date.parse(nowIso);
  if (!Number.isFinite(observed) || !Number.isFinite(now)) return false;
  const deltaMs = now - observed;
  return deltaMs >= 0 && deltaMs <= PRICE_FRESHNESS_WINDOW_MS;
}

/* ------------------------------------------------------------------ *
 * Model construction
 * ------------------------------------------------------------------ */

function marketsFor(operator: Operator): Array<{ key: OperatorMarketKey; label: string }> {
  return operator.supportedMarkets.map((key) => ({
    key,
    label: OPERATOR_MARKET_META[key]?.label ?? key,
  }));
}

function buildOne(
  input: OperatorEvidenceInput,
  highestPriceInSet: number | null,
  nowIso: string,
): OperatorEvidenceCardModel {
  const { operator, availability } = input;
  const marketKey = input.marketKey ?? null;
  const price = formatObservedPrice(input.observedPrice) ? input.observedPrice ?? null : null;

  const available = availability.available;
  const verified = operator.verificationStatus === "verified";
  const supportsMarket = marketKey ? operator.supportedMarkets.includes(marketKey) : false;
  const fresh = isPriceFresh(input.observedAtIso, nowIso);
  const holdsHighestPrice =
    price != null && highestPriceInSet != null && price === highestPriceInSet;
  // Accumulator support is inferred from breadth, not asserted: an operator offering a single
  // market cannot combine legs. This is a weak signal and is weighted accordingly.
  const supportsAccumulator = operator.supportedMarkets.length > 1;

  const reason = (
    code: EvidenceReasonCode,
    label: string,
    satisfied: boolean,
  ): EvidenceReason => ({
    code,
    label,
    satisfied,
    weight: satisfied ? EVIDENCE_WEIGHTS[code] : 0,
  });

  const reasons: EvidenceReason[] = [
    reason(
      "AVAILABLE_IN_COUNTRY",
      available ? "Available in your country" : "Not available in your country",
      available,
    ),
    reason(
      "VERIFICATION_CONFIRMED",
      verified ? "Licence and identity verified" : "Verification outstanding",
      verified,
    ),
  ];

  if (marketKey) {
    reasons.push(
      reason(
        "SUPPORTS_MARKET",
        supportsMarket
          ? `Supports ${OPERATOR_MARKET_META[marketKey]?.label ?? marketKey}`
          : `Does not list ${OPERATOR_MARKET_META[marketKey]?.label ?? marketKey}`,
        supportsMarket,
      ),
    );
  }

  reasons.push(
    reason(
      "SUPPORTS_ACCUMULATOR",
      supportsAccumulator
        ? "Multiple markets, so legs can be combined"
        : "Single market only, legs cannot be combined",
      supportsAccumulator,
    ),
  );

  if (price != null) {
    reasons.push(
      reason(
        "HIGHEST_OBSERVED_PRICE",
        holdsHighestPrice
          ? "Highest observed price for this market"
          : "Observed price is below the highest in this comparison",
        holdsHighestPrice,
      ),
      reason(
        "PRICE_RECENTLY_OBSERVED",
        fresh ? "Price observed in the last 15 minutes" : "Price observation is older than 15 minutes",
        fresh,
      ),
    );
  }

  const evidenceScore = reasons.reduce((sum, r) => sum + r.weight, 0);

  const qualification: OperatorQualification = !available
    ? "NOT_QUALIFIED"
    : verified
      ? "QUALIFIED"
      : "PROVISIONAL";

  return {
    slug: operator.slug,
    name: operator.name,
    logo: operator.logo ?? null,
    available,
    availabilityLabel: availability.label,
    visitorCountry: availability.visitorCountry,
    supportedMarkets: marketsFor(operator),
    observedPrice: price,
    observedPriceLabel: formatObservedPrice(price),
    observedAtIso: input.observedAtIso ?? null,
    freshnessLabel: formatFreshness(input.observedAtIso, nowIso),
    evidenceScore,
    maxEvidenceScore: MAX_EVIDENCE_SCORE,
    qualification,
    qualificationLabel: QUALIFICATION_LABEL[qualification],
    qualificationExplanation: QUALIFICATION_EXPLANATION[qualification],
    reasons,
    holdsHighestPrice,
  };
}

/* ------------------------------------------------------------------ *
 * Ranking
 * ------------------------------------------------------------------ */

/**
 * The disclosed basis for the order. Rendered verbatim beside the list.
 *
 * `lib/trust/claims.ts` treats a ranking with no stated basis as an unqualified claim, so this
 * string is not decoration — without it the card list would fail the claim guard, which is exactly
 * the outcome the guard is designed to produce.
 */
export const OPERATOR_RANKING_BASIS =
  "Operators you can use in your country are listed first — availability is a precondition, not " +
  "something a good price can outweigh. Within that group the order is by evidence score: " +
  "verification status, support for this market, how recently a price was observed, and the " +
  "observed price. Equal scores are ordered by slug so the sequence never changes between requests.";

export const OPERATOR_RANKING_LIMITATIONS: readonly string[] = [
  "Prices are point-in-time observations, not quotes, and may have moved since they were recorded.",
  "Availability reflects the country we detected for this request, not your account eligibility.",
  "An operator absent from this list is not a judgement about it — it may simply not list this market.",
];

/**
 * Rank operators deterministically.
 *
 * Sorting is by score descending with an explicit slug tie-break. `localeCompare` is deliberately
 * NOT used: it depends on the runtime's ICU data, so two servers could legitimately disagree about
 * the order of two equally-scored operators. For a ranking the product asks readers to trust, a
 * byte-wise comparison that is identical everywhere is worth more than alphabetical niceness.
 */
export function buildOperatorEvidenceCards(
  inputs: readonly OperatorEvidenceInput[],
  options: { nowIso: string; limit?: number },
): OperatorEvidenceCardModel[] {
  const prices = inputs
    .map((i) => (formatObservedPrice(i.observedPrice) ? i.observedPrice ?? null : null))
    .filter((p): p is number => p != null);
  const highestPriceInSet = prices.length ? Math.max(...prices) : null;

  const cards = inputs.map((input) => buildOne(input, highestPriceInSet, options.nowIso));

  cards.sort((left, right) => {
    /*
     * Availability is a GATE, not a weight.
     *
     * The first version scored it at 40 points and let it compete with everything else. It lost:
     * verified + market + fresh + highest price sums to 60, so an operator a visitor legally cannot
     * use outranked one they could, purely on price. A regression test pins this.
     *
     * No weight can fix that safely — any number large enough to dominate today is a number that
     * silently stops dominating the moment a factor is added. Partitioning first is the only form
     * that stays correct as the scoring evolves.
     */
    if (left.available !== right.available) return left.available ? -1 : 1;

    if (left.evidenceScore !== right.evidenceScore) {
      return right.evidenceScore - left.evidenceScore;
    }
    if (left.slug < right.slug) return -1;
    if (left.slug > right.slug) return 1;
    return 0;
  });

  const limit = options.limit;
  return typeof limit === "number" && limit >= 0 ? cards.slice(0, limit) : cards;
}

/**
 * Cards a page may legitimately present as recommendations.
 *
 * An operator a visitor cannot use is not a recommendation, it is noise with a CTA attached. The
 * caller decides whether to render the remainder as context; nothing in this module hides it.
 */
export function recommendableCards(
  cards: readonly OperatorEvidenceCardModel[],
): OperatorEvidenceCardModel[] {
  return cards.filter((c) => c.qualification !== "NOT_QUALIFIED");
}

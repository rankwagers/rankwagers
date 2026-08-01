import assert from "node:assert/strict";
import test from "node:test";
import {
  EVIDENCE_WEIGHTS,
  MAX_EVIDENCE_SCORE,
  OPERATOR_RANKING_BASIS,
  OPERATOR_RANKING_LIMITATIONS,
  buildOperatorEvidenceCards,
  formatFreshness,
  formatObservedPrice,
  recommendableCards,
  type OperatorEvidenceInput,
} from "../lib/operators/evidenceCard";
import { findClaimViolations, hasUnqualifiedRanking } from "../lib/trust/claims";
import type { Operator, OperatorCountryAvailability } from "../lib/operators/types";

/**
 * Sprint 21 — evidence-aware operator CTA layer.
 *
 * The card exists to make a recommendation defensible, so most of this suite is adversarial: it
 * checks that the model cannot produce a recommendation it has not evidenced, cannot reorder itself
 * between identical requests, and cannot emit language the trust guard rejects.
 */

const NOW = "2026-07-28T12:00:00.000Z";

function operator(overrides: Partial<Operator> = {}): Operator {
  return {
    slug: "acme",
    name: "Acme",
    description: "",
    supportedCountries: ["GB"],
    supportedMarkets: ["over15", "over25"],
    website: "https://example.invalid",
    affiliateEnabled: true,
    verificationStatus: "verified",
    foundedYear: null,
    headquarters: null,
    highlights: [],
    licenses: [],
    apiFootballBookmakerIds: [],
    ...overrides,
  } as Operator;
}

function availability(available: boolean): OperatorCountryAvailability {
  return {
    visitorCountry: "GB",
    available,
    label: available ? "Available in your country" : "Not currently available",
  };
}

function input(overrides: Partial<OperatorEvidenceInput> = {}): OperatorEvidenceInput {
  return {
    operator: operator(),
    availability: availability(true),
    marketKey: "over25",
    observedPrice: 2.1,
    observedAtIso: "2026-07-28T11:55:00.000Z",
    ...overrides,
  };
}

const build = (inputs: OperatorEvidenceInput[], limit?: number) =>
  buildOperatorEvidenceCards(inputs, { nowIso: NOW, limit });

/* ================================================================== *
 * 1. Determinism
 * ================================================================== */

test("ranking is deterministic for identical inputs", () => {
  const inputs = [
    input({ operator: operator({ slug: "b" }) }),
    input({ operator: operator({ slug: "a" }) }),
    input({ operator: operator({ slug: "c" }) }),
  ];
  assert.deepEqual(build(inputs), build(inputs));
});

test("equal scores are broken by slug, not by input order", () => {
  const forward = build([
    input({ operator: operator({ slug: "zulu" }) }),
    input({ operator: operator({ slug: "alpha" }) }),
  ]);
  const reversed = build([
    input({ operator: operator({ slug: "alpha" }) }),
    input({ operator: operator({ slug: "zulu" }) }),
  ]);
  assert.deepEqual(
    forward.map((c) => c.slug),
    ["alpha", "zulu"],
  );
  assert.deepEqual(
    forward.map((c) => c.slug),
    reversed.map((c) => c.slug),
    "input order must not affect the published order",
  );
});

test("the model never reads the clock itself", () => {
  // Two builds with different injected times must differ, proving `nowIso` is actually used and
  // that nothing inside reaches for Date.now().
  const later = buildOperatorEvidenceCards([input()], { nowIso: "2026-07-29T12:00:00.000Z" });
  const now = build([input()]);
  assert.notEqual(later[0].freshnessLabel, now[0].freshnessLabel);
});

/* ================================================================== *
 * 2. Scoring
 * ================================================================== */

test("REGRESSION: availability gates the order and cannot be outweighed by score", () => {
  /*
   * An operator a visitor cannot use must never outrank one they can, no matter how good its price
   * or how fresh the observation. This is the ordering rule the whole card depends on.
   */
  const unavailableButPerfect = input({
    operator: operator({ slug: "blocked", verificationStatus: "verified" }),
    availability: availability(false),
    observedPrice: 9.99,
    observedAtIso: NOW,
  });
  const availableButWeak = input({
    operator: operator({ slug: "usable", verificationStatus: "unverified", supportedMarkets: ["over25"] }),
    availability: availability(true),
    observedPrice: 1.5,
    observedAtIso: "2026-07-01T00:00:00.000Z",
  });
  const [first, second] = build([unavailableButPerfect, availableButWeak]);
  assert.equal(first.slug, "usable");
  // And prove the trap: the blocked operator genuinely scores HIGHER, yet still ranks second.
  assert.ok(
    second.evidenceScore > first.evidenceScore,
    "this test is only meaningful while the blocked operator out-scores the usable one",
  );
});

test("the score is the exact sum of satisfied reason weights", () => {
  const [card] = build([input()]);
  const expected = card.reasons.reduce((sum, r) => sum + r.weight, 0);
  assert.equal(card.evidenceScore, expected);
  assert.ok(card.evidenceScore <= MAX_EVIDENCE_SCORE);
});

test("an unsatisfied reason contributes exactly zero", () => {
  const [card] = build([input({ availability: availability(false) })]);
  const availabilityReason = card.reasons.find((r) => r.code === "AVAILABLE_IN_COUNTRY");
  assert.equal(availabilityReason?.satisfied, false);
  assert.equal(availabilityReason?.weight, 0);
});

test("weights are integers so the score never drifts", () => {
  for (const [code, weight] of Object.entries(EVIDENCE_WEIGHTS)) {
    assert.ok(Number.isInteger(weight), `${code} weight must be an integer`);
  }
});

test("only one operator can hold the highest observed price", () => {
  const cards = build([
    input({ operator: operator({ slug: "a" }), observedPrice: 2.5 }),
    input({ operator: operator({ slug: "b" }), observedPrice: 2.1 }),
    input({ operator: operator({ slug: "c" }), observedPrice: 1.9 }),
  ]);
  assert.deepEqual(
    cards.filter((c) => c.holdsHighestPrice).map((c) => c.slug),
    ["a"],
  );
});

/* ================================================================== *
 * 3. Never recommend without evidence
 * ================================================================== */

test("every card carries at least one reason", () => {
  for (const card of build([input(), input({ availability: availability(false) })])) {
    assert.ok(card.reasons.length > 0, `${card.slug} has no derivation`);
  }
});

test("unmet reasons are RETAINED, not filtered away", () => {
  /*
   * A card that shows only its wins is an advert. The reader must be able to tell the difference
   * between "checked and it holds" and "never checked".
   */
  const [card] = build([input({ operator: operator({ verificationStatus: "unverified" }) })]);
  const unmet = card.reasons.filter((r) => !r.satisfied);
  assert.ok(unmet.length > 0);
  assert.ok(unmet.some((r) => r.code === "VERIFICATION_CONFIRMED"));
});

test("an unavailable operator is never recommendable", () => {
  const cards = build([
    input({ operator: operator({ slug: "ok" }) }),
    input({ operator: operator({ slug: "blocked" }), availability: availability(false) }),
  ]);
  assert.deepEqual(
    recommendableCards(cards).map((c) => c.slug),
    ["ok"],
  );
});

test("qualification reflects availability and verification, nothing else", () => {
  const [qualified] = build([input()]);
  assert.equal(qualified.qualification, "QUALIFIED");

  const [provisional] = build([input({ operator: operator({ verificationStatus: "unverified" }) })]);
  assert.equal(provisional.qualification, "PROVISIONAL");

  const [not] = build([input({ availability: availability(false) })]);
  assert.equal(not.qualification, "NOT_QUALIFIED");
});

/* ================================================================== *
 * 4. Prices are never fabricated
 * ================================================================== */

test("a missing or nonsensical price is reported as absent, never invented", () => {
  for (const bad of [null, undefined, 0, 1, -2, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(formatObservedPrice(bad as number | null), null, `must reject ${String(bad)}`);
  }
  assert.equal(formatObservedPrice(2.1), "2.10");
});

test("price formatting is locale-independent", () => {
  // A decimal comma on one server and a point on another is a hydration mismatch.
  assert.equal(formatObservedPrice(1.5), "1.50");
  assert.match(formatObservedPrice(2.005) ?? "", /^\d+\.\d{2}$/);
});

test("a price with no observation carries no price reasons", () => {
  const [card] = build([input({ observedPrice: null, observedAtIso: null })]);
  assert.equal(card.observedPrice, null);
  assert.equal(card.observedPriceLabel, null);
  assert.ok(!card.reasons.some((r) => r.code === "HIGHEST_OBSERVED_PRICE"));
});

test("a future timestamp is reported as unknown, not as 'just now'", () => {
  // Clock skew must not be laundered into a freshness claim.
  assert.equal(formatFreshness("2026-07-28T12:05:00.000Z", NOW), null);
});

test("freshness buckets read correctly", () => {
  assert.equal(formatFreshness("2026-07-28T11:59:30.000Z", NOW), "Updated less than a minute ago");
  assert.equal(formatFreshness("2026-07-28T11:59:00.000Z", NOW), "Updated 1 minute ago");
  assert.equal(formatFreshness("2026-07-28T11:45:00.000Z", NOW), "Updated 15 minutes ago");
  assert.equal(formatFreshness("2026-07-28T11:00:00.000Z", NOW), "Updated 1 hour ago");
  assert.equal(formatFreshness("2026-07-27T12:00:00.000Z", NOW), "Updated 1 day ago");
  assert.equal(formatFreshness(null, NOW), null);
  assert.equal(formatFreshness("not-a-date", NOW), null);
});

/* ================================================================== *
 * 5. Trust guards
 * ================================================================== */

test("the disclosed ranking basis satisfies the claim guard", () => {
  assert.deepEqual(findClaimViolations(OPERATOR_RANKING_BASIS), []);
  assert.equal(
    hasUnqualifiedRanking(OPERATOR_RANKING_BASIS),
    false,
    "the basis must qualify the ranking it describes",
  );
});

test("no reason label, limitation or heading trips the claim guard", () => {
  const cards = build([
    input(),
    input({ operator: operator({ slug: "x", verificationStatus: "unverified" }), availability: availability(false) }),
  ]);
  const corpus = [
    ...cards.flatMap((c) => [
      c.availabilityLabel,
      c.qualificationLabel,
      c.qualificationExplanation,
      c.freshnessLabel ?? "",
      ...c.reasons.map((r) => r.label),
    ]),
    ...OPERATOR_RANKING_LIMITATIONS,
    OPERATOR_RANKING_BASIS,
    "Operators for this market",
    "Why this operator?",
    "View odds",
    "Operator details",
  ].join("\n");

  assert.deepEqual(findClaimViolations(corpus), []);
  assert.equal(hasUnqualifiedRanking(corpus), false);
});

test("the card avoids the banned commercial vocabulary outright", () => {
  const cards = build([input()]);
  const text = JSON.stringify(cards).toLowerCase();
  for (const banned of [
    "best bookmaker",
    "limited time",
    "exclusive offer",
    "bet now",
    "guaranteed",
    "sure thing",
    "risk-free",
  ]) {
    assert.ok(!text.includes(banned), `card must not contain "${banned}"`);
  }
});

test("limitations are stated, and include the point-in-time caveat", () => {
  assert.ok(OPERATOR_RANKING_LIMITATIONS.length >= 3);
  assert.ok(
    OPERATOR_RANKING_LIMITATIONS.some((l) => /point-in-time/i.test(l)),
    "a price shown without its point-in-time caveat reads as a quote",
  );
});

/* ================================================================== *
 * 6. Edge cases
 * ================================================================== */

test("an empty input set yields an empty list, not a throw", () => {
  assert.deepEqual(build([]), []);
  assert.deepEqual(recommendableCards([]), []);
});

test("limit truncates after ranking, never before", () => {
  const cards = build(
    [
      input({ operator: operator({ slug: "weak", verificationStatus: "unverified" }), availability: availability(false) }),
      input({ operator: operator({ slug: "strong" }) }),
    ],
    1,
  );
  assert.equal(cards.length, 1);
  assert.equal(cards[0].slug, "strong", "truncation must not drop the winner");
});

test("limit 0 returns nothing rather than everything", () => {
  assert.deepEqual(build([input()], 0), []);
});

test("an operator with no markets is handled without throwing", () => {
  const [card] = build([input({ operator: operator({ supportedMarkets: [] }), marketKey: "over25" })]);
  assert.deepEqual(card.supportedMarkets, []);
  assert.ok(card.reasons.some((r) => r.code === "SUPPORTS_MARKET" && !r.satisfied));
});

test("no contextual market means no market reason is claimed", () => {
  const [card] = build([input({ marketKey: null })]);
  assert.ok(!card.reasons.some((r) => r.code === "SUPPORTS_MARKET"));
});

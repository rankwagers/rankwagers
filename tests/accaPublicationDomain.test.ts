import assert from "node:assert/strict";
import test from "node:test";
import {
  ACCA_ACTOR,
  ACCA_IMMUTABLE_FIELDS,
  ACCA_INITIAL_STATUS,
  ACCA_LIMITS,
  ACCA_MUTABLE_FIELDS,
  ACCA_SCHEMA_VERSION,
  ACCA_STATUSES,
  type AccaRecord,
  type AccaStatus,
} from "../lib/acca-publication/contracts";
import {
  allowedAccaTransitions,
  assertAccaTransition,
  canTransitionAcca,
  isAccaStatus,
  isPubliclyVisible,
  isTerminalAccaStatus,
  accaTransitionAudit,
} from "../lib/acca-publication/lifecycle";
import {
  MAX_COMBINED_ODDS,
  MIN_DECIMAL_ODDS,
  ODDS_DECIMAL_PLACES,
  calculateCombinedOdds,
  formatDecimalOdds,
  validateLegOdds,
} from "../lib/acca-publication/odds";
import {
  buildAccaSlug,
  isValidAccaSlug,
  slugifyText,
} from "../lib/acca-publication/slug";

/**
 * Sprint 20B-B stage B1 — Acca publication domain.
 *
 * Pure contracts only. No persistence, no creation-from-candidate, no publication: those are
 * stages B2 onwards and are deliberately not exercised here.
 */

function failure<T extends { ok: boolean }>(result: T): Extract<T, { ok: false }> {
  assert.equal(result.ok, false, `expected a failure, got ${JSON.stringify(result)}`);
  return result as Extract<T, { ok: false }>;
}

const ALL: AccaStatus[] = ["DRAFT", "PUBLISHED", "ARCHIVED"];

/* ------------------------------------------------------------------ *
 * Contracts
 * ------------------------------------------------------------------ */

test("acca vocabulary is a single uppercase set with DRAFT as the initial status", () => {
  assert.deepEqual([...ACCA_STATUSES], ALL);
  assert.equal(ACCA_INITIAL_STATUS, "DRAFT");
  assert.equal(ACCA_ACTOR, "admin");
  assert.equal(ACCA_SCHEMA_VERSION, "20b-b.1.0.0");
  for (const s of ALL) assert.ok(isAccaStatus(s));
  for (const bad of ["draft", "published", "", null, 3, undefined]) {
    assert.equal(isAccaStatus(bad), false);
  }
});

test("immutability boundary partitions every field exactly once", () => {
  const mutable = new Set<string>(ACCA_MUTABLE_FIELDS as readonly string[]);
  const immutable = new Set<string>(ACCA_IMMUTABLE_FIELDS as readonly string[]);

  // No field may be in both sets.
  for (const key of mutable) {
    assert.ok(!immutable.has(key), `${key} cannot be both mutable and immutable`);
  }

  // The union must cover a fully-populated record — proving the documented boundary is
  // complete rather than aspirational.
  const record: AccaRecord = {
    schemaVersion: ACCA_SCHEMA_VERSION,
    accaId: "acca_1",
    sourceCandidateId: "bpc_1",
    status: "DRAFT",
    title: "Test",
    summary: null,
    locale: "en",
    legs: [],
    combinedOdds: 1.32,
    evidenceSnapshot: {},
    qualificationSnapshot: { legCount: 2, oddsComplete: true },
    sourceReferences: {
      candidateId: "bpc_1",
      sourceRequestId: null,
      sourceSnapshotId: null,
      sourceDate: null,
      candidatePayloadChecksum: "a".repeat(64),
      candidateChecksumVersion: "20b-a.sha256.canon.1",
    },
    slug: "test",
    version: 1,
    createdAt: "2026-07-27T00:00:00.000Z",
    updatedAt: "2026-07-27T00:00:00.000Z",
    publishedAt: null,
    archivedAt: null,
    createdBy: "admin",
    publishedBy: null,
    archivedBy: null,
  };

  for (const key of Object.keys(record)) {
    assert.ok(
      mutable.has(key) || immutable.has(key),
      `${key} is not classified by the immutability boundary`,
    );
  }
  assert.equal(mutable.size + immutable.size, Object.keys(record).length);
});

test("acca limits are coherent with the candidate domain", () => {
  assert.equal(ACCA_LIMITS.minLegs, 2);
  assert.equal(ACCA_LIMITS.maxLegs, 8);
  assert.ok(ACCA_LIMITS.maxTitleLength > 0);
  assert.ok(ACCA_LIMITS.maxSlugLength > 0);
});

/* ------------------------------------------------------------------ *
 * Lifecycle
 * ------------------------------------------------------------------ */

test("only DRAFT to PUBLISHED and PUBLISHED to ARCHIVED are legal", () => {
  assert.deepEqual([...allowedAccaTransitions("DRAFT")], ["PUBLISHED"]);
  assert.deepEqual([...allowedAccaTransitions("PUBLISHED")], ["ARCHIVED"]);
  assert.deepEqual([...allowedAccaTransitions("ARCHIVED")], []);
  assert.ok(canTransitionAcca("DRAFT", "PUBLISHED"));
  assert.ok(canTransitionAcca("PUBLISHED", "ARCHIVED"));
});

test("every other acca transition pair is invalid, including same-state", () => {
  const legal = new Set(["DRAFT>PUBLISHED", "PUBLISHED>ARCHIVED"]);
  for (const from of ALL) {
    for (const to of ALL) {
      if (legal.has(`${from}>${to}`)) continue;
      assert.equal(canTransitionAcca(from, to), false, `${from}>${to} must be invalid`);
      const check = assertAccaTransition(from, to);
      assert.ok(!check.ok);
      assert.equal(failure(check).code, "invalid_transition");
    }
  }
});

test("acca same-state transitions are explicitly invalid", () => {
  for (const s of ALL) {
    const check = assertAccaTransition(s, s);
    assert.ok(!check.ok);
    assert.equal(failure(check).code, "invalid_transition");
  }
});

test("unknown acca statuses are rejected", () => {
  for (const bad of ["draft", "", null, 1, undefined, {}]) {
    assert.equal(failure(assertAccaTransition(bad, "PUBLISHED")).code, "unknown_status");
    assert.equal(failure(assertAccaTransition("DRAFT", bad)).code, "unknown_status");
  }
});

test("archived is terminal and never silently returns to published", () => {
  assert.ok(isTerminalAccaStatus("ARCHIVED"));
  assert.equal(isTerminalAccaStatus("DRAFT"), false);
  assert.equal(isTerminalAccaStatus("PUBLISHED"), false);
  assert.equal(canTransitionAcca("ARCHIVED", "PUBLISHED"), false);
  assert.equal(canTransitionAcca("ARCHIVED", "DRAFT"), false);
});

test("only PUBLISHED is publicly visible", () => {
  assert.equal(isPubliclyVisible("PUBLISHED"), true);
  assert.equal(isPubliclyVisible("DRAFT"), false);
  assert.equal(isPubliclyVisible("ARCHIVED"), false);
});

test("lifecycle audit rules bind timestamps to the right transition", () => {
  assert.deepEqual(accaTransitionAudit("PUBLISHED"), {
    setsPublishedAt: true,
    setsArchivedAt: false,
  });
  assert.deepEqual(accaTransitionAudit("ARCHIVED"), {
    setsPublishedAt: false,
    setsArchivedAt: true,
  });
});

/* ------------------------------------------------------------------ *
 * Strict odds calculator
 * ------------------------------------------------------------------ */

const legs = (...odds: unknown[]) => odds.map((capturedOdds) => ({ capturedOdds }));
function combined(...odds: unknown[]): number {
  const r = calculateCombinedOdds(legs(...odds));
  assert.ok(r.ok, `expected success, got ${JSON.stringify(r)}`);
  return r.combinedOdds;
}

test("odds constants match the documented contract", () => {
  assert.equal(ODDS_DECIMAL_PLACES, 4);
  assert.equal(MIN_DECIMAL_ODDS, 1.0001);
  assert.equal(MAX_COMBINED_ODDS, 1_000_000);
});

test("exact combined odds for the specified cases", () => {
  assert.equal(combined(1.1, 1.2), 1.32);
  assert.equal(combined(1.33, 1.27, 1.19), 2.01);
});

test("1.01 repeated across many legs is exact", () => {
  assert.equal(combined(1.01, 1.01), 1.0201);
  assert.equal(combined(1.01, 1.01, 1.01), 1.0303);
  // 1.01^8 = 1.0828567056280801 -> 1.0829 at four places, half-up.
  assert.equal(combined(1.01, 1.01, 1.01, 1.01, 1.01, 1.01, 1.01, 1.01), 1.0829);
});

test("floating-point-sensitive combinations are exact, not drifted", () => {
  // Plain float arithmetic gives 1.3310000000000004 and 1.3224999999999998.
  assert.notEqual(1.1 * 1.1 * 1.1, 1.331);
  assert.equal(combined(1.1, 1.1, 1.1), 1.331);

  assert.notEqual(1.15 * 1.15, 1.3225);
  assert.equal(combined(1.15, 1.15), 1.3225);

  assert.equal(combined(1.07, 1.07), 1.1449);
  assert.equal(combined(2.675, 1.2), 3.21);
});

test("large but valid combined values are accepted", () => {
  // 5^8 = 390625, inside the ceiling.
  assert.equal(combined(5, 5, 5, 5, 5, 5, 5, 5), 390625);
});

test("overflow beyond the documented ceiling is rejected", () => {
  const r = calculateCombinedOdds(legs(10, 10, 10, 10, 10, 10, 10));
  assert.ok(!r.ok);
  assert.equal(failure(r).code, "combined_odds_overflow");
});

test("result is deterministic across repeated calls", () => {
  for (let i = 0; i < 50; i++) {
    assert.equal(combined(1.33, 1.27, 1.19), 2.01);
  }
});

test("minimum leg count is enforced", () => {
  assert.equal(failure(calculateCombinedOdds(legs())).code, "too_few_legs");
  assert.equal(failure(calculateCombinedOdds(legs(1.5))).code, "too_few_legs");
  assert.ok(calculateCombinedOdds(legs(1.5, 1.5)).ok);
});

test("maximum leg count is enforced", () => {
  const nine = Array.from({ length: 9 }, () => 1.5);
  assert.equal(
    (calculateCombinedOdds(legs(...nine)) as { code: string }).code,
    "too_many_legs",
  );
});

test("invalid odds are rejected with the offending leg index, never skipped", () => {
  const cases: Array<[unknown, string]> = [
    [undefined, "odds_missing"],
    [null, "odds_missing"],
    ["1.50", "odds_not_a_number"],
    [true, "odds_not_a_number"],
    [Number.NaN, "odds_not_finite"],
    [Number.POSITIVE_INFINITY, "odds_not_finite"],
    [Number.NEGATIVE_INFINITY, "odds_not_finite"],
    [0, "odds_below_minimum"],
    [-2, "odds_below_minimum"],
    [1, "odds_below_minimum"],
    [1.23456, "odds_precision_exceeded"],
  ];
  for (const [value, code] of cases) {
    const r = calculateCombinedOdds(legs(1.5, value));
    assert.ok(!r.ok, `expected rejection for ${String(value)}`);
    assert.equal(failure(r).code, code, `code for ${String(value)}`);
    assert.equal(failure(r).legIndex, 1, "the offending leg index is reported");
  }
});

test("a single invalid leg fails the whole calculation, unlike the tolerant helper", () => {
  const r = calculateCombinedOdds(legs(1.5, null, 1.5));
  assert.ok(!r.ok, "no silent skipping");
});

test("validateLegOdds mirrors the calculator rules", () => {
  assert.ok(validateLegOdds(1.5).ok);
  assert.ok(validateLegOdds(MIN_DECIMAL_ODDS).ok);
  assert.equal(validateLegOdds(1).ok, false);
  assert.equal(validateLegOdds("1.5").ok, false);
});

test("display formatting is separate from the canonical stored value", () => {
  assert.equal(formatDecimalOdds(2.01), "2.01");
  assert.equal(formatDecimalOdds(1.0829), "1.08");
  assert.equal(formatDecimalOdds(1.0829, 4), "1.0829");
  assert.equal(formatDecimalOdds(Number.NaN), "—");
});

/* ------------------------------------------------------------------ *
 * Slug generation
 * ------------------------------------------------------------------ */

test("slugify handles Turkish characters correctly", () => {
  assert.equal(slugifyText("Şampiyonlar Ligi"), "sampiyonlar-ligi");
  assert.equal(slugifyText("Beşiktaş Galatasaray"), "besiktas-galatasaray");
  assert.equal(slugifyText("İstanbul Günü"), "istanbul-gunu");
  assert.equal(slugifyText("Çılgın Oran"), "cilgin-oran");
  // Dotless i must survive as "i", not vanish.
  assert.equal(slugifyText("ırmak"), "irmak");
});

test("slugify strips accents from other Latin scripts", () => {
  assert.equal(slugifyText("Café Crème"), "cafe-creme");
  assert.equal(slugifyText("Múnchen Über"), "munchen-uber");
  assert.equal(slugifyText("Ação Português"), "acao-portugues");
});

test("slugify normalizes punctuation, whitespace and hyphens", () => {
  assert.equal(slugifyText("Two   spaces"), "two-spaces");
  assert.equal(slugifyText("Hello, World! Again?"), "hello-world-again");
  assert.equal(slugifyText("already---hyphenated"), "already-hyphenated");
  assert.equal(slugifyText("  leading and trailing  "), "leading-and-trailing");
  assert.equal(slugifyText("--edge--"), "edge");
});

test("slugify drops emoji predictably", () => {
  assert.equal(slugifyText("Winner 🎉 Acca"), "winner-acca");
  assert.equal(slugifyText("🎉🎉🎉"), "");
});

test("slugify returns empty for empty or punctuation-only input", () => {
  assert.equal(slugifyText(""), "");
  assert.equal(slugifyText("   "), "");
  assert.equal(slugifyText("!!! ??? ---"), "");
  assert.equal(slugifyText(null), "");
  assert.equal(slugifyText(42), "");
});

test("slugify is bounded and never ends on a separator", () => {
  const long = "Manchester United versus Liverpool in a very long fixture title indeed";
  const slug = slugifyText(long, 30);
  assert.ok(slug.length <= 30);
  assert.ok(!slug.endsWith("-"));
  assert.ok(isValidAccaSlug(slug, 30));
});

test("slugify is stable across repeated calls", () => {
  const input = "Beşiktaş vs Café — 3 Leg Acca!";
  const first = slugifyText(input);
  for (let i = 0; i < 20; i++) assert.equal(slugifyText(input), first);
});

test("buildAccaSlug appends a collision discriminator without losing it to truncation", () => {
  const plain = buildAccaSlug({ title: "Three Leg Acca" });
  assert.ok(plain.ok);
  assert.equal(plain.slug, "three-leg-acca");
  assert.equal(plain.base, "three-leg-acca");

  const withSuffix = buildAccaSlug({ title: "Three Leg Acca", discriminator: "a1b2c3" });
  assert.ok(withSuffix.ok);
  assert.equal(withSuffix.slug, "three-leg-acca-a1b2c3");

  // A title that would otherwise fill the budget must not squeeze out the discriminator.
  const long = buildAccaSlug({
    title: "x".repeat(200),
    discriminator: "a1b2c3",
    maxLength: 20,
  });
  assert.ok(long.ok);
  assert.ok(long.slug.length <= 20);
  assert.ok(long.slug.endsWith("-a1b2c3"), `expected suffix preserved, got ${long.slug}`);
});

test("buildAccaSlug fails typed when nothing usable remains", () => {
  for (const title of ["", "   ", "!!!", "🎉", null, undefined]) {
    const r = buildAccaSlug({ title });
    assert.ok(!r.ok, `expected failure for ${String(title)}`);
    assert.equal(failure(r).code, "slug_empty");
  }
  // A discriminator alone is enough to produce a slug.
  const rescued = buildAccaSlug({ title: "🎉", discriminator: "a1b2c3" });
  assert.ok(rescued.ok);
  assert.equal(rescued.slug, "a1b2c3");
});

test("buildAccaSlug normalizes an unsafe discriminator", () => {
  const r = buildAccaSlug({ title: "Acca", discriminator: "../../etc/passwd" });
  assert.ok(r.ok);
  assert.ok(isValidAccaSlug(r.slug));
  assert.ok(!r.slug.includes("/"));
  assert.ok(!r.slug.includes("."));
});

test("buildAccaSlug is deterministic for the same inputs", () => {
  const input = { title: "İzmir Derbi ☕", discriminator: "zz9" };
  const first = buildAccaSlug(input);
  for (let i = 0; i < 20; i++) assert.deepEqual(buildAccaSlug(input), first);
});

test("locale-flavoured titles produce distinct, valid slugs", () => {
  const tr = buildAccaSlug({ title: "Günün Kuponu" });
  const en = buildAccaSlug({ title: "Acca of the Day" });
  assert.ok(tr.ok && en.ok);
  assert.equal(tr.slug, "gunun-kuponu");
  assert.equal(en.slug, "acca-of-the-day");
  assert.notEqual(tr.slug, en.slug);
});

test("isValidAccaSlug accepts generated slugs and rejects unsafe input", () => {
  assert.ok(isValidAccaSlug("three-leg-acca"));
  assert.ok(isValidAccaSlug("a1b2c3"));
  for (const bad of [
    "",
    "-leading",
    "trailing-",
    "double--hyphen",
    "Upper-Case",
    "has space",
    "slash/es",
    "dot.s",
    "x".repeat(ACCA_LIMITS.maxSlugLength + 1),
    null,
    42,
  ]) {
    assert.equal(isValidAccaSlug(bad), false, `expected ${String(bad)} rejected`);
  }
});

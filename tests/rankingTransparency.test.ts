import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { BRANDS } from "../lib/brands";
import {
  RANKING_CRITERIA,
  RANKING_LIMITATIONS,
  SCORE_DIMENSIONS,
  compositeScore,
  deriveOrderingBasis,
  hasCompleteScores,
  isOrderedByScore,
  listPosition,
  orderingDisclosure,
} from "../lib/trust/rankingCriteria";
import { findClaimViolations, hasUnqualifiedRanking } from "../lib/trust/claims";

/**
 * Sprint 28 — operator ordering transparency.
 *
 * Guards the fix for a structural claim defect: every operator list rendered `rank: i + 1`, an
 * array index presented to readers as if it were a measured ranking.
 */

const root = process.cwd();
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");
const codeOnly = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map((l) => l.replace(/\/\/.*$/, "")).join("\n");

/* ================================================================== *
 * 1. The defect cannot return
 * ================================================================== */

test("REGRESSION: list position is never computed inline as an array index", () => {
  const src = codeOnly(read("lib/operators/brandListItems.ts"));
  // The whole point: `i + 1` must not be re-inlined. It goes through the named helper, which is
  // where the "position, not verdict" meaning is documented and enforced.
  assert.equal(
    /\bi\s*\+\s*1\b/.test(src),
    false,
    "position must come from listPosition(i), not an inline index expression",
  );
  assert.match(src, /listPosition\(i\)/);
  assert.match(src, /deriveOrderingBasis\(/);
});

test("REGRESSION: the list row carries its ordering basis", () => {
  const types = read("lib/operators/brandListTypes.ts");
  assert.match(types, /orderingBasis: OrderingBasis/);
  // And `rank` is documented as a position rather than a verdict, so a future reader of the type
  // cannot mistake it.
  assert.match(types, /POSITION IN THE LIST/);
  assert.match(types, /not a verdict/i);
  assert.match(codeOnly(read("lib/operators/brandListItems.ts")), /orderingBasis,/);
});

test("position is exactly index + 1 — the value did not change, only its meaning", () => {
  assert.equal(listPosition(0), 1);
  assert.equal(listPosition(4), 5);
  assert.equal(listPosition(12), 13);
});

/* ================================================================== *
 * 2. The basis is honest about the real data
 * ================================================================== */

test("the live brand list is fully scored and genuinely ordered by those scores", () => {
  const brands = BRANDS as ReadonlyArray<{ scores?: Record<string, number> }>;
  const scored = brands.filter((b) => hasCompleteScores(b.scores));
  assert.equal(
    scored.length,
    BRANDS.length,
    `every brand must carry complete scores; ${scored.length}/${BRANDS.length} do`,
  );
  // The claim "ordered by our published criteria" is only honest if it is actually true. This
  // asserts the displayed order really does follow the composite score.
  assert.equal(isOrderedByScore(brands), true, "curated order must match composite score desc");
  assert.equal(deriveOrderingBasis(brands), "scored");
});

test("REGRESSION: reordering the live list without updating scores drops the claim", () => {
  // The self-correcting property, exercised on real data: swap the top two operators and the
  // product must stop claiming a scored ranking rather than keep asserting one.
  const brands = [...(BRANDS as ReadonlyArray<{ scores?: Record<string, number> }>)];
  const reordered = [brands[1], brands[0], ...brands.slice(2)];
  assert.equal(isOrderedByScore(reordered), false);
  assert.equal(
    deriveOrderingBasis(reordered),
    "editorial",
    "an order that no longer follows the scores must not be described as scored",
  );
  assert.match(orderingDisclosure(deriveOrderingBasis(reordered)), /not ranked by score/i);
});

test("composite score is an unweighted mean and refuses partial data", () => {
  assert.equal(compositeScore({ bonus: 10, odds: 10, payments: 10, app: 10, support: 10 }), 10);
  assert.equal(compositeScore({ bonus: 9, odds: 8, payments: 10, app: 8, support: 10 }), 9);
  assert.equal(compositeScore({ bonus: 9, odds: 8 }), null, "no partial averages");
  assert.equal(compositeScore(undefined), null);
});

test("a list is scored only when EVERY operator is scored", () => {
  const full = { scores: { bonus: 9, odds: 9, payments: 9, app: 9, support: 9 } };
  const partial = { scores: { bonus: 9, odds: 9 } };
  const none = {};

  assert.equal(deriveOrderingBasis([full, full]), "scored", "equal scores are in order");
  assert.equal(deriveOrderingBasis([full, partial]), "editorial", "mixed lists are not scored");
  assert.equal(deriveOrderingBasis([full, none]), "editorial");
  assert.equal(deriveOrderingBasis([]), "editorial", "an empty list claims nothing");
});

test("an incomplete score set is not treated as complete", () => {
  assert.equal(hasCompleteScores(undefined), false);
  assert.equal(hasCompleteScores({}), false);
  assert.equal(hasCompleteScores({ bonus: 9, odds: 9, payments: 9, app: 9 }), false);
  assert.equal(hasCompleteScores({ bonus: 9, odds: 9, payments: 9, app: 9, support: 9 }), true);
  // A dimension present but not a finite number must not count as evidence.
  assert.equal(
    hasCompleteScores({ bonus: 9, odds: 9, payments: 9, app: 9, support: Number.NaN }),
    false,
  );
});

/* ================================================================== *
 * 3. The disclosure never overclaims
 * ================================================================== */

test("the editorial disclosure refuses to call the order a ranking", () => {
  const text = orderingDisclosure("editorial");
  assert.match(text, /not ranked by score/i);
  assert.match(text, /does not indicate that one operator is better/i);
  assert.match(text, /decide for yourself/i);
  // It must survive the Sprint 27 site-wide rules.
  assert.deepEqual(findClaimViolations(text), []);
  assert.equal(hasUnqualifiedRanking(text), false);
});

test("the scored disclosure names its criteria rather than asserting a winner", () => {
  const text = orderingDisclosure("scored");
  assert.match(text, /published criteria/i);
  for (const word of ["bonus", "odds", "payment", "app", "support"]) {
    assert.match(text.toLowerCase(), new RegExp(word));
  }
  assert.deepEqual(findClaimViolations(text), []);
  assert.equal(hasUnqualifiedRanking(text), false, "naming criteria is what qualifies a ranking");
});

test("both disclosures pass the site-wide claim guard", () => {
  for (const basis of ["editorial", "scored"] as const) {
    assert.deepEqual(findClaimViolations(orderingDisclosure(basis)), []);
  }
});

/* ================================================================== *
 * 4. Published criteria and stated limits
 * ================================================================== */

test("the criteria cover every score dimension, with no orphans in either direction", () => {
  const declared = RANKING_CRITERIA.map((c) => c.dimension).sort();
  assert.deepEqual(declared, [...SCORE_DIMENSIONS].sort(), "criteria and data model must match");
  for (const c of RANKING_CRITERIA) {
    assert.ok(c.label.length > 0, `${c.dimension} needs a label`);
    assert.ok(c.describes.length > 20, `${c.dimension} needs a real description`);
  }
});

test("the limitations state what is NOT assessed, including the commercial relationship", () => {
  const all = RANKING_LIMITATIONS.join(" ");
  assert.match(all, /do not audit/i);
  assert.match(all, /solvency/i);
  assert.match(all, /vary by country/i);
  // Trust before monetisation: the commission relationship is disclosed in the same breath as
  // the criteria, not buried elsewhere.
  assert.match(all, /commission/i);
  assert.ok(RANKING_LIMITATIONS.length >= 4);
  assert.deepEqual(findClaimViolations(all), []);
});

test("criteria and limitations contain no banned claim", () => {
  const corpus = [
    ...RANKING_CRITERIA.map((c) => `${c.label} ${c.describes}`),
    ...RANKING_LIMITATIONS,
  ].join("\n");
  assert.deepEqual(findClaimViolations(corpus), []);
  assert.equal(hasUnqualifiedRanking(corpus), false);
});

/* ================================================================== *
 * 5. Module hygiene
 * ================================================================== */

test("the ranking module is pure and has no server or React dependency", () => {
  const src = codeOnly(read("lib/trust/rankingCriteria.ts"));
  for (const forbidden of [/server-only/, /\bfetch\(/, /node:/, /process\.env/, /from "react"/]) {
    assert.equal(forbidden.test(src), false, `rankingCriteria.ts must not contain ${forbidden}`);
  }
  assert.equal(/^import /m.test(src), false, "it must have no imports at all");
});

test("the ordering change is claim-only: no reordering was introduced", () => {
  const src = codeOnly(read("lib/operators/brandListItems.ts"));
  // A correctness fix must not silently redistribute affiliate placement. There is no sort,
  // reverse or comparator anywhere in the list builder.
  for (const forbidden of [/\.sort\(/, /\.reverse\(/, /localeCompare/]) {
    assert.equal(
      forbidden.test(src),
      false,
      `brand order must be untouched by this fix (${forbidden})`,
    );
  }
});

test("attribution still records list position", () => {
  // Analytics legitimately needs to know which card was clicked; only the reader-facing CLAIM
  // was wrong. Removing this would trade one defect for another.
  const src = codeOnly(read("lib/operators/brandListItems.ts"));
  assert.match(src, /operatorRank: listPosition\(i\)/);
  assert.match(src, /subidPrefix\}_\$\{listPosition\(i\)\}/);
});

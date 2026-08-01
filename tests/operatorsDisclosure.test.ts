import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { BRANDS } from "../lib/brands";
import { listOperators } from "../lib/operators/registry";
import { deriveOrderingBasis } from "../lib/trust/rankingCriteria";
import { extractUserFacingText, findClaimViolations, hasUnqualifiedRanking } from "../lib/trust/claims";

/**
 * Sprint 31 — operator index ordering disclosure.
 *
 * Closes the last surface in the Sprints 27–30 trust thread that presented an ordering without
 * saying anything about it.
 */

const root = process.cwd();
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");
const codeOnly = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map((l) => l.replace(/\/\/.*$/, "")).join("\n");

const OPERATORS_PAGE = "app/[locale]/operators/page.tsx";
const COMPARE_PAGE = "app/[locale]/compare/[slug]/page.tsx";

/* ================================================================== *
 * 1. The finding that justified this sprint
 * ================================================================== */

test("the operator index presents the SAME order as the commercial brand list", () => {
  // `listOperators()` is `BRANDS.map(brandToOperator)`. This is the fact that makes the missing
  // disclosure a defect rather than a cosmetic gap: the page was showing a score-derived order
  // while saying nothing about it.
  const operatorSlugs = listOperators().map((o) => o.slug);
  const brandSlugs = BRANDS.map((b) => b.slug);
  assert.deepEqual(
    operatorSlugs,
    brandSlugs,
    "if these ever diverge, the disclosure's basis must be re-derived from the right source",
  );
});

test("that shared order is genuinely score-derived", () => {
  assert.equal(
    deriveOrderingBasis(BRANDS as ReadonlyArray<{ scores?: Record<string, number> }>),
    "scored",
    "precondition: the claim the page now makes must be true",
  );
});

/* ================================================================== *
 * 2. The disclosure is rendered, and derived rather than hardcoded
 * ================================================================== */

test("REGRESSION: the operator index renders the ordering disclosure", () => {
  const src = codeOnly(read(OPERATORS_PAGE));
  assert.match(src, /<OrderingDisclosure/, "the disclosure must be rendered");
  assert.match(src, /from "@\/components\/trust\/OrderingDisclosure"/);
});

test("REGRESSION: the basis is derived, never hardcoded", () => {
  const src = codeOnly(read(OPERATORS_PAGE));
  assert.match(src, /deriveOrderingBasis\(BRANDS\)/, "must derive from the scored source");
  // Hardcoding would break the self-correcting property Sprint 28 established: reorder the
  // brands without updating scores and this page must stop claiming a ranking too.
  assert.equal(
    /basis=\{?["']scored["']\}?/.test(src),
    false,
    "the basis must not be asserted as a literal",
  );
  assert.equal(/basis=\{?["']editorial["']\}?/.test(src), false);
});

test("REGRESSION: the disclosure precedes the operator list", () => {
  const src = read(OPERATORS_PAGE);
  const disclosureAt = src.indexOf("<OrderingDisclosure");
  const listAt = src.indexOf("operators.map(");
  assert.ok(disclosureAt > 0 && listAt > 0);
  assert.ok(disclosureAt < listAt, "a reader must meet the disclosure before the first operator");
});

/* ================================================================== *
 * 3. The page still makes no claim it cannot support
 * ================================================================== */

test("the operator index contains no banned claim or unqualified ranking", () => {
  const copy = extractUserFacingText(read(OPERATORS_PAGE));
  assert.deepEqual(findClaimViolations(copy), []);
  assert.equal(hasUnqualifiedRanking(copy), false);
});

/* ================================================================== *
 * 4. Why /compare is deliberately NOT given an ordering disclosure
 * ================================================================== */

test("the compare page is a head-to-head and makes no ordering claim", () => {
  const src = read(COMPARE_PAGE);
  const copy = extractUserFacingText(src);

  /*
   * A two-way comparison has no ordering to disclose: presenting two operators side by side is
   * not a ranking, and bolting "not ranked by score" onto it would add noise without adding
   * honesty. What matters is that it does not sneak a superlative in instead — which is what
   * this asserts. Documented here so a future reader does not mistake the omission for an
   * oversight.
   */
  assert.equal(
    /<OrderingDisclosure/.test(src),
    false,
    "a head-to-head has no ordering claim to disclose",
  );
  assert.equal(hasUnqualifiedRanking(copy), false, "and must not assert a winner instead");
  assert.deepEqual(findClaimViolations(copy), []);
});

/* ================================================================== *
 * 5. Every comparison surface is now accounted for
 * ================================================================== */

/**
 * The complete set, each with its decided treatment. Adding a surface means choosing one of
 * these two answers deliberately, rather than inheriting silence by default.
 */
const SURFACE_TREATMENT: ReadonlyArray<{ rel: string; discloses: boolean; why: string }> = [
  { rel: "components/BrandListSection.tsx", discloses: true, why: "ranked commercial list" },
  { rel: "app/[locale]/operators/page.tsx", discloses: true, why: "same order as the brand list" },
  { rel: "app/[locale]/compare/[slug]/page.tsx", discloses: false, why: "head-to-head, no ordering" },
  { rel: "app/[locale]/reviews/[brand]/page.tsx", discloses: false, why: "single operator, no ordering" },
];

test("every comparison surface has a decided, enforced treatment", () => {
  for (const surface of SURFACE_TREATMENT) {
    const src = read(surface.rel);
    const renders = /<OrderingDisclosure/.test(src);
    assert.equal(
      renders,
      surface.discloses,
      `${surface.rel} (${surface.why}) — expected discloses=${surface.discloses}`,
    );
    // Whatever the treatment, none may carry a bad claim.
    const copy = extractUserFacingText(src);
    assert.deepEqual(findClaimViolations(copy), [], surface.rel);
    assert.equal(hasUnqualifiedRanking(copy), false, surface.rel);
  }
});

test("the pages that disclose do so from the shared component, not a copy", () => {
  for (const surface of SURFACE_TREATMENT.filter((s) => s.discloses)) {
    const src = codeOnly(read(surface.rel));
    assert.match(
      src,
      /components\/trust\/OrderingDisclosure|\.\/trust\/OrderingDisclosure/,
      `${surface.rel} must import the shared component`,
    );
    // A pasted disclosure would drift from the module the guards police.
    assert.equal(
      /not ranked by score/i.test(src),
      false,
      `${surface.rel} must not inline the disclosure copy`,
    );
  }
});

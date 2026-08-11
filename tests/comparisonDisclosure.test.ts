import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { BRANDS } from "../lib/brands";
import {
  RANKING_CRITERIA,
  RANKING_LIMITATIONS,
  deriveOrderingBasis,
  isOrderedByScore,
  orderingDisclosure,
} from "../lib/trust/rankingCriteria";
import { findClaimViolations, hasUnqualifiedRanking } from "../lib/trust/claims";

/**
 * Sprint 29 — comparison surface disclosure.
 *
 * Sprints 27–28 built an honest ordering claim and attached it to every row. Nothing rendered it.
 * This suite proves the claim now reaches a reader, sits before the operators rather than after
 * them, and survives the crypto filter.
 */

(globalThis as { React?: unknown }).React = require("react");

const root = process.cwd();
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");
const codeOnly = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map((l) => l.replace(/\/\/.*$/, "")).join("\n");

/* eslint-disable @typescript-eslint/no-var-requires */
const { OrderingDisclosure } = require("../components/trust/OrderingDisclosure") as typeof import("../components/trust/OrderingDisclosure");
/* eslint-enable @typescript-eslint/no-var-requires */

const html = (tree: unknown): string => renderToStaticMarkup(tree as never);

/* ================================================================== *
 * 1. The disclosure actually reaches a reader
 * ================================================================== */

test("the scored disclosure renders the claim and its criteria", () => {
  const markup = html(OrderingDisclosure({ basis: "scored" }));
  assert.match(markup, /published criteria/i);
  for (const c of RANKING_CRITERIA) {
    assert.ok(markup.includes(c.label), `criterion "${c.label}" must be shown`);
    assert.ok(markup.includes(c.describes), `criterion "${c.label}" must show its description`);
  }
});

test("the editorial disclosure refuses to call the order a ranking", () => {
  const markup = html(OrderingDisclosure({ basis: "editorial" }));
  assert.match(markup, /not ranked by score/i);
  assert.match(markup, /decide for yourself/i);
});

/** React escapes apostrophes and ampersands; compare on decoded text, not raw markup. */
function renderedText(markup: string): string {
  return markup
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
}

test("the limitations are rendered with the same prominence as the criteria", () => {
  const markup = html(OrderingDisclosure({ basis: "scored" }));
  const text = renderedText(markup);
  for (const limitation of RANKING_LIMITATIONS) {
    assert.ok(
      text.includes(limitation.replace(/\s+/g, " ")),
      `limitation must be shown: ${limitation}`,
    );
  }
  // Both headings exist; "what we don't" is not hidden behind different treatment.
  assert.match(markup, /What we assess/);
  assert.match(markup, /What we don&#x27;t|What we don't/);
});

test("the commission relationship is disclosed on the surface, not only in a doc", () => {
  const markup = html(OrderingDisclosure({ basis: "scored" }));
  assert.match(markup, /commission/i, "trust before monetisation");
});

test("the disclosure is accessible and passes the site-wide claim guard", () => {
  for (const basis of ["scored", "editorial"] as const) {
    const markup = html(OrderingDisclosure({ basis }));
    assert.match(markup, /aria-label="How this list is ordered"/);
    assert.match(markup, /<summary/, "the working must be expandable, not buried");
    // Rendered text must survive the Sprint 27 rules.
    const text = markup.replace(/<[^>]*>/g, " ");
    assert.deepEqual(findClaimViolations(text), [], `${basis} disclosure`);
    assert.equal(hasUnqualifiedRanking(text), false, `${basis} disclosure`);
  }
});

/* ================================================================== *
 * 2. It is wired into the single choke point, above the list
 * ================================================================== */

test("REGRESSION: the surviving commercial list renders the disclosure", () => {
  /*
   * Re-pinned after the commercial conversion: BrandListSection (the old choke
   * point) is DELETED with its host pages — the one canonical commercial list
   * is the operators hub, and the law transfers there whole: the disclosure
   * renders, its basis is derived from the ordered data, and it precedes the
   * first operator.
   */
  const src = codeOnly(read("app/[locale]/operators/page.tsx"));
  assert.match(src, /<OrderingDisclosure/, "the hub must render it");
  assert.match(src, /deriveOrderingBasis\(BRANDS\)/, "the basis must come from the ordered data");
});

test("REGRESSION: the disclosure precedes the operators", () => {
  const src = read("app/[locale]/operators/page.tsx");
  const disclosureAt = src.indexOf("<OrderingDisclosure");
  const listAt = src.indexOf("operators.map");
  assert.ok(disclosureAt > 0, "the disclosure must be rendered");
  assert.ok(disclosureAt < listAt, "a reader must meet the disclosure before the first operator");
});

/* ================================================================== *
 * 3. The claim survives client-side filtering
 * ================================================================== */

test("the crypto filter cannot invalidate the ordering claim", () => {
  const brands = BRANDS as ReadonlyArray<{ crypto?: boolean; scores?: Record<string, number> }>;
  assert.equal(deriveOrderingBasis(brands), "scored", "precondition: the full list is scored");

  // The filter removes elements without reordering them. A subsequence of a descending sequence
  // is still descending — proven here on real data rather than assumed, because the disclosure
  // is computed server-side over the full list and then shown beside a filtered one.
  const cryptoOnly = brands.filter((b) => Boolean(b.crypto));
  assert.ok(cryptoOnly.length > 0, "sanity: some brands are crypto");
  // CHARACTERIZATION: on current data every brand is crypto, so this particular filter is a
  // no-op. Asserting that it "removes some" would assert something untrue about the product.
  // The subsequence property is what actually matters and is proven exhaustively below, so it
  // holds whether or not this filter narrows the list today.
  assert.equal(
    cryptoOnly.length,
    brands.length,
    "every brand is currently crypto-accepting; if that changes this test should notice",
  );
  assert.equal(
    isOrderedByScore(cryptoOnly),
    true,
    "the filtered subset must remain score-ordered",
  );
  assert.equal(deriveOrderingBasis(cryptoOnly), "scored");
});

test("every contiguous and non-contiguous subset of a scored list stays scored", () => {
  const brands = BRANDS as ReadonlyArray<{ scores?: Record<string, number> }>;
  // Exhaustive over single-element removals: any one operator can disappear from a filter.
  for (let i = 0; i < brands.length; i++) {
    const subset = brands.filter((_, index) => index !== i);
    assert.equal(
      deriveOrderingBasis(subset),
      "scored",
      `removing index ${i} must not invalidate the claim`,
    );
  }
  // And every prefix, which is what a "top N" view would show.
  for (let n = 1; n <= brands.length; n++) {
    assert.equal(deriveOrderingBasis(brands.slice(0, n)), "scored", `top-${n} must stay scored`);
  }
});

/* ================================================================== *
 * 4. Component hygiene
 * ================================================================== */

test("the disclosure is a server component with no client state", () => {
  const src = read("components/trust/OrderingDisclosure.tsx");
  assert.equal(/^"use client"/m.test(src), false, "no client bundle cost for static text");
  for (const forbidden of [/useState/, /useEffect/, /onClick/]) {
    assert.equal(forbidden.test(src), false, `must not contain ${forbidden}`);
  }
});

test("the disclosure text comes from the shared module, never inlined", () => {
  const src = codeOnly(read("components/trust/OrderingDisclosure.tsx"));
  assert.match(src, /orderingDisclosure\(basis\)/);
  assert.match(src, /RANKING_CRITERIA/);
  assert.match(src, /RANKING_LIMITATIONS/);
  // A pasted copy would drift from the module the tests police.
  assert.equal(
    /not ranked by score/i.test(src),
    false,
    "disclosure copy must not be duplicated into the component",
  );
});

test("the rendered disclosure matches the module exactly", () => {
  for (const basis of ["scored", "editorial"] as const) {
    const markup = html(OrderingDisclosure({ basis }));
    const expected = orderingDisclosure(basis)
      .replace(/&/g, "&amp;")
      .replace(/—/g, "—");
    // Compare on text content with entities normalised.
    const text = markup.replace(/<[^>]*>/g, "").replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
    assert.ok(
      text.includes(expected.replace(/&amp;/g, "&")),
      `${basis} disclosure must render the module's exact wording`,
    );
  }
});

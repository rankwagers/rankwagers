import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { BRANDS } from "../lib/brands";
import {
  RANKING_CRITERIA,
  RANKING_LIMITATIONS,
  SCORE_DIMENSIONS,
  deriveOrderingBasis,
  orderingDisclosure,
} from "../lib/trust/rankingCriteria";
import { extractUserFacingText, findClaimViolations, hasUnqualifiedRanking } from "../lib/trust/claims";

/**
 * Sprint 33 — the ranking criteria page.
 *
 * The criteria previously existed only inside a collapsed `<details>` block on two surfaces. A
 * public commitment with no address cannot be linked, cited, or held against us. This proves the
 * page states the commitment fully, derives rather than asserts, and is genuinely reachable.
 */

(globalThis as { React?: unknown }).React = require("react");

const root = process.cwd();
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");
const codeOnly = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map((l) => l.replace(/\/\/.*$/, "")).join("\n");

/* eslint-disable @typescript-eslint/no-var-requires */
const HowWeRankPage = (require("../app/[locale]/how-we-rank/page") as {
  default: (p: { params: { locale: string } }) => unknown;
}).default;
const { OrderingDisclosure } = require("../components/trust/OrderingDisclosure") as typeof import("../components/trust/OrderingDisclosure");
/* eslint-enable @typescript-eslint/no-var-requires */

const html = (tree: unknown): string => renderToStaticMarkup(tree as never);
const text = (markup: string) =>
  markup.replace(/<[^>]*>/g, " ").replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ");

const PAGE = "app/[locale]/how-we-rank/page.tsx";

/* ================================================================== *
 * 1. The commitment is stated in full
 * ================================================================== */

test("the page states every criterion with its description", () => {
  const copy = text(html(HowWeRankPage({ params: { locale: "en" } })));
  for (const c of RANKING_CRITERIA) {
    assert.ok(copy.includes(c.label), `missing criterion label: ${c.label}`);
    assert.ok(copy.includes(c.describes), `missing description for: ${c.label}`);
  }
  assert.equal(RANKING_CRITERIA.length, SCORE_DIMENSIONS.length);
});

test("the page states every limitation, including the commercial relationship", () => {
  const copy = text(html(HowWeRankPage({ params: { locale: "en" } })));
  for (const limitation of RANKING_LIMITATIONS) {
    assert.ok(copy.includes(limitation.replace(/\s+/g, " ")), `missing limitation: ${limitation}`);
  }
  // Trust before monetisation: the commission relationship is stated in the opening paragraph,
  // not only inside the limitations list.
  assert.match(copy, /We earn commission from some of the operators/);
  assert.match(copy, /a reason to be more explicit/);
});

test("the page states what position does NOT mean", () => {
  const copy = text(html(HowWeRankPage({ params: { locale: "en" } })));
  assert.match(copy, /We do not sell placement/);
  assert.match(copy, /cannot pay to move up/);
  assert.match(copy, /not a judgement about which operator suits you/);
  assert.match(copy, /none of it predicts an outcome/);
});

test("the page explains why the composite is unweighted", () => {
  // The reasoning matters as much as the number: an unexplained weighting is where false
  // objectivity enters.
  const copy = text(html(HowWeRankPage({ params: { locale: "en" } })));
  assert.match(copy, /unweighted mean/);
  assert.match(copy, /false precision/);
  assert.match(copy, /not treated as ranked at all/);
});

/* ================================================================== *
 * 2. Derived, never asserted
 * ================================================================== */

test("REGRESSION: the page derives the ordering basis rather than hardcoding it", () => {
  const src = codeOnly(read(PAGE));
  assert.match(src, /deriveOrderingBasis\(BRANDS\)/);
  assert.equal(/orderingDisclosure\(\s*["']scored["']\s*\)/.test(src), false);
  assert.equal(/orderingDisclosure\(\s*["']editorial["']\s*\)/.test(src), false);

  // And it renders whatever the real data says today.
  const copy = text(html(HowWeRankPage({ params: { locale: "en" } })));
  const expected = orderingDisclosure(deriveOrderingBasis(BRANDS));
  assert.ok(
    copy.includes(expected.replace(/\s+/g, " ")),
    "the page must render the derived disclosure verbatim",
  );
});

test("the criteria are read from the module, not restated on the page", () => {
  const src = codeOnly(read(PAGE));
  assert.match(src, /RANKING_CRITERIA/);
  assert.match(src, /RANKING_LIMITATIONS/);
  // A restated copy would drift from the module every guard polices.
  for (const c of RANKING_CRITERIA) {
    assert.equal(
      src.includes(c.describes),
      false,
      `${c.dimension} description must not be inlined into the page`,
    );
  }
});

/* ================================================================== *
 * 3. It is reachable, not orphaned
 * ================================================================== */

test("REGRESSION: the disclosure links to the criteria page when given a locale", () => {
  const markup = html(OrderingDisclosure({ basis: "scored", locale: "en" }));
  assert.match(markup, /href="\/en\/how-we-rank"/);
  assert.match(markup, /How we rank operators/);
});

test("the disclosure still renders correctly without a locale", () => {
  // Optional prop: an existing call site that has not been updated must not break, and a
  // disclosure without a link is still a true disclosure.
  const markup = html(OrderingDisclosure({ basis: "scored" }));
  assert.equal(/how-we-rank/.test(markup), false);
  assert.match(markup, /published criteria/i);
});

test("REGRESSION: the disclosure call site supplies the locale", () => {
  // BrandListSection deleted with the commercial conversion — the surviving
  // disclosure call site is the operators hub, asserted below.
  assert.match(
    codeOnly(read("app/[locale]/operators/page.tsx")),
    /locale=\{params\.locale\}/,
    "the operator index must link the criteria page",
  );
});

/* ================================================================== *
 * 4. Page hygiene
 * ================================================================== */

test("the page carries correct metadata and locale params", () => {
  const src = read(PAGE);
  assert.match(src, /export function generateStaticParams/);
  assert.match(src, /pageMetadata\(/);
  assert.match(src, /path: "\/how-we-rank"/);
  // Not marked noindex: unlike an empty listing, this page has substance on day one.
  assert.equal(/index: false/.test(codeOnly(src)), false);
});

test("the page makes no claim it cannot support", () => {
  const copy = extractUserFacingText(read(PAGE));
  assert.deepEqual(findClaimViolations(copy), []);
  assert.equal(
    hasUnqualifiedRanking(copy),
    false,
    "a page about ranking criteria must not itself assert an unqualified ranking",
  );
});

test("CHARACTERIZATION: the page is deliberately absent from the sitemap", () => {
  /*
   * Reachable through internal links from every comparison surface, so crawlers find it. It is
   * NOT in STATIC_PATHS because that emits one URL per locale, and the copy is English-only —
   * 30 near-identical URLs is the programmatic expansion the manifesto deprioritises. This
   * asserts the current, deliberate state; when the copy is localised, this test changes with it.
   */
  assert.equal(
    /how-we-rank/.test(read("app/sitemap.ts")),
    false,
    "not advertised until the copy is localised",
  );
  // But it must genuinely be linked, or it would simply be orphaned.
  assert.match(read("components/trust/OrderingDisclosure.tsx"), /how-we-rank/);
});

test("it is a distinct subject from /methodology, not a duplicate", () => {
  // /methodology explains how PREDICTIONS work; this explains how OPERATORS are ordered.
  // Merging them would put commercial criteria inside a prediction-credibility page.
  const methodology = extractUserFacingText(read("app/[locale]/methodology/page.tsx"));
  assert.equal(
    /bonus terms|payment options|commission/i.test(methodology),
    false,
    "methodology must not have acquired operator ranking content",
  );
  const criteria = text(html(HowWeRankPage({ params: { locale: "en" } })));
  /*
   * Phrases specific to prediction methodology. Deliberately NOT a bare /settle/ — the payments
   * criterion legitimately says "typical settlement time" about withdrawals, and banning the
   * word would force worse copy to satisfy a test.
   */
  for (const drift of [
    /model probability/i,
    /settles? outcomes?/i,
    /qualified list/i,
    /daily archive/i,
  ]) {
    assert.equal(
      drift.test(criteria),
      false,
      `the criteria page must not drift into prediction methodology (${drift})`,
    );
  }
  // The legitimate payments usage is still present, proving the check is narrow and not evaded.
  assert.match(criteria, /settlement time/);
});

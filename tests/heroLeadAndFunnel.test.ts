import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { funnelDescent, splitRate } from "../components/homepage/hero/heroModel";
import type { HeroFunnel } from "../lib/homepage/types";

/**
 * Rebrand v2 — the lead and the funnel line.
 *
 * Source-level assertions where the behaviour is compositional (both are client components and
 * this harness has no React runtime), and direct assertions on the logic they consume.
 */

const root = process.cwd();
/** Comments stripped: an explanatory comment is not rendered output. */
const src = (rel: string) =>
  readFileSync(path.join(root, rel), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const LEAD = "components/homepage/hero/HeroLead.tsx";
const FUNNEL = "components/homepage/hero/FunnelLine.tsx";

/* -- the numeral is never separated from its market -------------------------- */

test("the numeral and its market render as one block", () => {
  const s = src(LEAD).replace(/\s+/g, " ");
  const numeral = s.indexOf("rw-lead-numeral");
  const market = s.indexOf("{pick.market}");
  assert.ok(numeral > 0 && market > numeral, "the market is set beneath the numeral");
  // Nothing may render between them but the numeral's own closing markup.
  const between = s.slice(numeral, market);
  assert.equal(
    /venue|rates\?\./i.test(between),
    false,
    "nothing separates the numeral from its market"
  );
});

test("the provider figure carries its qualifier, since it carries no sample", () => {
  const s = src(LEAD);
  assert.match(s, /probabilityNote/, "the approved qualifier travels with the figure");
  // And it is never called a confidence or a model probability.
  assert.equal(/Confidence|Model probability/i.test(s), false);
});

test("the numeral does not ramp", () => {
  const s = src(LEAD);
  // A count-up would render values the pipeline never observed (rule 5 is not a licence for it).
  assert.equal(/useResolve|countUp|ramp\(/.test(s), false);
  assert.match(s, /\{pick\.probability\}/, "it prints its true value directly");
});

/* -- venue lines: proportional from zero, sample never detached -------------- */

test("venue lines draw from zero by transform, not by animating width", () => {
  const s = src(LEAD).replace(/\s+/g, " ");
  assert.match(s, /transform: drawn \? "scaleX\(1\)" : "scaleX\(0\)"/);
  assert.match(s, /transition: `transform \$\{LINE_MS\}ms cubic-bezier\(\.16,1,\.3,1\)`/);
  // An animated width would move layout on every frame.
  assert.equal(
    /transition:[^;]*\bwidth\b/.test(s),
    false,
    "width must not be transitioned — that is CLS"
  );
});

test("the line timing and stagger match the doc", () => {
  const s = src(LEAD);
  assert.match(s, /LINE_MS = 1100/);
  assert.match(s, /STAGGER_MS = 140/);
});

test("every venue rate renders with its sample beside it", () => {
  const s = src(LEAD).replace(/\s+/g, " ");
  assert.match(s, /splitRate\(rate\.display\)/, "the model's string is split, never rebuilt");
  assert.match(s, /\{sample\}/, "the sample renders");
  // The rate and its sample sit in one element, so neither can appear without the other.
  const rateAt = s.indexOf("{value}</span>");
  const sampleAt = s.indexOf("{sample}");
  assert.ok(rateAt > 0 && sampleAt > rateAt);
});

test("splitRate keeps a sampleless string whole", () => {
  assert.deepEqual(splitRate("82% (9/11)"), { rate: "82%", sample: "(9/11)" });
  assert.deepEqual(splitRate("82%"), { rate: "82%", sample: null });
});

/* -- the empty state is a design citizen ------------------------------------- */

test("with no venue samples the lines block is omitted entirely", () => {
  const s = src(LEAD).replace(/\s+/g, " ");
  assert.match(s, /const hasLines = lines\.length > 0/);
  assert.match(s, /\{hasLines \? \(/, "the block is conditional, not emptied");
  assert.match(s, /\) : null\}/);
  // No skeleton, no placeholder row.
  assert.equal(/skeleton|placeholder|animate-pulse/i.test(s), false);
});

test("the numeral and market still render when the lines are absent", () => {
  const s = src(LEAD).replace(/\s+/g, " ");
  // They sit OUTSIDE the hasLines conditional.
  const gate = s.indexOf("{hasLines ? (");
  assert.ok(s.indexOf("rw-lead-numeral") < gate, "the numeral is unconditional");
  assert.ok(s.indexOf("{pick.market}") < gate, "the market is unconditional");
});

/* -- the whole lead is a link, and hover behaves per the doc ------------------ */

test("the lead is a link and its hover states match the doc", () => {
  const s = src(LEAD).replace(/\s+/g, " ");
  assert.match(s, /SectionTrackLink/);
  assert.match(s, /group-hover:scale-x-\[2\.4\]/, "the rule extends");
  assert.match(s, /group-hover:ml-1/, "the crests part");
  // Crests are real, 36px, bare.
  assert.match(s, /size=\{36\}/);
  assert.equal(/rounded/.test(s), false, "radius is 0 in this scope");
});

test("only the one easing family appears", () => {
  const s = src(LEAD) + src(FUNNEL);
  const eases = [...s.matchAll(/cubic-bezier\(([^)]*)\)/g)].map((m) => m[1].replace(/\s/g, ""));
  for (const e of eases) {
    assert.equal(e, ".16,1,.3,1", `foreign easing ${e} — the doc permits one curve`);
  }
});

/* -- the funnel consumes the existing descent verbatim ----------------------- */

test("the funnel does not recompute the levels", () => {
  const s = src(FUNNEL);
  assert.match(s, /funnelDescent\(funnel\)/);
  // No second implementation of which stages render or what they are worth.
  assert.equal(/FUNNEL_STEPS|offset \+|\.filter\(/.test(s), false);
});

test("a null stage stays omitted, and values are unchanged", () => {
  const funnel = {
    analysed: 120,
    validated: 96,
    inScope: null,
    qualified: 26,
    featured: 4,
  } as unknown as HeroFunnel;
  const descent = funnelDescent(funnel);
  assert.equal(
    descent.some((d) => d.stage === "inScope"),
    false,
    "a null stage is omitted, never drawn as zero"
  );
  assert.deepEqual(
    descent.map((d) => d.value),
    [120, 96, 26, 4]
  );
});

test("the cleared stage carries the accent tick and a defined footnote", () => {
  const s = src(FUNNEL).replace(/\s+/g, " ");
  assert.match(s, /step\.stage === "qualified"/);
  assert.match(s, /text-\[var\(--hero-accent\)\]/, "the tick carries the accent");
  assert.match(s, /FUNNEL_FOOTNOTE_ID/, "the tick references a footnote");
  assert.match(s, /export function FunnelFootnote/, "and the footnote is defined");
});

test("the funnel sits on one hairline", () => {
  const s = src(FUNNEL).replace(/\s+/g, " ");
  assert.match(s, /h-px w-full bg-\[var\(--hero-ink\)\]/);
});

test("nothing user-facing calls a threshold pass a qualification", () => {
  const s = src(FUNNEL);
  // The internal key is an identifier; no rendered string may read as a qualification.
  assert.equal(/>Qualified</.test(s), false);
});

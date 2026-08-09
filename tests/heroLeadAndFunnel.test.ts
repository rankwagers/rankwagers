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

test("venue tracks draw from zero by transform, not by animating their box", () => {
  const s = src(LEAD).replace(/\s+/g, " ");
  /*
   * VERTICAL now: the tracks stand on one baseline so three lengths can be compared at a glance.
   * The mechanism is unchanged and so is the reason for it — `scaleY` on a fixed-height rail with
   * a bottom origin. The rail holds its full box from the first frame; only the transform moves.
   */
  assert.match(s, /transform: drawn \? "scaleY\(1\)" : "scaleY\(0\)"/);
  assert.match(s, /origin-bottom/, "the bar grows from the baseline, not from its middle");
  assert.match(s, /transition: `transform \$\{LINE_MS\}ms cubic-bezier\(\.16,1,\.3,1\)`/);
  assert.match(s, /TRACK_PX = 110/, "the rail is a fixed height, so nothing reflows as bars draw");
  // Animating either box axis would move layout on every frame.
  assert.equal(
    /transition:[^;]*\b(width|height)\b/.test(s),
    false,
    "neither width nor height may be transitioned — that is CLS"
  );
});

test("the line timing and stagger match the doc", () => {
  const s = src(LEAD);
  assert.match(s, /LINE_MS = 1100/);
  assert.match(s, /STAGGER_MS = 140/);
});

test("every venue rate renders with its sample beside it", () => {
  const s = src(LEAD).replace(/\s+/g, " ");
  assert.match(s, /splitRate\(track\.display\)/, "the model's string is split, never rebuilt");
  assert.match(s, /display: rate\.display/, "a venue track carries the published string verbatim");
  assert.match(s, /\{sample\}/, "the sample renders");
  // The rate and its sample sit in one element, so neither can appear without the other.
  const rateAt = s.indexOf("{rate}</span>");
  const sampleAt = s.indexOf("{sample}");
  assert.ok(rateAt > 0 && sampleAt > rateAt);
});

test("the middle track is the potential, and it is the one figure with no sample", () => {
  const s = src(LEAD).replace(/\s+/g, " ");
  /*
   * The map's three tracks are home · potential · away. The potential is the figure the numeral
   * states, set between the two observations it is read against.
   *
   * Its display string is BUILT, and that is not a rebuilt rate: unlike a venue record it has no
   * published string to split and no sample to detach. The distinction is the whole reason the
   * qualifier under the numeral exists, so it is pinned here rather than left to reading.
   */
  assert.match(s, /display: `\$\{pick\.probability\}%`/, "the potential prints the numeral's figure");
  assert.match(s, /wide: true/, "and is drawn wider, being a different kind of figure");
  /*
   * Asserted on the RENDER order, not on the order the sources happen to appear in: the venue
   * pair is resolved first and the potential is placed between them. That splice IS the geometry —
   * `venueTracks[0]`, the potential, then the rest — so it is what gets pinned.
   */
  assert.match(s, /venue\(copy\.venueHome/, "the home record is a track");
  assert.match(s, /venue\(copy\.venueAway/, "the away record is a track");
  assert.match(
    s,
    /venueTracks\[0\], \{ key: "potential"[\s\S]*?\}, \.\.\.venueTracks\.slice\(1\),/,
    "the potential is placed between the two venue records"
  );
});

test("splitRate keeps a sampleless string whole", () => {
  assert.deepEqual(splitRate("82% (9/11)"), { rate: "82%", sample: "(9/11)" });
  assert.deepEqual(splitRate("82%"), { rate: "82%", sample: null });
});

/* -- the empty state is a design citizen ------------------------------------- */

test("with no venue samples the lines block is omitted entirely", () => {
  const s = src(LEAD).replace(/\s+/g, " ");
  /*
   * The potential track goes with them, even though its figure is always available: alone it
   * would be a single bar depicting the number already set at 148px directly above it. The block
   * exists to put the claim beside its observations, and with none there is nothing to compare.
   */
  assert.match(s, /const hasLines = venueTracks\.length > 0/);
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
  assert.match(s, /scale-x-0 bg-\[var\(--hero-ink\)\][^"]*group-hover:scale-x-100/, "the rule draws in");
  assert.match(s, /group-hover:ml-3/, "the crests part");
  // The map's close: a bordered mono button, bottom right, inside the same link.
  assert.match(s, /\{copy\.openResearchCta\}/, "the lead carries its call to action");
  assert.match(s, /border border-\[var\(--hero-ink\)\]/, "bordered, not filled");
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
  assert.match(s, /--hero-accent/, "the cleared stage carries the page's accent");
  assert.match(s, /FUNNEL_FOOTNOTE_ID/, "the tick references a footnote");
  assert.match(s, /export function FunnelFootnote/, "and the footnote is defined");
});

test("the funnel is a descent: stages sit at their own levels", () => {
  const s = src(FUNNEL).replace(/\s+/g, " ");
  /*
   * Not one shared hairline any more. Equal counts share the top rule and a stage that actually
   * rejected something drops with its rule — the shape IS the claim. The level comes from the
   * offset `funnelDescent` already emits; the only arithmetic here adds the shared top inset.
   */
  assert.match(s, /top: TOP_PX \+ step\.offset/, "each stage sits at its own emitted level");
  assert.match(s, /h-\[2px\] w-full/, "and carries its own 2px rule");
  /*
   * The fixed box moved onto a CSS variable so it can be responsive (doc §Below sm): from `sm`
   * up the box is still sized once from the deepest emitted level — zero CLS — and below `sm`
   * the stages are static flow, which cannot shift layout either.
   */
  assert.match(
    s,
    /"--rw-funnel-h": `\$\{TOP_PX \+ deepest \+ LABEL_PX\}px`/,
    "the box is fixed from the deepest level — zero CLS"
  );
  assert.match(s, /sm:h-\[var\(--rw-funnel-h\)\]/, "and the sm geometry consumes exactly that height");
});

test("the descent reads value then label", () => {
  const s = src(FUNNEL).replace(/\s+/g, " ");
  const value = s.indexOf("{step.value}");
  const label = s.indexOf("copy[step.label]");
  assert.ok(value > 0 && label > value, "the count is the observation; the word is its caption");
});

test("the accent is spent on the cleared stage's rule, not on its marker", () => {
  const s = src(FUNNEL).replace(/\s+/g, " ");
  // The overline is the accent; the dagger in the label is plain ink, part of the stage's name.
  assert.match(s, /cleared \? "bg-\[var\(--hero-accent\)\]" : "bg-\[var\(--hero-ink\)\]"/);
});

test("nothing user-facing calls a threshold pass a qualification", () => {
  const s = src(FUNNEL);
  // The internal key is an identifier; no rendered string may read as a qualification.
  assert.equal(/>Qualified</.test(s), false);
});

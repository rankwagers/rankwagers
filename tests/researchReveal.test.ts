import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  researchRevealDecision,
  researchRunDay,
} from "../components/homepage/hero/HeroStage";

const root = process.cwd();
const stage = readFileSync(
  path.join(root, "components/homepage/hero/HeroStage.tsx"),
  "utf8"
);
const css = readFileSync(path.join(root, "app/globals.css"), "utf8");

/**
 * Sprint 3 — the Research Reveal (rwdesign §20).
 *
 * The decision this suite protects is that the sequence DISCLOSES rather than COUNTS. A numeral
 * travelling 0 → 241 paints intermediate figures the pipeline never observed — partitionDailyMatches
 * partitions in one pass and never holds a running total — so §3.2 forbids them in motion exactly
 * as it forbids them in a static value.
 */

/* ------------------------------------------------------------------ *
 * No intermediate value is ever rendered
 * ------------------------------------------------------------------ */

test("the funnel never ramps a numeral: no count-up primitive is used", () => {
  /*
   * `useResolve` is the 0 -> target ramp in ./motion. It exists and the funnel must not reach it.
   * Checked as an IMPORT and as a CALL rather than as any mention, so the module docblock can name
   * the ramp it refuses to use without tripping its own guard.
   */
  const importLine = stage.match(/import \{[^}]*\} from "\.\/motion";/)?.[0] ?? "";
  assert.doesNotMatch(importLine, /useResolve/, "the ramp must not be imported");
  assert.doesNotMatch(stage, /useResolve\s*\(/, "the ramp must not be called");
  assert.doesNotMatch(stage, /\bramp\s*\(/, "no interpolation helper in the hero stage");
});

test("the measure prints the observed value directly, with nothing between", () => {
  // The numeral is rendered from the prop. Any interpolation would have to appear here.
  assert.match(
    stage,
    /text-\[32px\] leading-none text-\[var\(--hero-ink\)\]">\{value\}<\/p>/,
    "the numeral must render `value` itself"
  );
  // No state, no effect and no timer stands between the observation and the paint.
  const measure = stage.slice(stage.indexOf("function Measure("), stage.indexOf("function PickRow("));
  for (const forbidden of ["useState", "useEffect", "setInterval", "setTimeout", "requestAnimationFrame"]) {
    assert.doesNotMatch(
      measure,
      new RegExp(forbidden),
      `Measure must not run ${forbidden} — a numeral is disclosed, not animated`
    );
  }
});

test("the sequence animates only opacity, transform and blur — never a value or a box", () => {
  const descentCss = css.slice(css.indexOf(".rw-hero .rw-descent .rw-reveal"), css.indexOf("/* --- state response"));
  for (const boxProperty of ["height", "width", "margin", "padding", "font-size"]) {
    assert.doesNotMatch(
      descentCss,
      new RegExp(`transition[^;]*${boxProperty}`),
      `${boxProperty} must not be animated — it would move the block`
    );
  }
});

/* ------------------------------------------------------------------ *
 * Skipped on an incomplete chain
 * ------------------------------------------------------------------ */

const FULL = { stageCount: 5, totalStages: 5, reducedMotion: false, seenToday: false, day: "2026-08-03" };

test("a complete chain, unseen today, plays", () => {
  const decision = researchRevealDecision(FULL);
  assert.equal(decision.plays, true);
  assert.equal(decision.reason, "plays");
});

test("an incomplete chain does not run at all", () => {
  // An archive day omits analysed, validated and inScope. Two steps is not a descent.
  for (const stageCount of [0, 1, 2, 3, 4]) {
    const decision = researchRevealDecision({ ...FULL, stageCount });
    assert.equal(decision.plays, false, `${stageCount} stages must not animate`);
    assert.equal(decision.reason, "incomplete_chain");
  }
});

test("the incomplete chain is refused before every other consideration", () => {
  // Even unseen, with motion allowed and a valid day, a partial descent stays still.
  const decision = researchRevealDecision({
    stageCount: 2,
    totalStages: 5,
    reducedMotion: false,
    seenToday: false,
    day: "2026-08-03",
  });
  assert.equal(decision.reason, "incomplete_chain");
});

/* ------------------------------------------------------------------ *
 * Reduced motion lands on the final state
 * ------------------------------------------------------------------ */

test("reduced motion never plays the sequence", () => {
  const decision = researchRevealDecision({ ...FULL, reducedMotion: true });
  assert.equal(decision.plays, false);
  assert.equal(decision.reason, "reduced_motion");
});

test("reduced motion draws the connector rather than merely freezing it", () => {
  const reduceBlock = css.slice(css.lastIndexOf("@media (prefers-reduced-motion: reduce)"));
  assert.match(reduceBlock, /\.rw-hero \.rw-descent-line/);
  assert.match(reduceBlock, /stroke-dashoffset:\s*0/);
  // A frozen dash would leave the line permanently half-drawn.
  assert.match(reduceBlock, /stroke-dasharray:\s*none/);
});

test("the settled render carries no reveal class at all", () => {
  // Not merely `is-in`: a settled measure has no transition attached, so it cannot flicker.
  assert.match(stage, /revealIndex === null \? "" : ` rw-reveal/);
  assert.match(stage, /revealPhase === "settled" \? \{\} : \{ "data-reveal": revealPhase \}/);
});

/* ------------------------------------------------------------------ *
 * Once per day, keyed to the run
 * ------------------------------------------------------------------ */

test("a run already seen today does not replay", () => {
  const decision = researchRevealDecision({ ...FULL, seenToday: true });
  assert.equal(decision.plays, false);
  assert.equal(decision.reason, "seen_today");
});

test("without a usable run stamp the sequence cannot be bounded, so it does not run", () => {
  const decision = researchRevealDecision({ ...FULL, day: null });
  assert.equal(decision.plays, false);
  assert.equal(decision.reason, "no_run_day");
});

test("the key is the run's own day, not the reader's session", () => {
  assert.equal(researchRunDay("2026-08-03T09:15:00.000Z"), "2026-08-03");
  // Late-evening UTC stays on its own day rather than rolling with a local clock.
  assert.equal(researchRunDay("2026-08-03T23:59:59.000Z"), "2026-08-03");
  assert.equal(researchRunDay(null), null);
  assert.equal(researchRunDay("not-a-date"), null);
});

/* ------------------------------------------------------------------ *
 * The block height is identical before and after
 * ------------------------------------------------------------------ */

test("the armed and settled states differ only in painted properties", () => {
  const reveal = css.slice(css.indexOf(".rw-hero .rw-reveal {"), css.indexOf(".rw-hero .rw-reveal.is-in"));
  // The pre-state is opacity, transform and blur. None of the three affects layout.
  assert.match(reveal, /opacity:\s*0/);
  assert.match(reveal, /transform:\s*translate3d\(0, var\(--travel\), 0\)/);
  assert.match(reveal, /filter:\s*blur\(var\(--focus\)\)/);
  for (const boxProperty of ["display:", "height:", "width:", "margin:", "padding:", "position:"]) {
    assert.doesNotMatch(
      reveal,
      new RegExp(boxProperty.replace(":", ":\\s")),
      `${boxProperty} in the pre-state would resize the block`
    );
  }
});

test("the measure reserves its final box in every phase", () => {
  const measure = stage.slice(stage.indexOf("function Measure("), stage.indexOf("function PickRow("));
  // The offset and padding that set the box are applied unconditionally; only the reveal class
  // is conditional, and that class paints without moving anything.
  assert.match(measure, /pl-\[var\(--rw-descent\)\] pt-4 sm:pl-0 sm:mt-\[var\(--rw-descent\)\]/);
  assert.match(measure, /"--rw-descent": `\$\{offset\}px`/);
});

test("the connector is drawn behind the measures and never displaces them", () => {
  assert.match(stage, /pointer-events-none absolute inset-x-0 top-0/);
});

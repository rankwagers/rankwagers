import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");

const stage = read("components/homepage/hero/HeroStage.tsx");
const lead = read("components/homepage/hero/HeroLead.tsx");
const funnel = read("components/homepage/hero/FunnelLine.tsx");
const css = read("app/globals.css");

/**
 * Sprint 3 — the Research Reveal (rwdesign §20), AFTER rebrand v2.
 *
 * This suite used to protect the stepped descent's disclosure sequence: a decision function
 * (`researchRevealDecision`), a `data-reveal` phase machine, and a connector that drew itself
 * across the stages. `FunnelLine` replaced that composition wholesale, so the sequence, its
 * storage key and its stylesheet rules are gone, and the tests that asserted their SHAPE went with
 * them — an assertion about deleted code is not coverage, it is a tripwire on an empty room.
 *
 * What survives is the PRINCIPLE those tests existed to serve, which outlives any one composition:
 *
 *   §3.2  a numeral is DISCLOSED, never COUNTED. A figure travelling 0 → 241 paints values the
 *         pipeline never observed — `partitionDailyMatches` partitions in one pass and never holds
 *         a running total — so motion is bound by §3.2 exactly as a static value is.
 *
 * That principle now has NEW subjects: `HeroLead`'s numeral and `FunnelLine`'s stage values. So it
 * is asserted against them here, not only against the stage that no longer draws either.
 */

/* ------------------------------------------------------------------ *
 * No intermediate value is ever rendered — across the whole surface
 * ------------------------------------------------------------------ */

const SURFACE = [
  ["HeroStage", stage],
  ["HeroLead", lead],
  ["FunnelLine", funnel],
] as const;

test("no hero component reaches for a count-up primitive", () => {
  /*
   * `useResolve` is the 0 → target ramp in ./motion. It exists, and nothing on this surface may
   * reach it. Checked as an IMPORT and as a CALL rather than as any mention, so a module docblock
   * can name the ramp it refuses to use without tripping its own guard.
   */
  for (const [name, src] of SURFACE) {
    const importLine = src.match(/import \{[^}]*\} from "\.\/motion";/)?.[0] ?? "";
    assert.doesNotMatch(importLine, /useResolve/, `${name} must not import the ramp`);
    assert.doesNotMatch(src, /useResolve\s*\(/, `${name} must not call the ramp`);
    assert.doesNotMatch(src, /\bramp\s*\(/, `${name} must not interpolate a figure`);
    assert.doesNotMatch(src, /countUp/i, `${name} must not count a numeral up`);
  }
});

test("every hero numeral is printed from its observed value, with nothing between", () => {
  // The funnel's stage count: rendered from the step, not from a piece of animated state.
  assert.match(
    funnel,
    /<dd className="[^"]*">\{step\.value\}<\/dd>/,
    "the funnel stage must print `step.value` itself"
  );
  // The lead's numeral: rendered from the pick.
  assert.match(lead, /\{pick\.probability\}/, "the lead numeral must print `pick.probability` itself");
  /*
   * `FunnelLine` holds no state at all, so nothing can stand between the observation and the
   * paint. `HeroLead` DOES hold state — but only to release a CSS transform on the venue rules,
   * never to hold a figure. That distinction is what the assertions below pin: its state is
   * boolean, so there is no numeric state for a value to be interpolated through.
   */
  for (const forbidden of ["useState", "useEffect", "setInterval", "setTimeout", "requestAnimationFrame"]) {
    assert.doesNotMatch(
      funnel,
      new RegExp(forbidden),
      `FunnelLine must not run ${forbidden} — a numeral is disclosed, not animated`
    );
  }
  assert.match(lead, /useState\(false\)/, "the lead's only state is the draw latch");
  assert.equal(
    /useState<(number|string)/.test(lead) || /useState\(\d/.test(lead),
    false,
    "the lead holds no numeric state a figure could be ramped through"
  );
});

/* ------------------------------------------------------------------ *
 * The shared reveal primitive still moves nothing that occupies space
 * ------------------------------------------------------------------ */

test("the armed and settled states differ only in painted properties", () => {
  const reveal = css.slice(css.indexOf(".rw-hero .rw-reveal {"), css.indexOf(".rw-hero .rw-reveal.is-in"));
  assert.ok(reveal.length > 0, "precondition: the shared reveal primitive is still declared");
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

test("a reveal whose observer never fires is still readable", () => {
  // The global reduce block neutralises duration; it cannot un-hide an element left at opacity 0.
  const reduceBlock = css.slice(css.lastIndexOf("@media (prefers-reduced-motion: reduce)"));
  assert.match(reduceBlock, /\.rw-hero \.rw-reveal/);
  assert.match(reduceBlock, /opacity:\s*1/);
});

test("the lead's venue rules draw with transform, never with width", () => {
  /*
   * The rules animate `scaleX` on a track that holds its full box from the first frame. Animating
   * `width` instead would reflow the block on every frame — the CLS that the reserved-height slots
   * in the replaced composition existed to prevent, reintroduced through the animation.
   */
  assert.match(lead, /transition: `transform \$\{LINE_MS\}ms/, "the rule animates transform");
  assert.doesNotMatch(lead, /transition: `width/, "and never animates its width");
});

/* ------------------------------------------------------------------ *
 * The replaced composition stays replaced
 * ------------------------------------------------------------------ */

test("the descent sequence is gone from the source and from the stylesheet", () => {
  /*
   * Deleted, not merely unmounted. A `.rw-descent` rule that can no longer match anything, or a
   * `researchRevealDecision` nothing calls, is how a replaced composition quietly waits to be
   * wired back in beside its replacement.
   */
  /*
   * Comments are stripped first, so the notes that RECORD the removal — and name the selectors
   * they removed — do not read as the thing still being there. The guard is about what ships, and
   * a comment ships nothing.
   */
  const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

  for (const [name, src] of SURFACE) {
    const src_ = code(src);
    assert.doesNotMatch(src_, /rw-descent|data-reveal|RevealPhase/, `${name} still carries the descent`);
    assert.doesNotMatch(src_, /researchRevealDecision|useResearchReveal/, `${name} still runs the sequence`);
  }
  assert.doesNotMatch(code(css), /rw-descent/, "the stylesheet still declares the descent");
  // The once-per-day key wrote to localStorage. With no sequence to bound, nothing may write it.
  assert.doesNotMatch(code(stage), /research-reveal:/, "the reveal's storage key must not survive it");
});

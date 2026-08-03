import test from "node:test";
import assert from "node:assert/strict";
import { FUNNEL_STEP_PX, funnelDescent } from "../components/homepage/hero/HeroStage";
import { RESEARCH_STAGE_RULES } from "../lib/research/researchRun";
import type { HeroFunnel } from "../lib/homepage/types";

/**
 * Sprint 2 — the descent.
 *
 * The staircase is keyed to the RENDERED index. Keying it to the declared stage order would open a
 * hole wherever a null stage sat, and a gap in a staircase reads as a stage the page declined to
 * name — the opposite of what omission is for (rwbible §3.8).
 */

function funnel(over: Partial<HeroFunnel> = {}): HeroFunnel {
  return {
    analysed: 238,
    validated: 231,
    inScope: 214,
    qualified: 18,
    featured: 5,
    published: null,
    rules: { ...RESEARCH_STAGE_RULES },
    ...over,
  };
}

test("five rendered stages step 0/16/32/48/64", () => {
  const descent = funnelDescent(funnel());

  assert.deepEqual(
    descent.map((step) => step.offset),
    [0, 16, 32, 48, 64]
  );
  assert.deepEqual(
    descent.map((step) => step.stage),
    ["analysed", "validated", "inScope", "qualified", "featured"]
  );
});

test("four rendered stages step 0/16/32/48 with no gap where the null stage was", () => {
  // An archive day: the pipeline observed nothing, so `analysed` is omitted.
  const descent = funnelDescent(funnel({ analysed: null }));

  assert.equal(descent.length, 4);
  assert.deepEqual(
    descent.map((step) => step.offset),
    [0, 16, 32, 48],
    "the staircase must close up, not leave a hole at the omitted stage"
  );
  assert.deepEqual(
    descent.map((step) => step.stage),
    ["validated", "inScope", "qualified", "featured"]
  );
});

test("the omission can fall anywhere and the steps stay contiguous", () => {
  for (const missing of ["analysed", "validated", "inScope", "qualified"] as const) {
    const descent = funnelDescent(funnel({ [missing]: null }));

    assert.equal(descent.length, 4, `${missing}: four stages must render`);
    assert.deepEqual(
      descent.map((step) => step.offset),
      [0, 16, 32, 48],
      `${missing}: offsets must remain 0/16/32/48`
    );
    assert.equal(
      descent.some((step) => step.stage === missing),
      false,
      `${missing}: the null stage must not render`
    );
  }
});

test("offsets are always the rendered index times the step, for any subset", () => {
  const subsets: Array<Partial<HeroFunnel>> = [
    { analysed: null, validated: null, inScope: null },
    { validated: null, inScope: null },
    { analysed: null, inScope: null, featured: null },
    { analysed: null, validated: null, inScope: null, qualified: null },
  ];

  for (const subset of subsets) {
    const descent = funnelDescent(funnel(subset));
    descent.forEach((step, index) => {
      assert.equal(
        step.offset,
        index * FUNNEL_STEP_PX,
        `${JSON.stringify(subset)}: step ${index} must sit at ${index * FUNNEL_STEP_PX}px`
      );
    });
  }
});

test("a funnel with nothing observed renders no descent at all", () => {
  const descent = funnelDescent(
    funnel({
      analysed: null,
      validated: null,
      inScope: null,
      qualified: null,
      featured: null,
    })
  );

  assert.equal(descent.length, 0);
});

test("only the surviving stages are emphasised", () => {
  const descent = funnelDescent(funnel());
  const emphasised = descent.filter((step) => step.emphasised).map((step) => step.stage);

  // Green means Qualified (brief, COLOUR SYSTEM). The rejected population is never drawn in it.
  assert.deepEqual(emphasised, ["qualified", "featured"]);
});

test("emphasis follows the stage, not its position in the staircase", () => {
  // With the first three omitted, `qualified` is now step 0 — and still emphasised.
  const descent = funnelDescent(funnel({ analysed: null, validated: null, inScope: null }));

  assert.deepEqual(
    descent.map((step) => [step.stage, step.offset, step.emphasised]),
    [
      ["qualified", 0, true],
      ["featured", 16, true],
    ]
  );
});

test("a zero count is a rendered stage, not an omission", () => {
  // Zero featured is an observation: the composition presented nothing. Only null omits.
  const descent = funnelDescent(funnel({ featured: 0 }));

  assert.equal(descent.length, 5);
  assert.equal(descent[4]?.value, 0);
  assert.equal(descent[4]?.offset, 64);
});

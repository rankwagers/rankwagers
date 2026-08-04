import test from "node:test";
import assert from "node:assert/strict";
import { FUNNEL_STEP_PX, funnelDescent } from "../components/homepage/hero/heroModel";
import { RESEARCH_STAGE_RULES } from "../lib/research/researchRun";
import type { HeroFunnel } from "../lib/homepage/types";

/**
 * Sprint 2 — the descent.
 *
 * The staircase is keyed to the VALUE. A stage drops only when its count is strictly lower than the
 * previous rendered stage, so a flat run states "nothing was removed here" and a drop states an
 * actual rejection.
 *
 * Omission still governs WHICH stages appear: a null stage is left out entirely, and the run
 * compares each stage against the previous one that rendered — never against one the page declined
 * to name (rwbible §3.8).
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

test("a strictly decreasing subset still steps once per stage", () => {
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

/* ------------------------------------------------------------------ *
 * The offset describes the data, not the position
 * ------------------------------------------------------------------ */

test("today's real shape 32/32/32/8/5 reads 0/0/0/16/32", () => {
  // The day that settled the rule. An index-keyed staircase put three identical numbers at three
  // different heights, promising narrowing where nothing narrowed.
  const descent = funnelDescent(
    funnel({ analysed: 32, validated: 32, inScope: 32, qualified: 8, featured: 5 })
  );

  assert.deepEqual(
    descent.map((step) => step.offset),
    [0, 0, 0, 16, 32]
  );
});

test("all-equal counts sit on a single level with no descent at all", () => {
  const descent = funnelDescent(
    funnel({ analysed: 12, validated: 12, inScope: 12, qualified: 12, featured: 12 })
  );

  assert.deepEqual(
    descent.map((step) => step.offset),
    [0, 0, 0, 0, 0],
    "a day that rejected nothing must not draw a staircase"
  );
});

test("strictly decreasing counts step once per stage", () => {
  const descent = funnelDescent(
    funnel({ analysed: 238, validated: 231, inScope: 214, qualified: 18, featured: 5 })
  );

  assert.deepEqual(
    descent.map((step) => step.offset),
    [0, 16, 32, 48, 64]
  );
});

test("a two-stage archive day steps once", () => {
  // The pipeline observed nothing, so only qualified and featured render.
  const descent = funnelDescent(
    funnel({ analysed: null, validated: null, inScope: null, qualified: 18, featured: 5 })
  );

  assert.equal(descent.length, 2);
  assert.deepEqual(
    descent.map((step) => step.offset),
    [0, 16]
  );
});

test("a two-stage archive day whose counts are equal stays level", () => {
  const descent = funnelDescent(
    funnel({ analysed: null, validated: null, inScope: null, qualified: 5, featured: 5 })
  );

  assert.deepEqual(
    descent.map((step) => step.offset),
    [0, 0]
  );
});

test("the first rendered stage is always step 0, whichever stage it is", () => {
  for (const missing of [
    {},
    { analysed: null },
    { analysed: null, validated: null },
    { analysed: null, validated: null, inScope: null },
  ] as Array<Partial<HeroFunnel>>) {
    const descent = funnelDescent(funnel(missing));
    assert.equal(descent[0]?.offset, 0, `${JSON.stringify(missing)}: first stage must be level`);
  }
});

test("a rise never steps up, and never steps down either", () => {
  // Counts cannot rise in a real run, but the rule must not invent a step if one ever appears.
  const descent = funnelDescent(
    funnel({ analysed: 5, validated: 40, inScope: 40, qualified: 8, featured: 2 })
  );

  assert.deepEqual(
    descent.map((step) => step.offset),
    [0, 0, 0, 16, 32]
  );
});

test("the offset only ever increases, and only by one step at a time", () => {
  const shapes: Array<Partial<HeroFunnel>> = [
    { analysed: 32, validated: 32, inScope: 32, qualified: 8, featured: 5 },
    { analysed: 500, validated: 10, inScope: 9, qualified: 9, featured: 1 },
    { analysed: 7, validated: 7, inScope: 6, qualified: 6, featured: 6 },
  ];

  for (const shape of shapes) {
    const offsets = funnelDescent(funnel(shape)).map((step) => step.offset);
    offsets.forEach((offset, index) => {
      if (index === 0) return;
      const delta = offset - (offsets[index - 1] ?? 0);
      assert.ok(
        delta === 0 || delta === FUNNEL_STEP_PX,
        `${JSON.stringify(shape)}: step ${index} moved by ${delta}px`
      );
    });
  }
});

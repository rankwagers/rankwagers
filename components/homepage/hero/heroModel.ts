import type { HeroFunnel } from "@/lib/homepage/types";
import type { ResearchStage } from "@/lib/research/researchRun";

/* ============================================================================
   THE HERO'S SHARED MODEL — pure, and deliberately component-free
   ----------------------------------------------------------------------------
   `funnelDescent` and `splitRate` were exported from `HeroStage`, and the two
   components that replaced its interior — `FunnelLine`, `HeroLead` — imported
   them back out of it. `HeroStage` renders both, so the graph held a cycle:

       HeroStage → FunnelLine → HeroStage

   It resolved, because every use is inside a render body rather than at module
   evaluation, and a production build confirmed it. That is not the same as it
   being safe. A cycle that works by accident of call timing breaks the moment
   someone lifts one of these to a module constant, and it breaks at import
   time — the hardest failure to read backwards from.

   Both are pure functions over data. Neither needs a component module. Putting
   them here makes the graph acyclic by construction rather than by discipline:

       HeroStage ─┬→ heroModel
                  ├→ FunnelLine → heroModel
                  └→ HeroLead   → heroModel

   Nothing in this file imports a component, and nothing here renders. That is
   the property worth keeping, not the file itself.
   ========================================================================== */

/**
 * The copy keys the hero's own composition reads.
 *
 * Lives here rather than in `HeroStage` because `funnelDescent` returns one of these keys per
 * stage — the type travels with the function that produces it, so a component consuming a descent
 * cannot drift from the labels it is entitled to look up.
 */
export type HeroCopy = {
  eyebrow: string;
  updated: string;
  title: string;
  lede: string;
  ledeRest: string;
  funnelTitle: string;
  funnelNote: string;
  funnelAnalysed: string;
  funnelValidated: string;
  funnelInScope: string;
  funnelQualified: string;
  funnelFeatured: string;
  leadTitle: string;
  leadNote: string;
  supportingTitle: string;
  supportingNote: string;
  cta: string;
  empty: string;
  /** Template carrying `{home}` and `{away}`. */
  openResearch: string;
  /**
   * The product's approved qualifier for a provider figure. Travels with the figure so the
   * reading cannot be encountered without the sentence that bounds it.
   */
  probabilityNote: string;
  /** Venue-split labels for the three rates the lead sets beneath its numeral. */
  venueHome: string;
  venueAway: string;
  venueLeague: string;
  /** The supporting table's column heads. */
  tableNo: string;
  tableFixture: string;
  tableLeague: string;
  tableKickoff: string;
  tablePotential: string;
  tableMarket: string;
};

/**
 * A rate, split into its two weights.
 *
 * The model publishes ONE string — `82% (9/11)` — and the composition sets the rate and its sample
 * at different weights. It SPLITS that string rather than rebuilding it from the parts:
 * re-deriving a football figure for presentation is the same class of mistake as inventing one
 * (§3.2), and a split cannot disagree with what was scored. A string carrying no sample is
 * returned whole, so nothing is silently dropped.
 */
export function splitRate(display: string): { rate: string; sample: string | null } {
  const at = display.indexOf(" (");
  if (at === -1) return { rate: display, sample: null };
  return { rate: display.slice(0, at), sample: display.slice(at + 1) };
}

/**
 * The one template the hero resolves itself, because the label depends on which fixture is held.
 *
 * Deliberately not `formatDict`: that helper lives in the dictionary module, and importing it into
 * a client component would pull every locale's strings into the browser bundle for a two-token
 * substitution.
 */
export function fill(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (out, [key, value]) => out.replaceAll(`{${key}}`, value),
    template
  );
}

/**
 * The funnel's steps, in pipeline order, paired with the copy key that labels each.
 *
 * Declared as data so the row is built by filtering observations rather than by a chain of
 * conditionals — which is what keeps "omit a null stage" a single rule with one implementation
 * instead of one `&&` per stage that a later edit can get wrong.
 */
export const FUNNEL_STEPS = [
  { stage: "analysed", label: "funnelAnalysed" },
  { stage: "validated", label: "funnelValidated" },
  { stage: "inScope", label: "funnelInScope" },
  { stage: "qualified", label: "funnelQualified" },
  { stage: "featured", label: "funnelFeatured" },
] as const satisfies ReadonlyArray<{
  stage: keyof HeroFunnel & ResearchStage;
  label: keyof HeroCopy;
}>;

/**
 * Vertical drop between consecutive stages.
 *
 * The v2 funnel is a ruled text line and does not step, so nothing in the shipped composition reads
 * this today. It stays because `offset` is part of `funnelDescent`'s published shape and is proven
 * by `heroFunnelDescent.test.ts`: the value rule below — equal counts stay level, a drop marks an
 * actual rejection — is the funnel's meaning, not a detail of how v1 drew it.
 */
export const FUNNEL_STEP_PX = 16;

export type FunnelStep = {
  stage: ResearchStage;
  label: keyof HeroCopy;
  value: number;
  offset: number;
  emphasised: boolean;
};

/**
 * The descent, resolved from the funnel.
 *
 * The offset is keyed to the VALUE, not to the position. A stage drops one step only when its
 * count is strictly lower than the previous rendered stage; an equal count stays level with it.
 *
 *   step = previous.step + (value < previous.value ? FUNNEL_STEP_PX : 0)
 *
 * Live data is what settled this. A day reading 32 / 32 / 32 / 8 / 5 put three identical numbers at
 * three different heights under an index-keyed staircase, promising narrowing on a day where the
 * first three stages narrowed by nothing. It looked broken precisely because it was accurate. Under
 * the value rule that day reads 0/0/0/16/32 — a flat run stating "nothing was removed here", which
 * is the observation, and a drop stating an actual rejection.
 *
 * The rendered sequence still governs which stages appear: a `null` stage is omitted entirely, so
 * the run compares each stage against the previous one that RENDERED, never against a stage the
 * page declined to name.
 *
 * `emphasised` marks the two stages that survived.
 */
export function funnelDescent(funnel: HeroFunnel): FunnelStep[] {
  const rendered: FunnelStep[] = [];

  for (const { stage, label } of FUNNEL_STEPS) {
    const value = funnel[stage];
    if (value === null) continue;

    const previous = rendered[rendered.length - 1];
    const offset = previous
      ? previous.offset + (value < previous.value ? FUNNEL_STEP_PX : 0)
      : 0;

    rendered.push({
      stage,
      label,
      value,
      offset,
      emphasised: stage === "qualified" || stage === "featured",
    });
  }

  return rendered;
}

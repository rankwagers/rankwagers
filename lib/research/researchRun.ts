/**
 * RESEARCH RUN — the observed shape of one pass of the qualification pipeline.
 *
 * The homepage receives only fixtures that already qualified, so the population the model
 * *rejected* has never been visible to the interface. That is what blocks the Intelligence Funnel
 * (rwdesign §6) and the Research Reveal (§20): both draw the descent from the analysed population
 * down to the featured selection, and neither can be drawn from its last row alone.
 *
 * This contract carries that descent as OBSERVATIONS. Every field is a count the pipeline actually
 * made, or `null`.
 *
 * §3.2 is absolute and governs every value here:
 *   - never estimate a stage,
 *   - never derive one by subtracting another,
 *   - never backfill one from a later stage,
 *   - never substitute zero for "not measured".
 *
 * `null` means "this product does not currently observe this stage". Per §3.8 that is not a
 * failure to hide: the funnel omits the step entirely rather than drawing a zero or a skeleton,
 * because a rendered `0` is a claim that nothing survived, and a skeleton is a claim that a number
 * is coming.
 *
 * Pure module: types and identifiers only. No I/O, no clock, no provider import — so the pipeline
 * and the hero can both depend on it without a cycle.
 */

/** The five stages of the descent, in pipeline order (rwdesign §6). */
/*
 * NOTE ON THE `qualified` KEY.
 *
 * The stage's rule is `market_potential_threshold` — a provider percentage clearing a cut-off.
 * That is NOT a qualification: "qualified" belongs to the evidence model, which reaches it only
 * through sample size and signal weight (SAMPLE_TARGET = 19).
 *
 * The user-facing label is therefore "Cleared threshold". The internal key stays `qualified`
 * because renaming it reaches ~50 call sites across the run model, the trust model, the hero
 * funnel and their tests — churn with no behavioural gain, and every one of those sites is a
 * property access no reader ever sees. The rule string below is the authoritative description of
 * what actually runs here; the key is an identifier, not a claim.
 */
export type ResearchStage =
  | "analysed"
  | "validated"
  | "inScope"
  | "qualified"
  | "featured";

export const RESEARCH_STAGES: readonly ResearchStage[] = [
  "analysed",
  "validated",
  "inScope",
  "qualified",
  "featured",
] as const;

/**
 * Stable identifier for the rule that produced a stage.
 *
 * `analysed` is `null` because it applies no rule of its own — it is the population the rules are
 * applied to. Every other stage names the rule that actually ran, and an identifier is never
 * invented to fill a slot: a stage with no rule would not be a stage.
 */
export const RESEARCH_STAGE_RULES = {
  /** The provider population. Not a filter, so it carries no rule. */
  analysed: null,
  /** `footyRowCoreSchema` in `lib/research/footyRowContract.ts`. */
  validated: "schema_validation",
  /** `EXCLUDED_COMPETITIONS` keyword match in `lib/footystats/client.ts`. */
  inScope: "exclude_cup_competitions",
  /** The four market potential thresholds in `lib/footystats/config.ts`. */
  qualified: "market_potential_threshold",
  /** `HERO_PICK_COUNT` in `lib/homepage/heroModel.ts`. */
  featured: "hero_pick_count",
} as const satisfies Record<ResearchStage, string | null>;

export type ResearchRunRules = Record<ResearchStage, string | null>;

export type ResearchRun = {
  /** Fixtures the provider returned for the date, before any filter of ours. */
  analysed: number | null;
  /** Rows whose fields satisfy the usability contract. */
  validated: number | null;
  /** Validated rows whose competition is in scope. */
  inScope: number | null;
  /** Distinct fixtures that cleared at least one market threshold. */
  qualified: number | null;
  /** Distinct fixtures actually presented. */
  featured: number | null;
  /** When the run was retrieved. `null` when the provider stamp is unusable. */
  fetchedAt: string | null;
  rules: ResearchRunRules;
};

/**
 * A run in which no stage was observed.
 *
 * Used by every path that serves stored rows rather than running the pipeline — the archive read,
 * the same-day fallback, and a provider failure. Those paths hold qualified fixtures and nothing
 * else: the population that was scanned to produce them was observed on some earlier request, not
 * on this one, and reporting a previous run's analysed count as this run's would be a fabricated
 * observation of the kind §3.2 forbids.
 */
export function unobservedResearchRun(fetchedAt: string | null = null): ResearchRun {
  return {
    analysed: null,
    validated: null,
    inScope: null,
    qualified: null,
    featured: null,
    fetchedAt,
    rules: { ...RESEARCH_STAGE_RULES },
  };
}

/**
 * Build a run from counts the caller actually measured.
 *
 * Every field defaults to `null`, so a stage is reported only when a number is passed for it. A
 * caller cannot accidentally publish a zero by omitting an argument, which is the failure mode
 * this signature exists to make impossible.
 */
export function observedResearchRun(input: {
  analysed?: number | null;
  validated?: number | null;
  inScope?: number | null;
  qualified?: number | null;
  featured?: number | null;
  fetchedAt?: string | null;
}): ResearchRun {
  return {
    analysed: countOrNull(input.analysed),
    validated: countOrNull(input.validated),
    inScope: countOrNull(input.inScope),
    qualified: countOrNull(input.qualified),
    featured: countOrNull(input.featured),
    fetchedAt: input.fetchedAt ?? null,
    rules: { ...RESEARCH_STAGE_RULES },
  };
}

/** A count is only a count when it is a finite, non-negative integer. Anything else is `null`. */
function countOrNull(value: number | null | undefined): number | null {
  if (typeof value !== "number") return null;
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) return null;
  return value;
}

# Builder quality evaluation

## What is measured today

From analytics events only:

- generation started / succeeded / failed
- transfer to Studio, merge, replace, handoff
- optional riskMode props when present

## What is Unavailable

- Durable generation snapshots (`persist: false` on Builder API responses)
- Selected-leg settlement linkage
- Combination settlement outcomes
- Exclusion reason tallies from candidate pools
- Selected vs unselected candidate comparisons
- Financial ROI on combinations

## Mode ordering

Configuration expectations (not settlement guarantees) from `RISK_MODE_RULES`:

- Conservative minConfidence **>** Balanced **>** Aggressive
- Conservative fewer max legs / higher evidence floor

Validated as `MATCHES_CONFIG` or `CONFIG_DRIFT` — never auto-fixed.

## Retrospective diagnostics

Any future analysis of how excluded candidates settled must be labeled:

**`RETROSPECTIVE_DIAGNOSTIC_ONLY`**

Requirements:

- never rewrite historical Builder output
- never present hindsight as a live recommendation
- show missing-selection bias and sample size
- do not auto-adjust thresholds

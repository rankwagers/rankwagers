# Experiment metrics

Typed registry in `lib/experimentation/metrics.ts`.

Each metric defines numerator/denominator events, dedupe, attribution window, availability, direction, guardrail suitability.

**Unavailable (rejected):** FTD, deposit, revenue, LTV, downstream conversion — no verified sources.

Every experiment requires exactly one primary metric.
